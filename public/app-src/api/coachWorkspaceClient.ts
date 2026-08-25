// DEV NOTE: coach_athlete_detail React sub-panels (athlete strength-profile
// editor, progress insights). coach_user_id is derived server-side from the
// session on every route below (see src/api/coach_workspace.handlers.ts's
// and src/api/progress_insights.routes.ts's authenticatedCoach calls) - the
// client only ever needs to send athlete_user_id.

import { type JsonRecord, request } from "./transport";

export function loadAthleteStrengthProfile(athleteUserId: string): Promise<JsonRecord> {
  return request(
    "GET",
    `/coach-workspace/athlete-strength-profile?athlete_user_id=${encodeURIComponent(athleteUserId)}`
  );
}

export function saveAthleteStrengthProfile(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/coach-workspace/athlete-strength-profile", input, csrfToken);
}

export async function loadTemplateExercises(): Promise<JsonRecord[]> {
  const response = await request("GET", "/templates/exercises");
  return Array.isArray(response.exercises) ? (response.exercises as JsonRecord[]) : [];
}

export async function loadAthleteProgressInsights(athleteUserId: string): Promise<JsonRecord | null> {
  const response = await request("GET", `/progress-insights/coach/${encodeURIComponent(athleteUserId)}`);
  return response.insights && typeof response.insights === "object" ? (response.insights as JsonRecord) : null;
}

export async function loadAthleteWeeklyCheckins(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/weekly-checkins/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.checkins) ? (response.checkins as JsonRecord[]) : [];
}

export async function loadAthleteGoals(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/athlete-goals/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.goals) ? (response.goals as JsonRecord[]) : [];
}

export async function loadAthleteDeviceConnections(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/device-sync/connections/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.connections) ? (response.connections as JsonRecord[]) : [];
}

export async function loadAthleteDeviceMetrics(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/device-sync/metrics/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.entries) ? (response.entries as JsonRecord[]) : [];
}

export async function loadAthleteBodyMetrics(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/body-metrics/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.entries) ? (response.entries as JsonRecord[]) : [];
}

export function saveAthleteBodyMetric(
  athleteUserId: string,
  input: JsonRecord,
  csrfToken: string
): Promise<JsonRecord> {
  return request("POST", `/body-metrics/coach/${encodeURIComponent(athleteUserId)}`, input, csrfToken);
}

export async function loadAthleteProgressPhotos(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/progress-photos/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.photos) ? (response.photos as JsonRecord[]) : [];
}

// DEV NOTE: note_history is one field of the same composite
// /coach-workspace/athlete-detail response that also carries assignment/
// strength/bodyweight/event/session history - those stay legacy (rendered
// by app.js's renderAthleteDetail), so this fetches the same endpoint
// independently and reads out only note_history. See
// AthleteCoachNotesPanel.tsx's DEV NOTE for why note *creation* stays
// legacy too.
export async function loadAthleteCoachNotes(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request(
    "GET",
    `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`
  );
  const detail = response.detail && typeof response.detail === "object" ? (response.detail as JsonRecord) : {};
  return Array.isArray(detail.note_history) ? (detail.note_history as JsonRecord[]) : [];
}
