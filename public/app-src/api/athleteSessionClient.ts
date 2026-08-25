// DEV NOTE: athlete-facing Today screen (FULL-UI-14C) - a separate API
// area from coach-workspace, hence its own client file. Session execution
// itself (create/start/complete a session, Session view) stays fully
// legacy for now; this client only covers the two read-only endpoints
// Today's own display needs.

import { type JsonRecord, request } from "./transport";

export async function loadAthleteTodaySnapshot(athleteUserId: string): Promise<JsonRecord> {
  return request("POST", "/sessions/beta-athlete-today", { athlete_user_id: athleteUserId });
}

export async function loadAthleteSessionState(sessionId: string): Promise<JsonRecord> {
  return request("GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
}
