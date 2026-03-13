/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/engine_run_persistence_service.ts
import { pool } from "../db/pool.js";
import crypto from "node:crypto";

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

async function ensureEngineRunsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS engine_runs (
      id          text PRIMARY KEY,
      kind        text NOT NULL,
      input_hash  text NOT NULL,
      input       jsonb NOT NULL,
      output      jsonb NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS engine_runs_kind_created_at_idx
    ON engine_runs(kind, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS engine_runs_input_hash_idx
    ON engine_runs(input_hash);
  `);
}

export async function persistEngineRunBestEffort(kind: string, input: any, output: any): Promise<void> {
  try {
    await ensureEngineRunsTable();

    const inputJson = JSON.stringify(input);
    const outputJson = JSON.stringify(output);
    const inputHash = sha256Hex(inputJson);
    const id = `er_${crypto.randomUUID().replace(/-/g, "")}`;

    await pool.query(
      `INSERT INTO engine_runs (id, kind, input_hash, input, output)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [id, kind, inputHash, inputJson, outputJson]
    );
  } catch {
    // best-effort
  }
}