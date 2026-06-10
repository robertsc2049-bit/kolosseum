/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/session_events_query_service.ts
import { pool } from "../db/pool.js";

export async function listRuntimeEventsQuery(session_id: string) {
  const r = await pool.query(
    `SELECT seq, event, created_at
     FROM runtime_events
     WHERE session_id = $1
     ORDER BY seq ASC`,
    [session_id]
  );

  return { session_id, events: r.rows };
}