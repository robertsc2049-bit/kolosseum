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

export function loadActivityChangeState(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/activity-change");
}

export function requestActivityChange(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("PATCH", "/account/onboarding/activity", input, csrfToken);
}

export function respondToActivityChangeProposal(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/onboarding/activity-proposal-response", input, csrfToken);
}

export function cancelActivityChange(requestId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/onboarding/activity-proposal-cancel", { request_id: requestId }, csrfToken);
}

// The athlete's programme: fixed exercises, open slots (with what may fill
// each) and their current choices.
export function loadProgrammeExercises(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/exercises");
}

export type CustomExercise = { exercise_id: string; display_name: string };

export function saveProgrammeExercises(selections: Record<string, string>, customExercises: CustomExercise[], csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/account/onboarding/exercises", { selections, custom_exercises: customExercises }, csrfToken);
}

// Pain carry-forward: open pain flags and the "how is it now?" check-in the
// athlete answers before a session that loads the same area.
export function loadPainFlags(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/pain-flags");
}

export function savePainCheckIn(
  input: { flag_key: string; status: "pain_free" | "still_sore"; plan?: "swap" | "skip" },
  csrfToken: string
): Promise<JsonRecord> {
  return request("POST", "/account/onboarding/pain-flags/check-in", input, csrfToken);
}

// Medical stand-down (e.g. after a head injury).
export function loadStandDown(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/stand-down");
}

export function recordStandDown(input: { reason: "head_injury" | "medical"; until_date: string }, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/onboarding/stand-down", input, csrfToken);
}

export function endStandDown(csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/onboarding/stand-down/end", { cleared_by_medical_professional: true }, csrfToken);
}
