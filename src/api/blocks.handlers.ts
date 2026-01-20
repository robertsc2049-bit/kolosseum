// src/api/blocks.handlers.ts
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { pool } from "../db/pool.js";

import type { Phase6SessionOutput } from "../../engine/src/phases/phase6.js";

import { phase1Validate } from "../../engine/src/phases/phase1.js";
import { phase2CanonicaliseAndHash } from "../../engine/src/phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "../../engine/src/phases/phase3.js";
import { phase4AssembleProgram } from "../../engine/src/phases/phase4.js";

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

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function pgErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    if (typeof anyErr.message === "string" && anyErr.message.length > 0) return anyErr.message;
    if (typeof anyErr.detail === "string" && anyErr.detail.length > 0) return anyErr.detail;
  }
  return String(err);
}

/**
 * POST /blocks/compile
 * The ONLY block creation path.
 *
 * Behavior:
 * - Validates Phase1 input
 * - Computes deterministic Phase2 hash
 * - Resolves Phase3 + assembles Phase4 program
 * - Persists block idempotently by canonical_hash
 * - Returns 201 if created, 200 if updated (already existed)
 */
export async function compileBlock(req: Request, res: Response) {
  const bodyUnknown = req.body as unknown;

  if (!isRecord(bodyUnknown)) {
    return res.status(400).json({ error: "Missing body" });
  }

  const body = bodyUnknown as CompileBlockBody;

  if (!Object.prototype.hasOwnProperty.call(body, "phase1_input")) {
    return res.status(400).json({ error: "Missing phase1_input" });
  }

  const engine_version = asString(body.engine_version) ?? "EB2-1.0.0";
  const apply_phase5 = body.apply_phase5 === true;

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

  // ---- Persist block (IDEMPOTENT by canonical_hash) ----
  // If canonical_hash already exists, we UPDATE and return the existing block_id.
  const new_block_id = id("b");

  const phase2_canonical_payload = {
    phase2_canonical_json: p2.phase2.phase2_canonical_json,
    phase2_hash: p2.phase2.phase2_hash,
    canonical_input_hash: p2.phase2.canonical_input_hash
  };

  try {
    const r = await pool.query(
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

    const persisted_block_id = asString(r.rows?.[0]?.block_id) ?? new_block_id;
    const created = persisted_block_id === new_block_id;

    return res.status(created ? 201 : 200).json({
      block_id: persisted_block_id,
      engine_version,
      canonical_hash
    });
  } catch (err: unknown) {
    return res.status(400).json({ error: pgErrorMessage(err) });
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

/**
 * POST /blocks/:block_id/sessions
 * Sessions are always block-backed.
 */
export async function createSessionFromBlock(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) return res.status(400).json({ error: "Missing block_id" });

  const planned = req.body?.planned_session as Phase6SessionOutput | undefined;
  if (!planned || typeof planned !== "object") {
    return res.status(400).json({ error: "Missing planned_session" });
  }

  const b = await pool.query(`SELECT block_id FROM blocks WHERE block_id = $1`, [block_id]);
  if ((b.rowCount ?? 0) === 0) return res.status(404).json({ error: "Block not found" });

  const session_id =
    typeof (planned as any).session_id === "string" && (planned as any).session_id.length > 0
      ? (planned as any).session_id
      : id("s");

  const plannedToStore = { ...planned, session_id };

  try {
    await pool.query(
      `
      INSERT INTO sessions (session_id, status, planned_session, block_id)
      VALUES ($1, 'not_started', $2::jsonb, $3)
      ON CONFLICT (session_id) DO NOTHING
      `,
      [session_id, JSON.stringify(plannedToStore), block_id]
    );

    return res.status(201).json({ session_id });
  } catch (err: unknown) {
    return res.status(400).json({ error: pgErrorMessage(err) });
  }
}

/**
 * GET /blocks/:block_id/sessions
 */
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

