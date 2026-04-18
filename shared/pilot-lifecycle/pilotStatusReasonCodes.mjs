import {
  PILOT_LIFECYCLE_STATES,
  PILOT_LIFECYCLE_STATE_LIST,
  resolvePilotLifecycleState,
} from "./pilotLifecycleStateMachine.mjs";

export const PILOT_STATUS_REASON_CODES = Object.freeze({
  COMMERCIAL_UNSETTLED: "commercial_unsettled",
  WORKSPACE_UNPROVISIONED: "workspace_unprovisioned",
  COACH_ACCOUNT_UNPROVISIONED: "coach_account_unprovisioned",
  ATHLETE_ACCOUNT_UNPROVISIONED: "athlete_account_unprovisioned",
  COACH_ATHLETE_LINK_UNACCEPTED: "coach_athlete_link_unaccepted",
  SCOPE_UNLOCKED: "scope_unlocked",
  PHASE1_UNACCEPTED: "phase1_unaccepted",
  FIRST_EXECUTABLE_SESSION_UNCOMPILED: "first_executable_session_uncompiled",
  ACTIVATION_SIGNAL_UNRECEIVED: "activation_signal_unreceived",
  PAUSED_BY_OPERATOR: "paused_by_operator",
  STOPPED_BY_OPERATOR: "stopped_by_operator",
  CANCELLED_BY_OPERATOR: "cancelled_by_operator",
  RENEWAL_REQUIRED: "renewal_required",
  EXPANSION_REVIEW_REQUIRED: "expansion_review_required",
});

export const PILOT_STATUS_REASON_CODE_LIST = Object.freeze(
  Object.values(PILOT_STATUS_REASON_CODES),
);

export const PILOT_STATE_REQUIRED_REASON_POLICY = Object.freeze({
  [PILOT_LIFECYCLE_STATES.ACCEPTED]: Object.freeze([
    PILOT_STATUS_REASON_CODES.COMMERCIAL_UNSETTLED,
  ]),
  [PILOT_LIFECYCLE_STATES.COMMERCIAL_PENDING]: Object.freeze([
    PILOT_STATUS_REASON_CODES.COMMERCIAL_UNSETTLED,
  ]),
  [PILOT_LIFECYCLE_STATES.PLATFORM_PENDING]: Object.freeze([
    PILOT_STATUS_REASON_CODES.WORKSPACE_UNPROVISIONED,
  ]),
  [PILOT_LIFECYCLE_STATES.COACH_PENDING]: Object.freeze([
    PILOT_STATUS_REASON_CODES.COACH_ACCOUNT_UNPROVISIONED,
  ]),
  [PILOT_LIFECYCLE_STATES.ATHLETE_PENDING]: Object.freeze([
    PILOT_STATUS_REASON_CODES.ATHLETE_ACCOUNT_UNPROVISIONED,
  ]),
  [PILOT_LIFECYCLE_STATES.LINK_PENDING]: Object.freeze([
    PILOT_STATUS_REASON_CODES.COACH_ATHLETE_LINK_UNACCEPTED,
  ]),
  [PILOT_LIFECYCLE_STATES.SCOPE_PENDING]: Object.freeze([
    PILOT_STATUS_REASON_CODES.SCOPE_UNLOCKED,
  ]),
  [PILOT_LIFECYCLE_STATES.PHASE1_PENDING]: Object.freeze([
    PILOT_STATUS_REASON_CODES.PHASE1_UNACCEPTED,
  ]),
  [PILOT_LIFECYCLE_STATES.COMPILE_PENDING]: Object.freeze([
    PILOT_STATUS_REASON_CODES.FIRST_EXECUTABLE_SESSION_UNCOMPILED,
  ]),
  [PILOT_LIFECYCLE_STATES.COACH_OPERABLE]: Object.freeze([
    PILOT_STATUS_REASON_CODES.ACTIVATION_SIGNAL_UNRECEIVED,
  ]),
  [PILOT_LIFECYCLE_STATES.ACTIVE]: Object.freeze([]),
  [PILOT_LIFECYCLE_STATES.PAUSED]: Object.freeze([
    PILOT_STATUS_REASON_CODES.PAUSED_BY_OPERATOR,
  ]),
  [PILOT_LIFECYCLE_STATES.STOPPED]: Object.freeze([
    PILOT_STATUS_REASON_CODES.STOPPED_BY_OPERATOR,
  ]),
  [PILOT_LIFECYCLE_STATES.CANCELLED]: Object.freeze([
    PILOT_STATUS_REASON_CODES.CANCELLED_BY_OPERATOR,
  ]),
});

