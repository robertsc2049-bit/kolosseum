// DEV NOTE: FULL-UI-36 athlete's own progress insights - a separate API
// area from coach-workspace, hence its own client file. Read-only,
// computed server-side from the athlete's own session/strength/habit/
// body-metric history - identity is resolved from the session cookie, no
// athlete_user_id needed (unlike the coach-facing mirror route).

import { type JsonRecord, request } from "./transport";

export async function loadProgressInsights(): Promise<JsonRecord | null> {
  const response = await request("GET", "/progress-insights");
  return response.insights && typeof response.insights === "object" ? (response.insights as JsonRecord) : null;
}
