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
