// DEV NOTE: V1 onboarding start gate. This module binds executable-session
// entry to explicit account, relationship, and declaration state. It reuses
// existing product-state contracts and never mutates engine truth.

import { isAcceptedIndividualCoachAthleteRelationship } from "./coachAthleteRelationshipAcceptance.mjs";
import {
  assertPhase1DeclarationCompileGate,
  stablePhase1DeclarationJson
} from "./phase1DeclarationSurface.mjs";
import { assertOnboardingStarted } from "../shared/pilot-lifecycle/onboardingStartGateContract.mjs";

export const onboardingStartGateSurfaceId = "onboarding_start_gate";
export const onboardingStartGateVersion = "1.0.0";

export const onboardingStartGateBlockedReasons = Object.freeze([
  "onboarding_start_trigger_missing",
  "onboarding_start_trigger_invalid",
  "athlete_account_missing",
  "athlete_account_inactive",
  "coach_athlete_relationship_missing",
  "coach_athlete_relationship_not_accepted",
  "phase1_declaration_missing",
  "phase1_declaration_not_current_valid"
]);

export class OnboardingStartGateError extends Error {
  constructor(blockedReasons, details = {}) {
    super("onboarding_start_gate_blocked");
    this.code = "onboarding_start_gate_blocked";
    this.blocked_reasons = Object.freeze([...blockedReasons]);
    this.details = Object.freeze({ ...details });
    this.product_onboarding_state_only = true;
    this.engine_visible = false;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueInOrder(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
  }

  return output;
}

function assertKnownBlockedReasons(blockedReasons) {
  for (const reason of blockedReasons) {
    if (!onboardingStartGateBlockedReasons.includes(reason)) {
      throw new Error("onboarding_start_gate_blocked_reason_unknown:" + String(reason));
    }
  }
}

function isActiveAthleteAccount(account, athleteUserId) {
  return (
    isRecord(account) &&
    account.athlete_user_id === athleteUserId &&
    account.account_role === "athlete" &&
    account.account_state === "active" &&
    account.product_auth_state_only === true &&
    account.engine_visible === false
  );
}

function getRelationshipsForAthlete(relationships, athleteUserId) {
  if (!Array.isArray(relationships)) {
    return [];
  }

  return relationships.filter((relationship) => (
    isRecord(relationship) &&
    relationship.athlete_user_id === athleteUserId
  ));
}

function hasAcceptedIndividualRelationship(relationships, athleteUserId) {
  return getRelationshipsForAthlete(relationships, athleteUserId)
    .some((relationship) => isAcceptedIndividualCoachAthleteRelationship(relationship));
}

/**
 * FUNCTION NOTE:
 * Export: resolveOnboardingStartGate
 * Purpose: Resolves whether an athlete may enter executable-session flow.
 * Inputs: Explicit onboarding events, athlete account, relationship records, declaration record, and phase-like probe input.
 * Output: Frozen allowed/blocked result with factual blocked reason ids only.
 * Boundary: Product/app validity only; does not run engine phases, persist, assign, substitute, or mutate declarations.
 * Determinism: Same explicit input returns the same allowed/blocked result.
 * Failure: Missing or invalid required state returns factual blocked reasons; unknown blocked reasons hard-fail.
 */
export function resolveOnboardingStartGate(input = {}) {
  if (!isRecord(input)) {
    return Object.freeze({
      ok: false,
      allowed: false,
      surface_id: onboardingStartGateSurfaceId,
      version: onboardingStartGateVersion,
      blocked_reasons: Object.freeze(["onboarding_start_trigger_invalid"]),
      product_onboarding_state_only: true,
      engine_visible: false
    });
  }

  const blockedReasons = [];

  try {
    assertOnboardingStarted(input.onboarding_events);
  } catch (error) {
    const message = String(error?.message || error);
    blockedReasons.push(
      message.includes("not_triggered")
        ? "onboarding_start_trigger_missing"
        : "onboarding_start_trigger_invalid"
    );
  }

  const athleteUserId = typeof input.athlete_user_id === "string" ? input.athlete_user_id.trim() : "";

  if (!isRecord(input.athlete_account)) {
    blockedReasons.push("athlete_account_missing");
  } else if (!isActiveAthleteAccount(input.athlete_account, athleteUserId)) {
    blockedReasons.push("athlete_account_inactive");
  }

  const athleteRelationships = getRelationshipsForAthlete(input.relationship_records, athleteUserId);

  if (athleteRelationships.length === 0) {
    blockedReasons.push("coach_athlete_relationship_missing");
  } else if (!hasAcceptedIndividualRelationship(athleteRelationships, athleteUserId)) {
    blockedReasons.push("coach_athlete_relationship_not_accepted");
  }

  let compileGateResult = null;

  if (!isRecord(input.declaration_record)) {
    blockedReasons.push("phase1_declaration_missing");
  } else {
    try {
      compileGateResult = assertPhase1DeclarationCompileGate({
        phase_like_input: input.phase_like_input,
        declaration_record: input.declaration_record
      });
    } catch {
      blockedReasons.push("phase1_declaration_not_current_valid");
    }
  }

  const uniqueBlockedReasons = Object.freeze(uniqueInOrder(blockedReasons));
  assertKnownBlockedReasons(uniqueBlockedReasons);

  if (uniqueBlockedReasons.length > 0) {
    return Object.freeze({
      ok: false,
      allowed: false,
      surface_id: onboardingStartGateSurfaceId,
      version: onboardingStartGateVersion,
      blocked_reasons: uniqueBlockedReasons,
      product_onboarding_state_only: true,
      engine_visible: false
    });
  }

  return Object.freeze({
    ok: true,
    allowed: true,
    surface_id: onboardingStartGateSurfaceId,
    version: onboardingStartGateVersion,
    blocked_reasons: Object.freeze([]),
    compile_admission: compileGateResult.compile_admission,
    declaration_payload_sha256: compileGateResult.declaration_payload_sha256,
    compile_probe_output: compileGateResult.compile_probe_output,
    product_onboarding_state_only: true,
    engine_visible: false
  });
}

/**
 * FUNCTION NOTE:
 * Export: assertOnboardingStartGateAllowsExecutableSessionFlow
 * Purpose: Throws unless the onboarding start gate permits executable-session flow.
 * Inputs: Same explicit input as resolveOnboardingStartGate.
 * Output: true or OnboardingStartGateError.
 * Boundary: Assertion wrapper only; it does not mutate product records or engine state.
 * Determinism: Same explicit input returns the same result or blocked error.
 * Failure: Blocked result throws with exact factual blocked reason ids.
 */
export function assertOnboardingStartGateAllowsExecutableSessionFlow(input = {}) {
  const result = resolveOnboardingStartGate(input);

  if (!result.allowed) {
    throw new OnboardingStartGateError(result.blocked_reasons, {
      surface_id: result.surface_id,
      version: result.version
    });
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: compileIgnoringOnboardingStartGate
 * Purpose: Test helper proving onboarding gate state is not engine truth.
 * Inputs: Phase-like input plus any product onboarding records.
 * Output: Stable JSON for the phase-like input only.
 * Boundary: This is not the real compiler and must not call or mimic engine internals.
 * Determinism: Same phase-like input returns the same string regardless of onboarding records.
 * Failure: Serialization failure may throw rather than fabricate fallback output.
 */
export function compileIgnoringOnboardingStartGate(phaseLikeInput, onboardingRecords = []) {
  void onboardingRecords;
  return stablePhase1DeclarationJson(phaseLikeInput);
}
