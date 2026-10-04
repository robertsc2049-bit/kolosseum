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

// Today's optional readiness check-in (sleep, soreness, stress; 1 poor - 5 great).
export function loadReadiness(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/readiness");
}

export function saveReadiness(input: { sleep: number; soreness: number; stress: number }, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/account/onboarding/readiness", input, csrfToken);
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

// The equipment a self-directed athlete has (a full gym until they say).
export function loadAthleteEquipment(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/equipment");
}

export function saveAthleteEquipment(input: { full_gym: true } | { available_equipment: string[] }, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/account/onboarding/equipment", input, csrfToken);
}

// The athlete's match week: usual match/race/key-session days plus one-off fixtures.
// A fighter's weight class: fight-camp loading in the 4 weeks before a fight.
export function loadWeightClass(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/weight-class");
}

export function saveWeightClass(input: { competes_at_weight_class: boolean; weight_class_kg: number | null }, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/account/onboarding/weight-class", input, csrfToken);
}

export function loadMatchWeek(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/match-week");
}

export function saveMatchWeek(input: { match_days: string[]; fixtures: Array<{ date: string; label: string }> }, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/account/onboarding/match-week", input, csrfToken);
}

// A self-directed athlete's own maxes, so "% of 1RM" work becomes a weight.
export function loadAthleteMaxes(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/maxes");
}

export function saveAthleteMaxes(input: { preferred_weight_unit: "kg" | "lb"; maxes: JsonRecord[]; loading_method?: "progression" | "percent_1rm" | "rpe" }, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/account/onboarding/maxes", input, csrfToken);
}

// Kolosseum programmes that suit the athlete, and the one they're running.
export function loadAthleteProgrammes(): Promise<JsonRecord> {
  return request("GET", "/account/onboarding/programmes");
}

// Start a programme (its listing id), or stop the current one (null).
export function setAthleteProgramme(listingId: string | null, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/account/onboarding/programme", { listing_id: listingId }, csrfToken);
}
