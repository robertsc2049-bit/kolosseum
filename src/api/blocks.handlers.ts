// src/api/blocks.handlers.ts
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { selectCanonicalHash } from "./canonical_hash.js";
import { pool } from "../db/pool.js";

import type { Phase6SessionOutput } from "@kolosseum/engine/phases/phase6.js";
import { applyRuntimeEvents } from "@kolosseum/engine/runtime/apply_runtime_event.js";

import { phase1Validate } from "@kolosseum/engine/phases/phase1.js";
import { phase2CanonicaliseAndHash } from "@kolosseum/engine/phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "@kolosseum/engine/phases/phase3.js";
import { phase4AssembleProgram } from "@kolosseum/engine/phases/phase4.js";
import { phase6ProduceSessionOutput } from "@kolosseum/engine/phases/phase6.js";

import { validateWireRuntimeEvent } from "@kolosseum/engine/runtime/session_summary.js";

import { badRequest, notFound, internalError } from "./http_errors.js";
import { createSessionFromBlockMutation } from "./block_session_write_service.js";
import { listBlockSessionsQuery } from "./block_session_query_service.js";

type CompileBlockBody = {
  phase1_input: unknown;
  engine_version?: string;
  canonical_hash?: string;
  apply_phase5?: boolean;
  phase5_input?: unknown;
  runtime_events?: unknown;
  events?: unknown;
};

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asBoolQuery(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function requireObjectBody(req: Request): JsonRecord {
  const bodyUnknown = req.body as unknown;
  if (!isRecord(bodyUnknown)) throw badRequest("Missing/invalid JSON body (expected object)");
  return bodyUnknown;
}

function readRuntimeEvents(body: CompileBlockBody): unknown[] {
  const raw = (body as any)?.runtime_events ?? (body as any)?.events;
  if (typeof raw === "undefined") return [];
  if (!Array.isArray(raw)) throw badRequest("Invalid runtime_events/events (expected array)");
  return raw;
}

function parseRuntimeEvents(raw: unknown[]): any[] {
  const out: any[] = [];
  for (let i = 0; i < raw.length; i++) {
    const validated = validateWireRuntimeEvent(raw[i]);
    if (!validated) {
      throw badRequest("Invalid runtime_events/events (event failed validation)", { index: i });
    }
    out.push(validated);
  }
  return out;
}

function mapEngineRuntimeApplyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("PHASE6_RUNTIME_AWAIT_RETURN_DECISION")) {
    throw badRequest("Runtime event rejected (await return decision)", {
      failure_token: "phase6_runtime_await_return_decision",
      cause: msg
    });
  }
  if (msg.startsWith("PHASE6_RUNTIME_UNKNOWN_EVENT")) {
    throw badRequest("Runtime event rejected (unknown event type)", {
      failure_token: "phase6_runtime_unknown_event",
      cause: msg
    });
  }
  if (msg.startsWith("PHASE6_RUNTIME_INVALID_EVENT")) {
    throw badRequest("Runtime event rejected (invalid event shape)", {
      failure_token: "phase6_runtime_invalid_event",
      cause: msg
    });
  }

  throw internalError("Runtime apply failed (unexpected engine error)", { cause: msg });
}

/**
 * POST /blocks/compile
 * Optional: ?create_session=true
 */
