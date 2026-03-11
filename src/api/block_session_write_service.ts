/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/block_session_write_service.ts
import { pool } from "../db/pool.js";
import { badRequest, notFound } from "./http_errors.js";

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

import crypto from "node:crypto";
import type { Phase6SessionOutput } from "@kolosseum/engine/phases/phase6.js";

export async function createSessionFromBlockMutation(
  block_id: string,
  planned_session: Phase6SessionOutput
) {
  if (!block_id) throw badRequest("Missing block_id");
  if (!planned_session || typeof planned_session !== "object") {
    throw badRequest("Missing planned_session");
  }

  const b = await pool.query(`SELECT block_id FROM blocks WHERE block_id = $1`, [block_id]);
  if ((b.rowCount ?? 0) === 0) throw notFound("Block not found");

  const session_id = id("s");
  const plannedToStore = { ...planned_session, session_id };

  await pool.query(
    `
    INSERT INTO sessions (session_id, status, planned_session, block_id)
    VALUES ($1, 'created', $2::jsonb, $3)
    `,
    [session_id, JSON.stringify(plannedToStore), block_id]
  );

  try {
    await pool.query(
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

  return { session_id };
}