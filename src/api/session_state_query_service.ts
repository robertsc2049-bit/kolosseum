/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/session_state_query_service.ts
import { pool } from "../db/pool.js";

import {
  deriveTrace,
  normalizeSummary
} from "@kolosseum/engine/runtime/session_summary.js";

import { notFound } from "./http_errors.js";
import {
  type PlannedSession,
  ensureReturnDecisionContract,
  loadSessionStateRow,
  projectSessionStatePayload,
  readCachedSessionState,
  writeCachedSessionState
} from "./session_state_read_model.js";

export async function getSessionStateQuery(session_id: string) {
  const cached = readCachedSessionState(session_id);
  if (cached) return cached;

  const client = await pool.connect();
  try {
    const row = await loadSessionStateRow(client, session_id);
    if (!row) throw notFound("Session not found");

    const planned = row.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, row.session_state_summary);

    const upgraded = ensureReturnDecisionContract(normalized, deriveTrace);
    const shouldPersist = needsUpgrade || upgraded.changed;

    if (shouldPersist) {
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(upgraded.summary)]
      );
    }

    const derivedTrace = deriveTrace(upgraded.summary as any) as any;
    const payload = projectSessionStatePayload(session_id, planned, upgraded.summary, derivedTrace);

    writeCachedSessionState(session_id, payload);
    return payload;
  } finally {
    client.release();
  }
}