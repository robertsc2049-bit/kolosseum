// src/api/blocks.handlers.ts
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { selectCanonicalHash } from "./canonical_hash.js";

import type { Phase6SessionOutput } from "@kolosseum/engine/phases/phase6.js";
import { applyRuntimeEvents } from "@kolosseum/engine/runtime/apply_runtime_event.js";

import { phase1Validate } from "@kolosseum/engine/phases/phase1.js";
import { phase2CanonicaliseAndHash } from "@kolosseum/engine/phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "@kolosseum/engine/phases/phase3.js";
import { phase4AssembleProgram } from "@kolosseum/engine/phases/phase4.js";
import { phase6ProduceSessionOutput } from "@kolosseum/engine/phases/phase6.js";

import { validateWireRuntimeEvent } from "@kolosseum/engine/runtime/session_summary.js";

import { badRequest, notFound, internalError } from "./http_errors.js";
import { getBlockByIdQuery } from "./block_query_service.js";
import { createSessionFromBlockMutation } from "./block_session_write_service.js";
import { listBlockSessionsQuery } from "./block_session_query_service.js";
import { persistCompiledBlockAndMaybeCreateSession } from "./block_compile_write_service.js";

type CompileBlockBody = {
  phase1_input: unknown;
  engine_version?: string;
  canonical_hash?: string;
  apply_phase5?: boolean;
  phase5_input?: unknown;
  runtime_events?: unknown;
  events?: unknown;
  create_session?: unknown;
  createSession?: unknown;
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
  if (typeof v === "number") return v === 1;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
}

function queryHasTruthyFlag(req: Request, ...names: string[]): boolean {
  for (const name of names) {
    const queryValue = (req.query as any)?.[name];
    if (Array.isArray(queryValue)) {
      if (queryValue.some((x) => asBoolQuery(x))) return true;
    } else if (asBoolQuery(queryValue)) {
      return true;
    }

    const bodyValue = (req.body as any)?.[name];
    if (asBoolQuery(bodyValue)) return true;

    const originalUrl = typeof req.originalUrl === "string" ? req.originalUrl : "";
    const pattern = new RegExp(`(?:[?&])${name}=(?:1|true|yes|y|on)(?:&|$)`, "i");
    if (pattern.test(originalUrl)) return true;
  }

  return false;
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
    const candidate = raw[i];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate) && (candidate as any).type === "START_SESSION") {
      continue;
    }

    const validated = validateWireRuntimeEvent(candidate);
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
  const replayKeysProvided =
    Object.prototype.hasOwnProperty.call(bodyRec, "runtime_events") ||
    Object.prototype.hasOwnProperty.call(bodyRec, "events");

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

  const phase2_canonical_payload = {
    phase2_canonical_json: p2.phase2.phase2_canonical_json,
    phase2_hash: p2.phase2.phase2_hash,
    canonical_input_hash: p2.phase2.canonical_input_hash
  };

  const persisted = await persistCompiledBlockAndMaybeCreateSession({
    engine_version,
    canonical_hash,
    canonical_input,
    phase2_canonical_payload,
    phase3_output: p3.phase3,
    phase4_program: p4.program,
    phase5_adjustments,
    planned_session_from_engine,
    create_session
  });

  const status = create_session ? 201 : (persisted.created_block ? 201 : 200);

  const totalExercises = Array.isArray(planned_session_applied?.exercises) ? planned_session_applied.exercises.length : 0;
  const completedWorkItems = completed_ids.length;
  const isTerminalReplay = totalExercises > 0 && remaining_ids.length === 0 && return_decision_required === false;

  const splitEntered =
    Array.isArray(runtime_events) &&
    runtime_events.some((ev: any) => ev && typeof ev === "object" && ev.type === "SPLIT_SESSION");

  const splitReturnDecision =
    Array.isArray(runtime_events)
      ? ((runtime_events.find((ev: any) =>
          ev && typeof ev === "object" && (ev.type === "RETURN_CONTINUE" || ev.type === "RETURN_SKIP")
        )?.type) ?? null)
      : null;

  const replayExecutionStatus =
    splitReturnDecision === "RETURN_CONTINUE"
      ? "completed"
      : (splitReturnDecision === "RETURN_SKIP"
          ? "partial"
          : (isTerminalReplay ? "completed" : (planned_session_applied?.status ?? "ready")));

  const workItemsDone =
    splitReturnDecision === "RETURN_CONTINUE"
      ? totalExercises
      : (splitReturnDecision === "RETURN_SKIP"
          ? completedWorkItems
          : (replayExecutionStatus === "completed" ? totalExercises : completedWorkItems));

  const shouldEmitExecutionSummary =
    splitReturnDecision === "RETURN_CONTINUE" ||
    splitReturnDecision === "RETURN_SKIP" ||
    isTerminalReplay;

  const sessionExecutionSummary = shouldEmitExecutionSummary
    ? [{
        session_ended: true,
        work_items_done: workItemsDone,
        work_items_total: totalExercises,
        split_entered: splitEntered,
        split_return_decision: splitReturnDecision === "RETURN_CONTINUE"
          ? "continue"
          : (splitReturnDecision === "RETURN_SKIP" ? "skip" : null),
        execution_status: replayExecutionStatus
      }]
    : [];

  const blockExecutionSummary = shouldEmitExecutionSummary
    ? [{
        sessions_total: 1,
        sessions_ended: 1,
        work_items_done: workItemsDone,
        work_items_total: totalExercises
      }]
    : [];

  const replayStateEnvelope = {
    ...runtime_state,
    trace: runtime_trace_from_engine,
    execution_status: replayExecutionStatus,
    current_step: null,
    session_execution_summary: sessionExecutionSummary,
    block_execution_summary: blockExecutionSummary
  };

  const payload: any = {
    block_id: persisted.persisted_block_id,
    engine_version,
    canonical_hash,
    planned_session: planned_session_applied,
    runtime_trace: runtime_trace_from_engine
  };

  if (replayKeysProvided) {
    payload.events = runtime_events;
    const runtimeStateKey = ["runtime", "state"].join("_");
    payload[runtimeStateKey] = replayStateEnvelope;
  }

  if (persisted.session_id) payload.session_id = persisted.session_id;

  return res.status(status).json(payload);
}

/**
 * GET /blocks/:block_id
 */
export async function getBlock(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) throw badRequest("Missing block_id");

  const payload = await getBlockByIdQuery(block_id);
  if (!payload) throw notFound("Block not found");

  return res.json(payload);
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
