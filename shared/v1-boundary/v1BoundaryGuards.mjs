/**
 * DEV NOTE:
 * Purpose: Defines explicit v1 boundary guard helpers before product flows depend on them.
 * Boundary: Product-only state must not become deterministic engine input or replay truth.
 * Determinism: The same explicit input must always produce the same pass result or failure token.
 * Failure: Throws stable v1 boundary tokens when forbidden fields or unsupported activity ids are present.
 */
const TOKEN_PREFIX = "v1_boundary_guard_";

const V1_SUPPORTED_ACTIVITIES = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

function fail(token, message) {
  const error = new Error(`${token}: ${message}`);
  error.code = token;
  throw error;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

/**
 * FUNCTION NOTE:
 * Export: assertRelationshipIsActive
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertRelationshipIsActive(input) {
  if (!input || input.relationshipState !== "relationship_active") {
    fail(`${TOKEN_PREFIX}relationship_not_active`, "relationship_active is required");
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertCoachCanViewAthlete
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertCoachCanViewAthlete(input) {
  assertRelationshipIsActive(input);

  if (!input.coachId || !input.athleteId) {
    fail(`${TOKEN_PREFIX}coach_athlete_identity_required`, "coachId and athleteId are required");
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertCoachCanAssignProgramme
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertCoachCanAssignProgramme(input) {
  assertCoachCanViewAthlete(input);

  if (!input.assignmentActivityId) {
    fail(`${TOKEN_PREFIX}assignment_activity_required`, "assignmentActivityId is required");
  }

  assertActivityIsV1Supported(input.assignmentActivityId);

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertAthleteOwnsDeclaration
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertAthleteOwnsDeclaration(input) {
  if (!input || !input.athleteId || !input.declarationAthleteId) {
    fail(`${TOKEN_PREFIX}declaration_identity_required`, "athleteId and declarationAthleteId are required");
  }

  if (input.athleteId !== input.declarationAthleteId) {
    fail(`${TOKEN_PREFIX}declaration_owner_mismatch`, "athlete must own declaration");
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertEngineInputIsCanonical
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertEngineInputIsCanonical(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail(`${TOKEN_PREFIX}engine_input_not_object`, "engine input must be an object");
  }

  if (!hasOwn(input, "activity_id")) {
    fail(`${TOKEN_PREFIX}engine_input_activity_required`, "engine input requires activity_id");
  }

  assertActivityIsV1Supported(input.activity_id);
  assertNoCoachNoteInEngineInput(input);
  assertNoBillingStateInEngineInput(input);
  assertNoUiStateInEngineInput(input);

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertNoCoachNoteInEngineInput
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertNoCoachNoteInEngineInput(input) {
  const forbiddenKeys = ["coach_note", "coach_notes", "coachNote", "coachNotes"];

  for (const key of forbiddenKeys) {
    if (hasOwn(input, key)) {
      fail(`${TOKEN_PREFIX}coach_note_in_engine_input`, "coach notes must remain engine-invisible");
    }
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertNoBillingStateInEngineInput
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertNoBillingStateInEngineInput(input) {
  const forbiddenKeys = ["billing", "billing_state", "billingState", "payment", "payment_state", "paymentState", "subscription", "subscription_state", "subscriptionState"];

  for (const key of forbiddenKeys) {
    if (hasOwn(input, key)) {
      fail(`${TOKEN_PREFIX}billing_state_in_engine_input`, "commercial access state is refused in deterministic input");
    }
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertNoUiStateInEngineInput
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertNoUiStateInEngineInput(input) {
  const forbiddenKeys = ["ui", "ui_state", "uiState", "presentation", "presentation_state", "presentationState", "selected_tab", "selectedTab", "drawer_state", "drawerState"];

  for (const key of forbiddenKeys) {
    if (hasOwn(input, key)) {
      fail(`${TOKEN_PREFIX}ui_state_in_engine_input`, "UI and presentation state must remain engine-invisible");
    }
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertRegistryIdIsKnown
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertRegistryIdIsKnown(registryId, knownIds) {
  if (!registryId) {
    fail(`${TOKEN_PREFIX}registry_id_required`, "registry id is required");
  }

  if (!Array.isArray(knownIds) || knownIds.length === 0) {
    fail(`${TOKEN_PREFIX}known_registry_ids_required`, "known registry ids are required");
  }

  if (!knownIds.includes(registryId)) {
    fail(`${TOKEN_PREFIX}unknown_registry_id`, `unknown registry id: ${registryId}`);
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertActivityIsV1Supported
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertActivityIsV1Supported(activityId) {
  if (!V1_SUPPORTED_ACTIVITIES.includes(activityId)) {
    fail(`${TOKEN_PREFIX}unsupported_activity`, `unsupported v1 activity: ${activityId}`);
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertSubstitutionEdgeIsAllowed
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertSubstitutionEdgeIsAllowed(input) {
  if (!input || !input.sourceExerciseId || !input.targetExerciseId || !input.substitutionEdgeId) {
    fail(`${TOKEN_PREFIX}substitution_edge_fields_required`, "sourceExerciseId, targetExerciseId, and substitutionEdgeId are required");
  }

  if (input.sourceActivityId) {
    assertActivityIsV1Supported(input.sourceActivityId);
  }

  if (input.targetActivityId) {
    assertActivityIsV1Supported(input.targetActivityId);
  }

  if (input.sourceActivityId && input.targetActivityId && input.sourceActivityId !== input.targetActivityId) {
    fail(`${TOKEN_PREFIX}substitution_crosses_activity`, "substitution edge cannot cross activity boundary");
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertCopyIdExists
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertCopyIdExists(copyId, knownCopyIds) {
  if (!copyId) {
    fail(`${TOKEN_PREFIX}copy_id_required`, "copy id is required");
  }

  if (!Array.isArray(knownCopyIds) || knownCopyIds.length === 0) {
    fail(`${TOKEN_PREFIX}known_copy_ids_required`, "known copy ids are required");
  }

  if (!knownCopyIds.includes(copyId)) {
    fail(`${TOKEN_PREFIX}unknown_copy_id`, `unknown copy id: ${copyId}`);
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertLiveViewIsReadOnly
 * Purpose: Documents the exported entrypoint for v1 boundary guard behaviour so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must preserve explicit boundary checks and must not widen activity, product-state, replay, or deterministic-input scope.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertLiveViewIsReadOnly(input) {
  if (!input || !input.action) {
    fail(`${TOKEN_PREFIX}live_view_action_required`, "live view action is required");
  }

  const allowedActions = ["view", "read", "status"];

  if (!allowedActions.includes(input.action)) {
    fail(`${TOKEN_PREFIX}live_view_not_read_only`, "live session view must remain read-only");
  }

  return true;
}

export { V1_SUPPORTED_ACTIVITIES, TOKEN_PREFIX };