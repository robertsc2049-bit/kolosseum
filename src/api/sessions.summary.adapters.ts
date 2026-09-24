
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

import { pool } from "../db/pool.js";
import { ApiError } from "./http_errors.js";
import { listRuntimeEventsQuery } from "./session_events_query_service.js";
import { getSessionStateQuery } from "./session_state_query_service.js";

export type SessionOwnershipRow = {
  beta_subject_user_id: string | null;
  beta_coach_user_id: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function loadSessionOwnership(sessionId: string): Promise<SessionOwnershipRow | null> {
  const result = await pool.query(
    `SELECT beta_subject_user_id, beta_coach_user_id
     FROM sessions
     WHERE session_id = $1`,
    [sessionId]
  );

  return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
}

async function loadSessionUpdatedAtIso(sessionId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT updated_at FROM sessions WHERE session_id = $1`,
    [sessionId]
  );

  return (result.rowCount ?? 0) > 0 ? toIso(result.rows[0].updated_at) : null;
}

export const sessionSummaryStateStore = {
  async getSessionStateBySessionId(sessionId: string) {
    let statePayload: any;

    try {
      statePayload = await getSessionStateQuery(sessionId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }

    const trace = isRecord(statePayload.trace) ? statePayload.trace : {};
    const remainingIds: string[] = Array.isArray(trace.remaining_ids) ? (trace.remaining_ids as string[]) : [];
    const completedIds: string[] = Array.isArray(trace.completed_ids) ? (trace.completed_ids as string[]) : [];
    const droppedIds: string[] = Array.isArray(trace.dropped_ids) ? (trace.dropped_ids as string[]) : [];
    const executionStatus: string | undefined =
      typeof statePayload.execution_status === "string" ? statePayload.execution_status : undefined;

    // started_at_utc is deliberately left unset here: the session row's own
    // created_at marks when it was planned, not when it was started, so the
    // handler's existing fallback (first runtime event timestamp) is the
    // honest source. completed_at_utc has no such fallback, so it is derived
    // here from the row's updated_at once execution has actually completed.
    const completedAtUtc =
      executionStatus === "completed" ? await loadSessionUpdatedAtIso(sessionId) : null;

    return {
      session_id: String(statePayload.session_id),
      run_id: String(statePayload.session_id),
      execution_status: executionStatus,
      trace: {
        remaining_ids: remainingIds,
        completed_ids: completedIds,
        dropped_ids: droppedIds
      },
      planned_work_item_ids: [...completedIds, ...droppedIds, ...remainingIds],
      completed_at_utc: completedAtUtc
    };
  }
};

export const sessionSummaryEventsStore = {
  async listRuntimeEventsBySessionId(sessionId: string) {
    const { events } = await listRuntimeEventsQuery(sessionId);

    return (Array.isArray(events) ? events : []).map((row: any) => {
      const event = isRecord(row.event) ? row.event : {};
      return {
        event_type: typeof event.type === "string" ? event.type : undefined,
        timestamp_utc: toIso(row.created_at)
      };
    });
  }
};
