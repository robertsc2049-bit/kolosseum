export const PILOT_LIFECYCLE_STATES = Object.freeze({
  ACCEPTED: "accepted",
  COMMERCIAL_PENDING: "commercial_pending",
  PLATFORM_PENDING: "platform_pending",
  COACH_PENDING: "coach_pending",
  ATHLETE_PENDING: "athlete_pending",
  LINK_PENDING: "link_pending",
  SCOPE_PENDING: "scope_pending",
  PHASE1_PENDING: "phase1_pending",
  COMPILE_PENDING: "compile_pending",
  COACH_OPERABLE: "coach_operable",
  ACTIVE: "active",
  PAUSED: "paused",
  STOPPED: "stopped",
  CANCELLED: "cancelled",
});

export const PILOT_LIFECYCLE_STATE_LIST = Object.freeze(
  Object.values(PILOT_LIFECYCLE_STATES),
);

const OPERABLE_STATES = new Set([
  PILOT_LIFECYCLE_STATES.COACH_OPERABLE,
  PILOT_LIFECYCLE_STATES.ACTIVE,
  PILOT_LIFECYCLE_STATES.PAUSED,
]);

export const ALLOWED_PILOT_LIFECYCLE_TRANSITIONS = Object.freeze({
  [PILOT_LIFECYCLE_STATES.ACCEPTED]: Object.freeze([
    PILOT_LIFECYCLE_STATES.COMMERCIAL_PENDING,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.COMMERCIAL_PENDING]: Object.freeze([
    PILOT_LIFECYCLE_STATES.PLATFORM_PENDING,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.PLATFORM_PENDING]: Object.freeze([
    PILOT_LIFECYCLE_STATES.COACH_PENDING,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.COACH_PENDING]: Object.freeze([
    PILOT_LIFECYCLE_STATES.ATHLETE_PENDING,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.ATHLETE_PENDING]: Object.freeze([
    PILOT_LIFECYCLE_STATES.LINK_PENDING,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.LINK_PENDING]: Object.freeze([
    PILOT_LIFECYCLE_STATES.SCOPE_PENDING,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.SCOPE_PENDING]: Object.freeze([
    PILOT_LIFECYCLE_STATES.PHASE1_PENDING,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.PHASE1_PENDING]: Object.freeze([
    PILOT_LIFECYCLE_STATES.COMPILE_PENDING,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.COMPILE_PENDING]: Object.freeze([
    PILOT_LIFECYCLE_STATES.COACH_OPERABLE,
    PILOT_LIFECYCLE_STATES.CANCELLED,
  ]),
  [PILOT_LIFECYCLE_STATES.COACH_OPERABLE]: Object.freeze([
    PILOT_LIFECYCLE_STATES.ACTIVE,
    PILOT_LIFECYCLE_STATES.PAUSED,
    PILOT_LIFECYCLE_STATES.STOPPED,
  ]),
  [PILOT_LIFECYCLE_STATES.ACTIVE]: Object.freeze([
    PILOT_LIFECYCLE_STATES.PAUSED,
    PILOT_LIFECYCLE_STATES.STOPPED,
  ]),
  [PILOT_LIFECYCLE_STATES.PAUSED]: Object.freeze([
    PILOT_LIFECYCLE_STATES.ACTIVE,
    PILOT_LIFECYCLE_STATES.STOPPED,
  ]),
  [PILOT_LIFECYCLE_STATES.STOPPED]: Object.freeze([]),
  [PILOT_LIFECYCLE_STATES.CANCELLED]: Object.freeze([]),
});

function assertKnownState(state, label) {
  if (!PILOT_LIFECYCLE_STATE_LIST.includes(state)) {
    throw new Error(label + "_unknown:" + String(state));
  }
}

function coerceBooleanRecord(input = {}) {
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

export function canTransitionPilotLifecycle(fromState, toState) {
  assertKnownState(fromState, "from_state");
  assertKnownState(toState, "to_state");

  return ALLOWED_PILOT_LIFECYCLE_TRANSITIONS[fromState].includes(toState);
}

export function assertPilotLifecycleTransitionAllowed(fromState, toState) {
  if (!canTransitionPilotLifecycle(fromState, toState)) {
    throw new Error("pilot_lifecycle_transition_forbidden:" + fromState + "->" + toState);
  }
}

export function resolvePilotLifecycleState(context = {}) {
  const c = coerceBooleanRecord(context);

  if (c.stoppedByOperator) {
    return PILOT_LIFECYCLE_STATES.STOPPED;
  }

  if (c.pausedByOperator) {
    return PILOT_LIFECYCLE_STATES.PAUSED;
  }

  if (c.cancelledByOperator) {
    if (c.firstExecutableSessionCompiled || c.activationSignalReceived) {
      throw new Error("pilot_lifecycle_cancelled_preoperational_only");
    }

    return PILOT_LIFECYCLE_STATES.CANCELLED;
  }

  if (c.activationSignalReceived) {
    if (!c.firstExecutableSessionCompiled) {
      throw new Error("pilot_lifecycle_active_requires_compiled_session");
    }

    return PILOT_LIFECYCLE_STATES.ACTIVE;
  }

  if (c.firstExecutableSessionCompiled) {
    return PILOT_LIFECYCLE_STATES.COACH_OPERABLE;
  }

  if (c.phase1Accepted) {
    return PILOT_LIFECYCLE_STATES.COMPILE_PENDING;
  }

  if (c.scopeLocked) {
    return PILOT_LIFECYCLE_STATES.PHASE1_PENDING;
  }

  if (c.linkAccepted) {
    return PILOT_LIFECYCLE_STATES.SCOPE_PENDING;
  }

  if (c.athleteAccountProvisioned && c.coachAccountProvisioned) {
    return PILOT_LIFECYCLE_STATES.LINK_PENDING;
  }

  if (c.coachAccountProvisioned) {
    return PILOT_LIFECYCLE_STATES.ATHLETE_PENDING;
  }

  if (c.workspaceProvisioned) {
    return PILOT_LIFECYCLE_STATES.COACH_PENDING;
  }

  if (c.commercialSatisfied) {
    return PILOT_LIFECYCLE_STATES.PLATFORM_PENDING;
  }

  return PILOT_LIFECYCLE_STATES.COMMERCIAL_PENDING;
}

export function assertPilotLifecycleTransitionMatchesContext(fromState, toState, context = {}) {
  assertPilotLifecycleTransitionAllowed(fromState, toState);

  const resolvedTargetState = resolvePilotLifecycleState(context);
  if (resolvedTargetState !== toState) {
    throw new Error(
      "pilot_lifecycle_transition_context_mismatch:" +
        fromState +
        "->" +
        toState +
        " resolved=" +
        resolvedTargetState,
    );
  }

  if (toState === PILOT_LIFECYCLE_STATES.CANCELLED && OPERABLE_STATES.has(fromState)) {
    throw new Error("pilot_lifecycle_cancelled_preoperational_only");
  }

  if (
    toState === PILOT_LIFECYCLE_STATES.ACTIVE &&
    context.activationSignalReceived !== true
  ) {
    throw new Error("pilot_lifecycle_active_requires_activation_signal");
  }

  if (
    toState === PILOT_LIFECYCLE_STATES.COACH_OPERABLE &&
    context.firstExecutableSessionCompiled !== true
  ) {
    throw new Error("pilot_lifecycle_coach_operable_requires_compiled_session");
  }

  return true;
}