const ACTIVE_OPTIONAL_REASON_CODES = new Set([
  PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED,
  PILOT_STATUS_REASON_CODES.EXPANSION_REVIEW_REQUIRED,
]);

function assertKnownState(state, label) {
  if (!PILOT_LIFECYCLE_STATE_LIST.includes(state)) {
    throw new Error(label + "_unknown:" + String(state));
  }
}

function assertKnownReasonCode(reasonCode) {
  if (!PILOT_STATUS_REASON_CODE_LIST.includes(reasonCode)) {
    throw new Error("pilot_status_reason_code_unknown:" + String(reasonCode));
  }
}

function normalizeReasonCodes(reasonCodes = []) {
  if (!Array.isArray(reasonCodes)) {
    throw new Error("pilot_status_reason_codes_must_be_array");
  }

  const deduped = [];
  const seen = new Set();

  for (const reasonCode of reasonCodes) {
    assertKnownReasonCode(reasonCode);

    if (!seen.has(reasonCode)) {
      seen.add(reasonCode);
      deduped.push(reasonCode);
    }
  }

  return deduped;
}

function coerceReasonContext(input = {}) {
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
    renewalRequired: input.renewalRequired === true,
    expansionReviewRequired: input.expansionReviewRequired === true,
  };
}

function appendActiveOptionalReasons(reasonCodes, context) {
  if (context.renewalRequired) {
    reasonCodes.push(PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED);
  }

  if (context.expansionReviewRequired) {
    reasonCodes.push(PILOT_STATUS_REASON_CODES.EXPANSION_REVIEW_REQUIRED);
  }
}

export function resolvePilotStatusReasonCodes(context = {}) {
  const lifecycleState = resolvePilotLifecycleState(context);
  const c = coerceReasonContext(context);
  const reasonCodes = [];

  switch (lifecycleState) {
    case PILOT_LIFECYCLE_STATES.ACCEPTED:
    case PILOT_LIFECYCLE_STATES.COMMERCIAL_PENDING:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.COMMERCIAL_UNSETTLED);
      break;

    case PILOT_LIFECYCLE_STATES.PLATFORM_PENDING:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.WORKSPACE_UNPROVISIONED);
      break;

    case PILOT_LIFECYCLE_STATES.COACH_PENDING:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.COACH_ACCOUNT_UNPROVISIONED);
      break;

    case PILOT_LIFECYCLE_STATES.ATHLETE_PENDING:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.ATHLETE_ACCOUNT_UNPROVISIONED);
      break;

    case PILOT_LIFECYCLE_STATES.LINK_PENDING:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.COACH_ATHLETE_LINK_UNACCEPTED);
      break;

    case PILOT_LIFECYCLE_STATES.SCOPE_PENDING:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.SCOPE_UNLOCKED);
      break;

    case PILOT_LIFECYCLE_STATES.PHASE1_PENDING:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.PHASE1_UNACCEPTED);
      break;

    case PILOT_LIFECYCLE_STATES.COMPILE_PENDING:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.FIRST_EXECUTABLE_SESSION_UNCOMPILED);
      break;

    case PILOT_LIFECYCLE_STATES.COACH_OPERABLE:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.ACTIVATION_SIGNAL_UNRECEIVED);
      appendActiveOptionalReasons(reasonCodes, c);
      break;

    case PILOT_LIFECYCLE_STATES.ACTIVE:
      appendActiveOptionalReasons(reasonCodes, c);
      break;

    case PILOT_LIFECYCLE_STATES.PAUSED:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.PAUSED_BY_OPERATOR);
      appendActiveOptionalReasons(reasonCodes, c);
      break;

    case PILOT_LIFECYCLE_STATES.STOPPED:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.STOPPED_BY_OPERATOR);
      break;

    case PILOT_LIFECYCLE_STATES.CANCELLED:
      reasonCodes.push(PILOT_STATUS_REASON_CODES.CANCELLED_BY_OPERATOR);
      break;

    default:
      throw new Error("pilot_lifecycle_state_unhandled:" + lifecycleState);
  }

  return normalizeReasonCodes(reasonCodes);
}

