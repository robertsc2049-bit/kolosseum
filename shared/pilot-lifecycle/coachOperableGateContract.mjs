import { resolvePilotLifecycleState } from "./pilotLifecycleStateMachine.mjs";
import { PILOT_STATUS_REASON_CODES } from "./pilotStatusReasonCodes.mjs";

export const COACH_OPERABLE_REQUIRED_TRUE_FLAGS = Object.freeze([
  "commercialSatisfied",
  "workspaceProvisioned",
  "coachAccountProvisioned",
  "athleteAccountProvisioned",
  "linkAccepted",
  "scopeLocked",
  "phase1Accepted",
  "firstExecutableSessionCompiled",
]);

export const COACH_OPERABLE_REQUIRED_FALSE_FLAGS = Object.freeze([
  "activationSignalReceived",
  "pausedByOperator",
  "stoppedByOperator",
  "cancelledByOperator",
]);

export const COACH_OPERABLE_GATE_FAILURE_CODES = Object.freeze({
  MISSING_COMMERCIAL_SATISFIED: "coach_operable_gate_missing_commercial_satisfied",
  MISSING_WORKSPACE_PROVISIONED: "coach_operable_gate_missing_workspace_provisioned",
  MISSING_COACH_ACCOUNT_PROVISIONED: "coach_operable_gate_missing_coach_account_provisioned",
  MISSING_ATHLETE_ACCOUNT_PROVISIONED: "coach_operable_gate_missing_athlete_account_provisioned",
  MISSING_LINK_ACCEPTED: "coach_operable_gate_missing_link_accepted",
  MISSING_SCOPE_LOCKED: "coach_operable_gate_missing_scope_locked",
  MISSING_PHASE1_ACCEPTED: "coach_operable_gate_missing_phase1_accepted",
  MISSING_FIRST_EXECUTABLE_SESSION_COMPILED: "coach_operable_gate_missing_first_executable_session_compiled",
  BLOCKED_BY_ACTIVATION_SIGNAL: "coach_operable_gate_blocked_by_activation_signal",
  BLOCKED_BY_PAUSED_OPERATOR_STATE: "coach_operable_gate_blocked_by_paused_operator_state",
  BLOCKED_BY_STOPPED_OPERATOR_STATE: "coach_operable_gate_blocked_by_stopped_operator_state",
  BLOCKED_BY_CANCELLED_OPERATOR_STATE: "coach_operable_gate_blocked_by_cancelled_operator_state",
});

function coerceGateContext(input = {}) {
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

export function getCoachOperableGateFailureCodes(context = {}) {
  const c = coerceGateContext(context);
  const failureCodes = [];

  if (!c.commercialSatisfied) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_COMMERCIAL_SATISFIED);
  }

  if (!c.workspaceProvisioned) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_WORKSPACE_PROVISIONED);
  }

  if (!c.coachAccountProvisioned) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_COACH_ACCOUNT_PROVISIONED);
  }

  if (!c.athleteAccountProvisioned) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_ATHLETE_ACCOUNT_PROVISIONED);
  }

  if (!c.linkAccepted) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_LINK_ACCEPTED);
  }

  if (!c.scopeLocked) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_SCOPE_LOCKED);
  }

  if (!c.phase1Accepted) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_PHASE1_ACCEPTED);
  }

  if (!c.firstExecutableSessionCompiled) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_FIRST_EXECUTABLE_SESSION_COMPILED);
  }

  if (c.activationSignalReceived) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_ACTIVATION_SIGNAL);
  }

  if (c.pausedByOperator) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_PAUSED_OPERATOR_STATE);
  }

  if (c.stoppedByOperator) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_STOPPED_OPERATOR_STATE);
  }

  if (c.cancelledByOperator) {
    failureCodes.push(COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_CANCELLED_OPERATOR_STATE);
  }

  return Object.freeze(failureCodes);
}

export function isCoachOperableGateSatisfied(context = {}) {
  return getCoachOperableGateFailureCodes(context).length === 0;
}

export function assertCoachOperableGateSatisfied(context = {}) {
  const failureCodes = getCoachOperableGateFailureCodes(context);

  if (failureCodes.length > 0) {
    throw new Error("coach_operable_gate_unsatisfied:" + failureCodes.join(","));
  }

  return true;
}

export function assertCoachOperableGateMatchesLifecycle(context = {}) {
  const lifecycleState = resolvePilotLifecycleState(context);
  const gateSatisfied = isCoachOperableGateSatisfied(context);

  if (gateSatisfied && lifecycleState !== "coach_operable") {
    throw new Error(
      "coach_operable_gate_lifecycle_mismatch:expected=coach_operable actual=" + lifecycleState,
    );
  }

  if (!gateSatisfied && lifecycleState === "coach_operable") {
    throw new Error("coach_operable_gate_lifecycle_mismatch:gate_unsatisfied_but_state_is_coach_operable");
  }

  return true;
}

export function resolveCoachOperableBlockingReasonCodes(context = {}) {
  const failureCodes = getCoachOperableGateFailureCodes(context);
  const reasonCodes = [];

  for (const failureCode of failureCodes) {
    switch (failureCode) {
      case COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_COMMERCIAL_SATISFIED:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.COMMERCIAL_UNSETTLED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_WORKSPACE_PROVISIONED:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.WORKSPACE_UNPROVISIONED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_COACH_ACCOUNT_PROVISIONED:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.COACH_ACCOUNT_UNPROVISIONED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_ATHLETE_ACCOUNT_PROVISIONED:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.ATHLETE_ACCOUNT_UNPROVISIONED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_LINK_ACCEPTED:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.COACH_ATHLETE_LINK_UNACCEPTED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_SCOPE_LOCKED:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.SCOPE_UNLOCKED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_PHASE1_ACCEPTED:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.PHASE1_UNACCEPTED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_FIRST_EXECUTABLE_SESSION_COMPILED:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.FIRST_EXECUTABLE_SESSION_UNCOMPILED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_ACTIVATION_SIGNAL:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.ACTIVATION_SIGNAL_UNRECEIVED);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_PAUSED_OPERATOR_STATE:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.PAUSED_BY_OPERATOR);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_STOPPED_OPERATOR_STATE:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.STOPPED_BY_OPERATOR);
        break;
      case COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_CANCELLED_OPERATOR_STATE:
        reasonCodes.push(PILOT_STATUS_REASON_CODES.CANCELLED_BY_OPERATOR);
        break;
      default:
        throw new Error("coach_operable_gate_failure_code_unhandled:" + failureCode);
    }
  }

  return Object.freeze(reasonCodes);
}