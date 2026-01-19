import type { Request, Response } from "express";
import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import type { Phase6SessionOutput } from "../../engine/src/phases/phase6.js";

type BlockRow = {
  block_id: string;
  created_at: string;
  engine_version: string;
  canonical_hash: string;

  phase1_input: unknown;
  phase2_canonical: unknown;
  phase3_output: unknown;
  phase4_program: unknown;
  phase5_adjustments: unknown;
};

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function createBlock(req: Request, res: Response) {
  const engine_version =
    typeof req.body?.engine_version === "string" && req.body.engine_version.length > 0
      ? req.body.engine_version
      : "EB2-1.0.0";

  const phase1_input = req.body?.phase1_input;
  if (phase1_input === undefined) {
    return res.status(400).json({ error: "Missing phase1_input" });
  }

  const block_id = makeId("b");

  // For now, canonical_hash is a stable hash of the submitted phase1_input JSON.
  // Next ticket: hash phase2 canonical output per spec once engine execution is wired.
  const phase1Json = JSON.stringify(phase1_input);
  const canonical_hash = sha256Hex(phase1Json);

  // Placeholders for now — engine wiring comes next.
  const phase2_canonical = {};
  const phase3_output = {};
  const phase4_program = {};
  const phase5_adjustments: unknown[] = [];

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
        phase1Json,
        JSON.stringify(phase2_canonical),
        JSON.stringify(phase3_output),
        JSON.stringify(phase4_program),
        JSON.stringify(phase5_adjustments)
      ]
    );

    return res.status(201).json({ block_id, engine_version, canonical_hash });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function getBlock(req: Request, res: Response) {
  const { block_id } = req.params;

  if (!block_id || typeof block_id !== "string") {
    return res.status(400).json({ error: "Missing block_id" });
  }

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

  if ((r.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Block not found" });
  }

  const row = r.rows[0] as BlockRow;
  return res.json(row);
}

export async function createSessionForBlock(req: Request, res: Response) {
  const { block_id } = req.params;

  if (!block_id || typeof block_id !== "string") {
    return res.status(400).json({ error: "Missing block_id" });
  }

  const planned = req.body?.planned_session as Phase6SessionOutput | undefined;
  if (!planned || typeof planned !== "object") {
    return res.status(400).json({ error: "Missing planned_session" });
  }

  // Optional: allow caller to supply session_id; otherwise generate.
  const session_id =
    typeof (planned as any).session_id === "string" && (planned as any).session_id.length > 0
      ? (planned as any).session_id
      : makeId("s");

  // Ensure planned_session contains session_id.
  const plannedToStore = { ...planned, session_id };

  // Ensure block exists first.
  const b = await pool.query(`SELECT 1 FROM blocks WHERE block_id = $1`, [block_id]);
  if ((b.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Block not found" });
  }

  try {
    await pool.query(
      `
      INSERT INTO sessions (session_id, status, planned_session, block_id)
      VALUES ($1, 'not_started', $2::jsonb, $3)
      ON CONFLICT (session_id) DO NOTHING
      `,
      [session_id, JSON.stringify(plannedToStore), block_id]
    );

    return res.status(201).json({ session_id, block_id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function getSessionForBlock(req: Request, res: Response) {
  const { block_id, session_id } = req.params;

  if (!block_id || typeof block_id !== "string") {
    return res.status(400).json({ error: "Missing block_id" });
  }
  if (!session_id || typeof session_id !== "string") {
    return res.status(400).json({ error: "Missing session_id" });
  }

  const r = await pool.query(
    `
    SELECT session_id, status, block_id, planned_session, created_at, updated_at
    FROM sessions
    WHERE session_id = $1 AND block_id = $2
    `,
    [session_id, block_id]
  );

  if ((r.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Session not found" });
  }

  return res.json(r.rows[0]);
}
