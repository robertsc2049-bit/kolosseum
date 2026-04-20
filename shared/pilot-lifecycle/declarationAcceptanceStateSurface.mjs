export const DECLARATION_STATE = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  BLOCKED: "blocked",
  SUPERSEDED: "superseded",
});

export const DECLARATION_STATE_LIST = Object.freeze(
  Object.values(DECLARATION_STATE),
);

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

export function canTransitionDeclarationState(fromState, toState) {
  assertKnownState(fromState, "declaration_state_from");
  assertKnownState(toState, "declaration_state_to");

  return DECLARATION_ALLOWED_TRANSITIONS[fromState].includes(toState);
}

export function assertDeclarationTransitionAllowed(fromState, toState) {
  if (!canTransitionDeclarationState(fromState, toState)) {
    throw new Error(
      "declaration_state_transition_forbidden:" + fromState + "->" + toState,
    );
  }

  return true;
}

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

export function assertDeclarationTransitionMatchesContext(fromState, toState, context = {}) {
  assertDeclarationTransitionAllowed(fromState, toState);
  assertDeclarationStateMatchesContext(toState, context);
  return true;
}