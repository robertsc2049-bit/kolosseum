// src/api/blocks.handlers.ts
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { pool } from "../db/pool.js";

import type { Phase6SessionOutput } from "../../engine/src/phases/phase6.js";

import { phase1Validate } from "../../engine/src/phases/phase1.js";
import { phase2CanonicaliseAndHash } from "../../engine/src/phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "../../engine/src/phases/phase3.js";
import { phase4AssembleProgram } from "../../engine/src/phases/phase4.js";

type CreateBlockBody = {
  engine_version: string;
  canonical_hash: string;
  phase1_input: unknown;
  phase2_canonical: unknown;
  phase3_output: unknown;
  phase4_program: unknown;
  phase5_adjustments?: unknown;
};

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

  // ---- Persist block ----
  const block_id = id("b");

  try {
    await pool.query(
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
      `,
      [
        block_id,
        engine_version,
        canonical_hash,
        JSON.stringify(canonical_input),
        JSON.stringify({
  phase2_canonical_json: p2.phase2.phase2_canonical_json,
  phase2_hash: p2.phase2.phase2_hash,
  canonical_input_hash: p2.phase2.canonical_input_hash
}),

        JSON.stringify(p3.phase3),
        JSON.stringify(p4.program),
        JSON.stringify(phase5_adjustments)
      ]
    );

    return res.status(201).json({ block_id, engine_version, canonical_hash });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function createBlock(req: Request, res: Response) {
  const body = req.body as Partial<CreateBlockBody> | undefined;

  if (!isRecord(body)) return res.status(400).json({ error: "Missing body" });

  const engine_version = asString(body.engine_version);
  if (!engine_version) return res.status(400).json({ error: "Missing engine_version" });

  const canonical_hash = asString(body.canonical_hash);
  if (!canonical_hash) return res.status(400).json({ error: "Missing canonical_hash" });

  if (!("phase1_input" in body)) return res.status(400).json({ error: "Missing phase1_input" });
  if (!("phase2_canonical" in body)) return res.status(400).json({ error: "Missing phase2_canonical" });
  if (!("phase3_output" in body)) return res.status(400).json({ error: "Missing phase3_output" });
  if (!("phase4_program" in body)) return res.status(400).json({ error: "Missing phase4_program" });

  const block_id = id("b");
  const phase5_adjustments = Array.isArray(body.phase5_adjustments) ? body.phase5_adjustments : [];

  try {
    await pool.query(
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
      `,
      [
        block_id,
        engine_version,
        canonical_hash,
        JSON.stringify(body.phase1_input),
        (() => {
  const p2c = body.phase2_canonical as any;
  // If caller passes Phase2Canonical from engine, strip bytes.
  if (p2c && typeof p2c === "object") {
    if (typeof p2c.phase2_canonical_json === "string" && typeof p2c.phase2_hash === "string") {
      return JSON.stringify({
        phase2_canonical_json: p2c.phase2_canonical_json,
        phase2_hash: p2c.phase2_hash,
        canonical_input_hash: typeof p2c.canonical_input_hash === "string" ? p2c.canonical_input_hash : p2c.phase2_hash
      });
    }
  }
  return JSON.stringify(body.phase2_canonical);
})(),
        JSON.stringify(body.phase3_output),
        JSON.stringify(body.phase4_program),
        JSON.stringify(phase5_adjustments)
      ]
    );

    return res.status(201).json({ block_id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

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

// phase2_canonical is jsonb; pg gives it back as object already (usually).
const p2c: any = (row as any).phase2_canonical;

return res.json({
  ...row,
  phase2_canonical_json: typeof p2c?.phase2_canonical_json === "string" ? p2c.phase2_canonical_json : undefined,
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
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
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







