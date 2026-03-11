/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/block_session_query_service.ts
import { pool } from "../db/pool.js";

export async function listBlockSessionsQuery(block_id: string) {
  const r = await pool.query(
    `
    SELECT session_id, status, created_at, updated_at
    FROM sessions
    WHERE block_id = $1
    ORDER BY created_at ASC
    `,
    [block_id]
  );

  return { block_id, sessions: r.rows };
}