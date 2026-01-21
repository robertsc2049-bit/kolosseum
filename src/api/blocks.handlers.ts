// src/api/blocks.handlers.ts
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { pool } from "../db/pool.js";

import type { Phase6SessionOutput } from "../../engine/src/phases/phase6.js";

import { phase1Validate } from "../../engine/src/phases/phase1.js";
import { phase2CanonicaliseAndHash } from "../../engine/src/phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "../../engine/src/phases/phase3.js";
import { phase4AssembleProgram } from "../../engine/src/phases/phase4.js";
import { phase6ProduceSessionOutput } from "../../engine/src/phases/phase6.js";

type CompileBlockBody = {
  phase1_input: unknown;
  engine_version?: string;
  canonical_hash?: string;

  // reserved for when Phase 5 compile exists
  apply_phase5?: boolean;
  phase5_input?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
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

function pgErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    if (typeof anyErr.detail === "string" && anyErr.detail.length > 0) return anyErr.detail;
    if (typeof anyErr.message === "string" && anyErr.message.length > 0) return anyErr.message;
  }
  return String(err);
}

/**
 * POST /blocks/compile
 * Optional: ?create_session=true
 *
 * Behavior:
 * - Validates Phase1 input
 * - Computes deterministic Phase2 hash
 * - Resolves Phase3 + assembles Phase4 program
 * - (Phase5 reserved, currently no-op)
 * - Produces Phase6 planned session (optional persist as session)
 * - Persists block idempotently by canonical_hash
 *
 * Return:
 * - always: block_id, engine_version, canonical_hash
 * - if create_session=true: session_id
 */
export async function compileBlock(req: Request, res: Response) {
  const bodyUnknown = req.body as unknown;
  if (!isRecord(bodyUnknown)) return res.status(400).json({ error: "Missing body" });

  const body = bodyUnknown as CompileBlockBody;
  if (!Object.prototype.hasOwnProperty.call(body, "phase1_input")) {
    return res.status(400).json({ error: "Missing phase1_input" });
  }

  const engine_version = asString(body.engine_version) ?? "EB2-1.0.0";
  const apply_phase5 = body.apply_phase5 === true;

  // Ticket-022: compile can optionally persist a session
  const create_session = asBoolQuery((req.query as any)?.create_session);

  // ---- Phase 1 ----
  const p1 = phase1Validate(body.phase1_input);
  if (!p1.ok) {
    return res.status(400).json({
      error: "Phase 1 failed",
      failure_token: p1.failure_token,
      details: p1.details
    });
  }
  const canonical_input = p1.canonical_input;

  // ---- Phase 2 ----
  const p2 = phase2CanonicaliseAndHash(canonical_input);
  if (!p2.ok) {
    return res.status(400).json({
      error: "Phase 2 failed",
      failure_token: p2.failure_token,
      details: p2.details
    });
  }

  // canonical_hash is deterministic for identical canonical input (default).
  // Allow override only if caller explicitly supplies one.
  const canonical_hash = asString(body.canonical_hash) ?? p2.phase2.phase2_hash;

  // ---- Phase 3 ----
  const p3 = phase3ResolveConstraintsAndLoadRegistries(canonical_input);
  if (!p3.ok) {
    return res.status(400).json({
      error: "Phase 3 failed",
      failure_token: p3.failure_token,
      details: p3.details
    });
  }

  // ---- Phase 4 ----
  const p4 = phase4AssembleProgram(canonical_input, p3.phase3);
  if (!p4.ok) {
    return res.status(400).json({
      error: "Phase 4 failed",
      failure_token: p4.failure_token,
      details: p4.details
    });
  }

  // ---- Phase 5 (reserved) ----
  if (apply_phase5) {
    return res.status(400).json({
      error: "Phase 5 compile not implemented",
      failure_token: "phase5_compile_not_implemented"
    });
  }
  const phase5_adjustments: unknown[] = [];

  // ---- Phase 6 planned session (Ticket-022) ----
  // NOTE: engine may emit a deterministic session_id (e.g. SESSION_V1). We never trust it for DB identity.
  // We always allocate a DB session_id when persisting.
  const p6 = phase6ProduceSessionOutput(p4.program, canonical_input, undefined);
  if (!p6.ok) {
    return res.status(400).json({
      error: "Phase 6 failed",
      failure_token: p6.failure_token,
      details: p6.details
    });
  }
  const planned_session_from_engine: Phase6SessionOutput = p6.session;

  // ---- Persist (TX): block upsert + optional session create ----
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

      // persist planned_session with the DB session_id forced
      const plannedToStore = { ...planned_session_from_engine, session_id };

      await client.query(
        `
        INSERT INTO sessions (session_id, status, planned_session, block_id)
        VALUES ($1, 'created', $2::jsonb, $3)
        `,
        [session_id, JSON.stringify(plannedToStore), persisted_block_id]
      );

      // If session_event_seq table exists, initialise it (safe + forward compatible).
      // If it doesn't exist, this will throw; we swallow ONLY "relation does not exist".
      try {
        await client.query(
          `
          INSERT INTO session_event_seq (session_id, next_seq)
          VALUES ($1, 1)
          ON CONFLICT (session_id) DO NOTHING
          `,
          [session_id]
        );
      } catch (e: unknown) {
        const msg = pgErrorMessage(e);
        if (!/relation .*session_event_seq.* does not exist/i.test(msg)) throw e;
      }
    }

    await client.query("COMMIT");

    // Status semantics:
    // - Without session: preserve old behavior (201 if new block else 200)
    // - With session: a new session was created => 201
    const status = create_session ? 201 : created_block ? 201 : 200;

    const payload: any = {
      block_id: persisted_block_id,
      engine_version,
      canonical_hash
    };
    if (session_id) payload.session_id = session_id;

    return res.status(status).json(payload);
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}

