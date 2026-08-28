// DEV NOTE: FULL-UI-04C coach onboarding transport (React port). Ported
// from public/app/account_ui.js's loadCoachOnboardingState/
// saveCoachOnboardingProfile/acceptCoachOnboardingTerms/
// completeCoachOnboarding - account_ui.js keeps its own copy of
// loadCoachOnboardingState (the only one of these four still called from
// plain JS) since coach_onboarding_ui.js's resolveCoachOnboardingGate()
// must stay importable by route_bootstrap.js as plain JS, independent of
// this React bundle. The other three had zero remaining callers once this
// screen's mutations moved here, and were deleted from account_ui.js.

import { type JsonRecord, request } from "./transport";

export function loadCoachOnboardingState(): Promise<JsonRecord> {
  return request("GET", "/account/coach-onboarding");
}

export function saveCoachOnboardingProfile(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("PATCH", "/account/coach-onboarding/profile", input, csrfToken);
}

export function acceptCoachOnboardingTerms(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/coach-onboarding/terms", input, csrfToken);
}

export function completeCoachOnboarding(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/coach-onboarding/complete", input, csrfToken);
}
