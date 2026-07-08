/**
 * DEV NOTE:
 * Purpose: Represents declaration acceptance state for onboarding and compile eligibility.
 * Boundary: Acceptance state must remain explicit and must not be created from product display state.
 * Determinism: The same declaration state must produce the same acceptance surface.
 * Failure: Unaccepted, superseded, or mismatched declarations must remain refused.
 */
/**
 * FUNCTION NOTE:
 * Export: DECLARATION_STATE
 * Purpose: Documents the exported entrypoint for declaration acceptance state boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must keep acceptance explicit and must not create accepted state from display state.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const DECLARATION_STATE = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  BLOCKED: "blocked",
  SUPERSEDED: "superseded",
});

/**
 * FUNCTION NOTE:
 * Export: DECLARATION_STATE_LIST
 * Purpose: Documents the exported entrypoint for declaration acceptance state boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must keep acceptance explicit and must not create accepted state from display state.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const DECLARATION_STATE_LIST = Object.freeze(
  Object.values(DECLARATION_STATE),
);

/**
 * FUNCTION NOTE:
 * Export: DECLARATION_ALLOWED_TRANSITIONS
 * Purpose: Documents the exported entrypoint for declaration acceptance state boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must keep acceptance explicit and must not create accepted state from display state.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const DECLARATION_ALLOWED_TRANSITIONS = Object.freeze({
  [DECLARATION_STATE.PENDING]: Object.freeze([
    DECLARATION_STATE.ACCEPTED,
    DECLARATION_STATE.BLOCKED,
    DECLARATION_STATE.SUPERSEDED,
  ]),
  [DECLARATION_STATE.ACCEPTED]: Object.freeze([
    DECLARATION_STATE.SUPERSEDED,
  ]),
  [DECLARATION_STATE.BLOCKED]: Object.freeze([
    DECLARATION_STATE.PENDING,
    DECLARATION_STATE.SUPERSEDED,
  ]),
  [DECLARATION_STATE.SUPERSEDED]: Object.freeze([]),
});

function assertKnownState(state, label) {
  if (!DECLARATION_STATE_LIST.includes(state)) {
    throw new Error(label + "_unknown:" + String(state));
  }
}

function coerceDeclarationContext(input = {}) {
  return {
    accepted: input.accepted === true,
    blocked: input.blocked === true,
    superseded: input.superseded === true,
  };
}

/**
 * FUNCTION NOTE:
 * Export: canTransitionDeclarationState
 * Purpose: Documents the exported entrypoint for declaration acceptance state boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must keep acceptance explicit and must not create accepted state from display state.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function canTransitionDeclarationState(fromState, toState) {
  assertKnownState(fromState, "declaration_state_from");
  assertKnownState(toState, "declaration_state_to");

  return DECLARATION_ALLOWED_TRANSITIONS[fromState].includes(toState);
}

/**
 * FUNCTION NOTE:
 * Export: assertDeclarationTransitionAllowed
 * Purpose: Documents the exported entrypoint for declaration acceptance state boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must keep acceptance explicit and must not create accepted state from display state.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertDeclarationTransitionAllowed(fromState, toState) {
  if (!canTransitionDeclarationState(fromState, toState)) {
    throw new Error(
      "declaration_state_transition_forbidden:" + fromState + "->" + toState,
    );
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: resolveDeclarationState
 * Purpose: Documents the exported entrypoint for declaration acceptance state boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must keep acceptance explicit and must not create accepted state from display state.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function resolveDeclarationState(context = {}) {
  const c = coerceDeclarationContext(context);

  if (c.accepted && c.blocked) {
    throw new Error("declaration_state_invalid:accepted_and_blocked");
  }

  if (c.superseded) {
    return DECLARATION_STATE.SUPERSEDED;
  }

  if (c.accepted) {
    return DECLARATION_STATE.ACCEPTED;
  }

  if (c.blocked) {
    return DECLARATION_STATE.BLOCKED;
  }

  return DECLARATION_STATE.PENDING;
}

/**
 * FUNCTION NOTE:
 * Export: assertDeclarationStateMatchesContext
 * Purpose: Documents the exported entrypoint for declaration acceptance state boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must keep acceptance explicit and must not create accepted state from display state.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertDeclarationStateMatchesContext(state, context = {}) {
  assertKnownState(state, "declaration_state");
  const resolvedState = resolveDeclarationState(context);

  if (resolvedState !== state) {
    throw new Error(
      "declaration_state_context_mismatch:" +
        state +
        " resolved=" +
        resolvedState,
    );
  }

  return true;
}

/**
 * FUNCTION NOTE:
 * Export: assertDeclarationTransitionMatchesContext
 * Purpose: Documents the exported entrypoint for declaration acceptance state boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must keep acceptance explicit and must not create accepted state from display state.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertDeclarationTransitionMatchesContext(fromState, toState, context = {}) {
  assertDeclarationTransitionAllowed(fromState, toState);
  assertDeclarationStateMatchesContext(toState, context);
  return true;
}