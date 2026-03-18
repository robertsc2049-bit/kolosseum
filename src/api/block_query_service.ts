// src/api/block_query_service.ts
import { pool } from "../db/pool.js";

type PersistedBlockReadback = {
  block_id: string;
  created_at: string;
  engine_version: string;
  canonical_hash: string;
  phase1_input: unknown;
  phase2_canonical: unknown;
  phase3_output: unknown;
  phase4_program: unknown;
  phase5_adjustments: unknown;
  phase2_canonical_json?: string;
  phase2_hash?: string;
};

export async function getBlockByIdQuery(block_id: string): Promise<PersistedBlockReadback | null> {
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

  if ((r.rowCount ?? 0) === 0) return null;

  const row = r.rows[0] as Record<string, unknown>;
  const p2c = row.phase2_canonical as Record<string, unknown> | null | undefined;

  return {
    ...(row as PersistedBlockReadback),
    phase2_canonical_json:
      typeof p2c?.phase2_canonical_json === "string" ? p2c.phase2_canonical_json : undefined,
    phase2_hash:
      typeof p2c?.phase2_hash === "string" ? p2c.phase2_hash : undefined
  };
}