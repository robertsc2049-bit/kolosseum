// DEV NOTE: athlete-facing training history (FULL-UI-16C) - a separate API
// area from coach-workspace, hence its own client file. Read-only: this
// screen never mutates a session, it only narrows which already-true rows
// are returned (server-side filtering, not a client-side re-filter).

import { type JsonRecord, request } from "./transport";

export type AthleteHistoryFilters = {
  status: string;
  date_from: string;
  date_to: string;
  activity_id: string;
  template_id: string;
  event_id: string;
};

export async function loadAthleteHistoryList(
  athleteUserId: string,
  filters?: Partial<AthleteHistoryFilters>
): Promise<JsonRecord> {
  return request("POST", "/sessions/beta-athlete-history", {
    athlete_user_id: athleteUserId,
    ...filters
  });
}

export async function loadAthleteHistoryDetail(athleteUserId: string, sessionId: string): Promise<JsonRecord> {
  return request("POST", "/sessions/beta-athlete-history-detail", {
    athlete_user_id: athleteUserId,
    session_id: sessionId
  });
}

export async function loadVideoFeedbackSubmissions(sessionId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/video-feedback/submissions?session_id=${encodeURIComponent(sessionId)}`);
  return Array.isArray(response.submissions) ? (response.submissions as JsonRecord[]) : [];
}