/**
 * GET /blocks/:block_id
 */
export async function getBlock(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) return res.status(400).json({ error: "Missing block_id" });

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

  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "Block not found" });

  const row = r.rows[0];
  const p2c: any = (row as any).phase2_canonical;

  return res.json({
    ...row,
    phase2_canonical_json:
      typeof p2c?.phase2_canonical_json === "string" ? p2c.phase2_canonical_json : undefined,
    phase2_hash: typeof p2c?.phase2_hash === "string" ? p2c.phase2_hash : undefined
  });
}

export async function createSessionFromBlock(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) return res.status(400).json({ error: "Missing block_id" });

  const planned = req.body?.planned_session as Phase6SessionOutput | undefined;
  if (!planned || typeof planned !== "object") {
    return res.status(400).json({ error: "Missing planned_session" });
  }

  const b = await pool.query(`SELECT block_id FROM blocks WHERE block_id = $1`, [block_id]);
  if ((b.rowCount ?? 0) === 0) return res.status(404).json({ error: "Block not found" });

  const session_id = id("s");
  const plannedToStore = { ...planned, session_id };

  try {
    await pool.query(
      `
      INSERT INTO sessions (session_id, status, planned_session, block_id)
      VALUES ($1, 'created', $2::jsonb, $3)
      `,
      [session_id, JSON.stringify(plannedToStore), block_id]
    );

    // session_event_seq init if table exists
    try {
      await pool.query(
        `
        INSERT INTO session_event_seq (session_id, next_seq)
        VALUES ($1, 1)
        ON CONFLICT (session_id) DO NOTHING
        `,
        [session_id]
      );
    } catch (e: unknown) {
      const msg = pgErrorMessage(e);
      if (!/relation .*session_event_seq.* does not exist/i.test(msg)) throw e;
    }

    return res.status(201).json({ session_id });
  } catch (err: unknown) {
    return res.status(400).json({ error: pgErrorMessage(err) });
  }
}

export async function listBlockSessions(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) return res.status(400).json({ error: "Missing block_id" });

  const r = await pool.query(
    `
    SELECT session_id, status, created_at, updated_at
    FROM sessions
    WHERE block_id = $1
    ORDER BY created_at ASC
    `,
    [block_id]
  );

  return res.json({ block_id, sessions: r.rows });
}

