// DEV NOTE: FULL-UI-65 coach branding transport (React port of
// coach_branding_ui.js's loadCoachBrandPreference()/saveCoachBrandPreference()
// calls, previously in account_ui.js). Read-only coach_branding_athlete_view
// (the athlete-facing "My coach" card) is a separate, still-legacy feature
// fed via the relationship endpoint - untouched by this client.
import { type JsonRecord, request } from "./transport";

export function loadCoachBrandPreference(): Promise<JsonRecord> {
  return request("GET", "/coach-branding");
}

export function saveCoachBrandPreference(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/coach-branding", input, csrfToken);
}
