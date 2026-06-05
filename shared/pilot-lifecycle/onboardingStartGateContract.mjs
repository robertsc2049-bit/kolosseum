/**
 * DEV NOTE:
 * Purpose: Defines the explicit gate for starting onboarding flow.
 * Boundary: Onboarding gate state must not bypass declaration or relationship requirements.
 * Determinism: The same declared inputs must produce the same start-gate result.
 * Failure: Missing required state must stop the gate rather than infer eligibility.
 */
/**
 * FUNCTION NOTE:
 * Export: ONBOARDING_START_TRIGGER_EVENTS
 * Purpose: Documents the exported entrypoint for onboarding start gate boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must not bypass declaration, relationship, or explicit gate requirements.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const ONBOARDING_START_TRIGGER_EVENTS = Object.freeze([
  "coach_invite_sent",
  "athlete_invite_sent",
  "link_acceptance_recorded",
  "phase1_declaration_started",
  "first_compile_attempt_started",
]);

/**
 * FUNCTION NOTE:
 * Export: ONBOARDING_START_TRIGGER_EVENT_SET
 * Purpose: Documents the exported entrypoint for onboarding start gate boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must not bypass declaration, relationship, or explicit gate requirements.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const ONBOARDING_START_TRIGGER_EVENT_SET = new Set(
  ONBOARDING_START_TRIGGER_EVENTS,
);

/**
 * FUNCTION NOTE:
 * Export: ONBOARDING_START_NON_TRIGGER_FACTS
 * Purpose: Documents the exported entrypoint for onboarding start gate boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must not bypass declaration, relationship, or explicit gate requirements.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const ONBOARDING_START_NON_TRIGGER_FACTS = Object.freeze([
  "commercialSatisfied",
  "workspaceProvisioned",
  "coachAccountProvisioned",
  "athleteAccountProvisioned",
  "linkAccepted",
  "scopeLocked",
  "phase1Accepted",
  "firstExecutableSessionCompiled",
  "activationSignalReceived",
  "pausedByOperator",
  "stoppedByOperator",
  "cancelledByOperator",
]);

function normalizeEventList(events = []) {
  if (!Array.isArray(events)) {
    throw new Error("onboarding_start_events_must_be_array");
  }

  const normalized = [];
  const seen = new Set();

  for (const eventName of events) {
    if (typeof eventName !== "string" || eventName.trim() === "") {
      throw new Error("onboarding_start_event_invalid:" + String(eventName));
    }

    if (!ONBOARDING_START_TRIGGER_EVENT_SET.has(eventName)) {
      throw new Error("onboarding_start_event_unknown:" + eventName);
    }

    if (!seen.has(eventName)) {
      seen.add(eventName);
      normalized.push(eventName);
    }
  }

  return Object.freeze(normalized);
}

function coerceContext(input = {}) {
  return {
    commercialSatisfied: input.commercialSatisfied === true,
    workspaceProvisioned: input.workspaceProvisioned === true,
    coachAccountProvisioned: input.coachAccountProvisioned === true,
    athleteAccountProvisioned: input.athleteAccountProvisioned === true,
    linkAccepted: input.linkAccepted === true,
    scopeLocked: input.scopeLocked === true,
    phase1Accepted: input.phase1Accepted === true,
    firstExecutableSessionCompiled: input.firstExecutableSessionCompiled === true,
    activationSignalReceived: input.activationSignalReceived === true,
    pausedByOperator: input.pausedByOperator === true,
    stoppedByOperator: input.stoppedByOperator === true,
    cancelledByOperator: input.cancelledByOperator === true,
  };
}

/**
 * FUNCTION NOTE:
 * Export: assertOnboardingStartedTriggerLawful
 * Purpose: Documents the exported entrypoint for onboarding start gate boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must not bypass declaration, relationship, or explicit gate requirements.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertOnboardingStartedTriggerLawful(eventName) {
  if (typeof eventName !== "string" || eventName.trim() === "") {
    throw new Error("onboarding_start_event_invalid:" + String(eventName));
  }

  if (!ONBOARDING_START_TRIGGER_EVENT_SET.has(eventName)) {
    throw new Error("onboarding_start_event_unknown:" + eventName);
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: resolveOnboardingStarted
 * Purpose: Documents the exported entrypoint for onboarding start gate boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must not bypass declaration, relationship, or explicit gate requirements.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function resolveOnboardingStarted(events = []) {
  return normalizeEventList(events).length > 0;
}

/**
 * FUNCTION NOTE:
 * Export: getOnboardingStartedTriggerEvents
 * Purpose: Documents the exported entrypoint for onboarding start gate boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must not bypass declaration, relationship, or explicit gate requirements.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function getOnboardingStartedTriggerEvents(events = []) {
  return normalizeEventList(events);
}

/**
 * FUNCTION NOTE:
 * Export: assertOnboardingStarted
 * Purpose: Documents the exported entrypoint for onboarding start gate boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must not bypass declaration, relationship, or explicit gate requirements.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertOnboardingStarted(events = []) {
  const normalized = normalizeEventList(events);

  if (normalized.length === 0) {
    throw new Error("onboarding_start_not_triggered");
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertOnboardingStartNotInferred
 * Purpose: Documents the exported entrypoint for onboarding start gate boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must not bypass declaration, relationship, or explicit gate requirements.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertOnboardingStartNotInferred(context = {}, events = []) {
  const c = coerceContext(context);
  const normalized = normalizeEventList(events);
  const onboardingStarted = resolveOnboardingStarted(normalized);

  const anyAmbientFactTrue =
    c.commercialSatisfied ||
    c.workspaceProvisioned ||
    c.coachAccountProvisioned ||
    c.athleteAccountProvisioned ||
    c.linkAccepted ||
    c.scopeLocked ||
    c.phase1Accepted ||
    c.firstExecutableSessionCompiled ||
    c.activationSignalReceived ||
    c.pausedByOperator ||
    c.stoppedByOperator ||
    c.cancelledByOperator;

  if (normalized.length === 0 && onboardingStarted) {
    throw new Error("onboarding_start_inference_forbidden");
  }

  if (normalized.length === 0 && anyAmbientFactTrue && onboardingStarted) {
    throw new Error("onboarding_start_inference_forbidden");
  }

  return true;
}