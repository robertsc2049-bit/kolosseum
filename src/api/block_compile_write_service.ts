// src/api/block_compile_write_service.ts
import crypto from "node:crypto";
import { pool } from "../db/pool.js";

type PersistCompileBlockArgs = {
  engine_version: string;
  canonical_hash: string;
  canonical_input: unknown;
  phase2_canonical_payload: unknown;
  phase3_output: unknown;
  phase4_program: unknown;
  phase5_adjustments: unknown[];
  planned_session_from_engine: unknown;
  create_session: boolean;
};

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function persistCompiledBlockAndMaybeCreateSession(args: PersistCompileBlockArgs) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const new_block_id = id("b");

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
        args.engine_version,
        args.canonical_hash,
        JSON.stringify(args.canonical_input),
        JSON.stringify(args.phase2_canonical_payload),
        JSON.stringify(args.phase3_output),
        JSON.stringify(args.phase4_program),
        JSON.stringify(args.phase5_adjustments)
      ]
    );

    const persisted_block_id = asString(br.rows?.[0]?.block_id) ?? new_block_id;
    const created_block = persisted_block_id === new_block_id;

    let session_id: string | undefined;

    if (args.create_session) {
      session_id = id("s");
      const plannedToStore = { ...(args.planned_session_from_engine as any), session_id };

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

    return {
      persisted_block_id,
      created_block,
      session_id
    };
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}