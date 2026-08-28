// DEV NOTE: FULL-UI-03C athlete onboarding transport (React port). Ported
// from public/app/athlete_onboarding_ui.js's request()/loadAthleteOnboardingState/
// saveAthleteOnboardingDraft/confirmAthleteOnboarding/
// updateAthleteOnboardingPreferences - that file keeps its own copy of
// loadAthleteOnboardingState (and the request()/stored() helpers it needs)
// since resolveAthleteOnboardingGate() there must stay importable by
// route_bootstrap.js as plain JS, independent of this React bundle.

import { type JsonRecord, request } from "./transport";

export function loadAthleteOnboardingState(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/");
}

export function saveAthleteOnboardingDraft(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("PATCH", "/account/onboarding/draft", input, csrfToken);
}

export function confirmAthleteOnboarding(csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/onboarding/confirm", { review_confirmed: true }, csrfToken);
}

export function updateAthleteOnboardingPreferences(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("PATCH", "/account/onboarding/preferences", input, csrfToken);
}