export async function compileBlock(req: Request, res: Response) {
  const bodyRec = requireObjectBody(req);
  const body = bodyRec as unknown as CompileBlockBody;

  if (!Object.prototype.hasOwnProperty.call(body, "phase1_input")) {
    throw badRequest("Missing phase1_input");
  }

  const engine_version = asString(body.engine_version) ?? "EB2-1.0.0";
  const apply_phase5 = body.apply_phase5 === true;
  const create_session = asBoolQuery((req.query as any)?.create_session);

  const p1 = phase1Validate(body.phase1_input);
  if (!p1.ok) {
    throw badRequest("Phase 1 failed", { failure_token: p1.failure_token, details: p1.details });
  }
  const canonical_input = p1.canonical_input;

  const p2 = phase2CanonicaliseAndHash(canonical_input);
  if (!p2.ok) {
    throw badRequest("Phase 2 failed", { failure_token: p2.failure_token, details: p2.details });
  }

  const requested_canonical_hash = asString(body.canonical_hash);
  const allow_override = process.env.KOLOSSEUM_ALLOW_CANONICAL_HASH_OVERRIDE === "1";
  const expected_token =
    typeof process.env.KOLOSSEUM_INTERNAL_TOKEN === "string" && process.env.KOLOSSEUM_INTERNAL_TOKEN.trim().length > 0
      ? process.env.KOLOSSEUM_INTERNAL_TOKEN.trim()
      : undefined;
  const provided_token =
    typeof (req as any)?.get === "function" ? (req as any).get("x-kolosseum-internal-token") : undefined;

  let canonical_hash: string;
  try {
    canonical_hash = selectCanonicalHash({
      requested: requested_canonical_hash,
      phase2_hash: p2.phase2.phase2_hash,
      allow_override,
      expected_token,
      provided_token
    }).canonical_hash;
  } catch (e: unknown) {
    throw internalError("canonical_hash selection failed", { cause: e instanceof Error ? e.message : String(e) });
  }

  const p3 = phase3ResolveConstraintsAndLoadRegistries(canonical_input);
  if (!p3.ok) {
    throw badRequest("Phase 3 failed", { failure_token: p3.failure_token, details: p3.details });
  }

  const p4 = phase4AssembleProgram(canonical_input, p3.phase3);
  if (!p4.ok) {
    throw badRequest("Phase 4 failed", { failure_token: p4.failure_token, details: p4.details });
  }

  if (apply_phase5) {
    throw badRequest("Phase 5 compile not implemented", { failure_token: "phase5_compile_not_implemented" });
  }
  const phase5_adjustments: unknown[] = [];

  const p6 = phase6ProduceSessionOutput(p4.program, canonical_input, undefined);
  if (!p6.ok) {
    throw badRequest("Phase 6 failed", { failure_token: p6.failure_token, details: p6.details });
  }
  const planned_session_from_engine: Phase6SessionOutput = p6.session;

  const runtime_events = parseRuntimeEvents(readRuntimeEvents(body));

  let runtime_state: any;
  try {
    runtime_state = applyRuntimeEvents(planned_session_from_engine as any, runtime_events as any);

    if (process.env.KOLOSSEUM_TEST_FORCE_RUNTIME_APPLY_THROW === "1") {
      throw new Error("KOLOSSEUM_TEST_FORCE_RUNTIME_APPLY_THROW: unhandled apply failure sentinel");
    }

    if (runtime_state && typeof runtime_state === "object") {
      const rt = runtime_state.runtime_trace;
      if (rt && typeof rt === "object") {
        const {
          split_active: _legacySplitActive,
          remaining_at_split_ids: _legacyRemainingAtSplitIds,
          return_gate_required: _legacyReturnGateRequired,
          return_decision_required: _derivedReturnDecisionRequired,
          return_decision_options: _derivedReturnDecisionOptions,
          ...traceBase
        } = rt as Record<string, any>;

        runtime_state.runtime_trace = traceBase;
      }
    }
  } catch (e: unknown) {
    mapEngineRuntimeApplyError(e);
  }

  const remaining_ids: string[] = Array.isArray(runtime_state?.remaining_ids)
    ? runtime_state.remaining_ids.map((x: any) => String(x))
    : [];

  const completed_ids: string[] =
    runtime_state?.completed_ids instanceof Set
      ? Array.from(runtime_state.completed_ids).map((x: any) => String(x))
      : (Array.isArray(runtime_state?.completed_ids)
          ? runtime_state.completed_ids.map((x: any) => String(x))
          : []);

  const dropped_ids: string[] =
    runtime_state?.dropped_ids instanceof Set
      ? Array.from(runtime_state.dropped_ids).map((x: any) => String(x))
      : (Array.isArray(runtime_state?.dropped_ids)
          ? runtime_state.dropped_ids.map((x: any) => String(x))
          : (runtime_state?.skipped_ids instanceof Set
              ? Array.from(runtime_state.skipped_ids).map((x: any) => String(x))
              : (Array.isArray(runtime_state?.skipped_ids)
                  ? runtime_state.skipped_ids.map((x: any) => String(x))
                  : [])));

  const return_decision_required: boolean =
    typeof runtime_state?.return_decision_required === "boolean" ? runtime_state.return_decision_required : false;

  const return_decision_options: Array<"RETURN_CONTINUE" | "RETURN_SKIP"> =
    Array.isArray(runtime_state?.return_decision_options)
      ? runtime_state.return_decision_options
          .map((x: any) => String(x))
          .filter((x: string) => x === "RETURN_CONTINUE" || x === "RETURN_SKIP")
      : [];

  const runtime_trace_from_engine = {
    remaining_ids,
    completed_ids,
    dropped_ids,
    return_decision_required,
    return_decision_options
  };

  const completedSet = new Set(completed_ids);
  const droppedSet = new Set(dropped_ids);

  const planned_session_applied: Phase6SessionOutput = {
    ...planned_session_from_engine,
    exercises: planned_session_from_engine.exercises.map((e: any) => {
      const exId = String(e.exercise_id ?? "");
      const status = completedSet.has(exId) ? "completed" : (droppedSet.has(exId) ? "skipped" : "pending");
      return { ...e, status };
    })
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const new_block_id = id("b");

    const phase2_canonical_payload = {
      phase2_canonical_json: p2.phase2.phase2_canonical_json,
      phase2_hash: p2.phase2.phase2_hash,
      canonical_input_hash: p2.phase2.canonical_input_hash
    };

    const br = await client.query(
      `
      INSERT INTO blocks (
        block_id,
        engine_version,
        canonical_hash,
        phase1_input,
        phase2_canonical,
        phase3_output,
        phase4_program,
        phase5_adjustments
      )
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb)
      ON CONFLICT (canonical_hash) DO UPDATE
      SET
        engine_version = EXCLUDED.engine_version,
        phase1_input = EXCLUDED.phase1_input,
        phase2_canonical = EXCLUDED.phase2_canonical,
        phase3_output = EXCLUDED.phase3_output,
        phase4_program = EXCLUDED.phase4_program,
        phase5_adjustments = EXCLUDED.phase5_adjustments
      RETURNING block_id
      `,
      [
        new_block_id,
        engine_version,
        canonical_hash,
        JSON.stringify(canonical_input),
        JSON.stringify(phase2_canonical_payload),
        JSON.stringify(p3.phase3),
        JSON.stringify(p4.program),
        JSON.stringify(phase5_adjustments)
      ]
    );

    const persisted_block_id = asString(br.rows?.[0]?.block_id) ?? new_block_id;
    const created_block = persisted_block_id === new_block_id;

    let session_id: string | undefined;

    if (create_session) {
      session_id = id("s");
      const plannedToStore = { ...planned_session_from_engine, session_id };

      await client.query(
        `
        INSERT INTO sessions (session_id, status, planned_session, block_id)
        VALUES ($1, 'created', $2::jsonb, $3)
        `,
        [session_id, JSON.stringify(plannedToStore), persisted_block_id]
      );

      try {
        await client.query(
          `
          INSERT INTO session_event_seq (session_id, next_seq)
          VALUES ($1, 0)
          ON CONFLICT (session_id) DO NOTHING
          `,
          [session_id]
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/relation .*session_event_seq.* does not exist/i.test(msg)) throw e;
      }
    }

    await client.query("COMMIT");

    const status = create_session ? 201 : (created_block ? 201 : 200);

    const payload: any = {
      block_id: persisted_block_id,
      engine_version,
      canonical_hash,
      planned_session: planned_session_applied,
      runtime_trace: runtime_trace_from_engine
    };
    if (session_id) payload.session_id = session_id;

    return res.status(status).json(payload);
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/**
 * GET /blocks/:block_id
 */
export async function getBlock(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) throw badRequest("Missing block_id");

  const r = await pool.query(
    `
    SELECT
      block_id,
      created_at,
      engine_version,
      canonical_hash,
      phase1_input,
      phase2_canonical,
      phase3_output,
      phase4_program,
      phase5_adjustments
    FROM blocks
    WHERE block_id = $1
    `,
    [block_id]
  );

  if ((r.rowCount ?? 0) === 0) throw notFound("Block not found");

  const row = r.rows[0];
  const p2c: any = (row as any).phase2_canonical;

  return res.json({
    ...row,
    phase2_canonical_json: typeof p2c?.phase2_canonical_json === "string" ? p2c.phase2_canonical_json : undefined,
    phase2_hash: typeof p2c?.phase2_hash === "string" ? p2c.phase2_hash : undefined
  });
}

/**
 * POST /blocks/:block_id/sessions
 * body: { planned_session: <Phase6SessionOutput> }
 */
export async function createSessionFromBlock(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) throw badRequest("Missing block_id");

  const planned_session = (req.body as any)?.planned_session as Phase6SessionOutput | undefined;
  if (!planned_session || typeof planned_session !== "object") {
    throw badRequest("Missing planned_session");
  }

  const result = await createSessionFromBlockMutation(block_id, planned_session);
  return res.status(201).json(result);
}

/**
 * GET /blocks/:block_id/sessions
 */
export async function listBlockSessions(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) throw badRequest("Missing block_id");

  const payload = await listBlockSessionsQuery(block_id);
  return res.json(payload);
}