export function assertPilotStateHasRequiredReasonCodes(state, reasonCodes = []) {
  assertKnownState(state, "pilot_lifecycle_state");
  const normalizedReasonCodes = normalizeReasonCodes(reasonCodes);
  const requiredReasonCodes = PILOT_STATE_REQUIRED_REASON_POLICY[state];

  if (state !== PILOT_LIFECYCLE_STATES.ACTIVE && normalizedReasonCodes.length === 0) {
    throw new Error("pilot_status_reason_codes_required_for_state:" + state);
  }

  for (const requiredReasonCode of requiredReasonCodes) {
    if (!normalizedReasonCodes.includes(requiredReasonCode)) {
      throw new Error(
        "pilot_status_reason_code_required_missing:" + state + ":" + requiredReasonCode,
      );
    }
  }

  for (const reasonCode of normalizedReasonCodes) {
    if (state === PILOT_LIFECYCLE_STATES.ACTIVE) {
      if (!ACTIVE_OPTIONAL_REASON_CODES.has(reasonCode)) {
        throw new Error(
          "pilot_status_reason_code_not_allowed_for_state:" + state + ":" + reasonCode,
        );
      }

      continue;
    }

    if (
      state === PILOT_LIFECYCLE_STATES.COACH_OPERABLE ||
      state === PILOT_LIFECYCLE_STATES.PAUSED
    ) {
      const allowedReasonCodes = new Set([
        ...requiredReasonCodes,
        PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED,
        PILOT_STATUS_REASON_CODES.EXPANSION_REVIEW_REQUIRED,
      ]);

      if (!allowedReasonCodes.has(reasonCode)) {
        throw new Error(
          "pilot_status_reason_code_not_allowed_for_state:" + state + ":" + reasonCode,
        );
      }

      continue;
    }

    if (!requiredReasonCodes.includes(reasonCode)) {
      throw new Error(
        "pilot_status_reason_code_not_allowed_for_state:" + state + ":" + reasonCode,
      );
    }
  }

  return true;
}

export function assertPilotStatusReasonCodesMatchContext(state, context = {}, reasonCodes = []) {
  assertKnownState(state, "pilot_lifecycle_state");
  const resolvedState = resolvePilotLifecycleState(context);

  if (resolvedState !== state) {
    throw new Error(
      "pilot_status_reason_context_state_mismatch:" + state + " resolved=" + resolvedState,
    );
  }

  const resolvedReasonCodes = resolvePilotStatusReasonCodes(context);
  const normalizedReasonCodes = normalizeReasonCodes(reasonCodes);

  assertPilotStateHasRequiredReasonCodes(state, normalizedReasonCodes);

  if (resolvedReasonCodes.length !== normalizedReasonCodes.length) {
    throw new Error(
      "pilot_status_reason_codes_context_mismatch:" +
        state +
        " expected=" +
        resolvedReasonCodes.join(",") +
        " actual=" +
        normalizedReasonCodes.join(","),
    );
  }

  for (const resolvedReasonCode of resolvedReasonCodes) {
    if (!normalizedReasonCodes.includes(resolvedReasonCode)) {
      throw new Error(
        "pilot_status_reason_codes_context_mismatch:" +
          state +
          " missing=" +
          resolvedReasonCode,
      );
    }
  }

  return true;
}