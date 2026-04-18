import test from "node:test";
import assert from "node:assert/strict";

import { resolvePilotLifecycleState } from "./pilotLifecycleStateMachine.mjs";
import { PILOT_STATUS_REASON_CODES } from "./pilotStatusReasonCodes.mjs";
import {
  COACH_OPERABLE_GATE_FAILURE_CODES,
  COACH_OPERABLE_REQUIRED_FALSE_FLAGS,
  COACH_OPERABLE_REQUIRED_TRUE_FLAGS,
  assertCoachOperableGateMatchesLifecycle,
  assertCoachOperableGateSatisfied,
  getCoachOperableGateFailureCodes,
  isCoachOperableGateSatisfied,
  resolveCoachOperableBlockingReasonCodes,
} from "./coachOperableGateContract.mjs";

function getHappyPathContext() {
  return {
    commercialSatisfied: true,
    workspaceProvisioned: true,
    coachAccountProvisioned: true,
    athleteAccountProvisioned: true,
    linkAccepted: true,
    scopeLocked: true,
    phase1Accepted: true,
    firstExecutableSessionCompiled: true,
    activationSignalReceived: false,
    pausedByOperator: false,
    stoppedByOperator: false,
    cancelledByOperator: false,
  };
}

test("coach operable required true flags are exact", () => {
  assert.deepEqual(COACH_OPERABLE_REQUIRED_TRUE_FLAGS, [
    "commercialSatisfied",
    "workspaceProvisioned",
    "coachAccountProvisioned",
    "athleteAccountProvisioned",
    "linkAccepted",
    "scopeLocked",
    "phase1Accepted",
    "firstExecutableSessionCompiled",
  ]);
});

test("coach operable required false flags are exact", () => {
  assert.deepEqual(COACH_OPERABLE_REQUIRED_FALSE_FLAGS, [
    "activationSignalReceived",
    "pausedByOperator",
    "stoppedByOperator",
    "cancelledByOperator",
  ]);
});

test("coach operable happy path is satisfied", () => {
  const context = getHappyPathContext();

  assert.equal(isCoachOperableGateSatisfied(context), true);
  assert.deepEqual(getCoachOperableGateFailureCodes(context), []);
  assert.equal(assertCoachOperableGateSatisfied(context), true);
  assert.equal(resolvePilotLifecycleState(context), "coach_operable");
  assert.equal(assertCoachOperableGateMatchesLifecycle(context), true);
});

test("missing commercial satisfaction hard-fails", () => {
  const context = { ...getHappyPathContext(), commercialSatisfied: false };

  assert.equal(isCoachOperableGateSatisfied(context), false);
  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_COMMERCIAL_SATISFIED,
  ]);
  assert.throws(
    () => assertCoachOperableGateSatisfied(context),
    /coach_operable_gate_unsatisfied:coach_operable_gate_missing_commercial_satisfied/,
  );
});

test("missing workspace hard-fails", () => {
  const context = { ...getHappyPathContext(), workspaceProvisioned: false };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_WORKSPACE_PROVISIONED,
  ]);
});

test("missing coach account hard-fails", () => {
  const context = { ...getHappyPathContext(), coachAccountProvisioned: false };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_COACH_ACCOUNT_PROVISIONED,
  ]);
});

test("missing athlete account hard-fails", () => {
  const context = { ...getHappyPathContext(), athleteAccountProvisioned: false };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_ATHLETE_ACCOUNT_PROVISIONED,
  ]);
});

test("missing accepted link hard-fails", () => {
  const context = { ...getHappyPathContext(), linkAccepted: false };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_LINK_ACCEPTED,
  ]);
});

test("missing locked scope hard-fails", () => {
  const context = { ...getHappyPathContext(), scopeLocked: false };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_SCOPE_LOCKED,
  ]);
});

test("missing accepted phase1 hard-fails", () => {
  const context = { ...getHappyPathContext(), phase1Accepted: false };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_PHASE1_ACCEPTED,
  ]);
});

test("missing compiled first executable session hard-fails", () => {
  const context = { ...getHappyPathContext(), firstExecutableSessionCompiled: false };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_FIRST_EXECUTABLE_SESSION_COMPILED,
  ]);
});

test("activation signal blocks coach operable gate", () => {
  const context = { ...getHappyPathContext(), activationSignalReceived: true };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_ACTIVATION_SIGNAL,
  ]);
  assert.equal(resolvePilotLifecycleState(context), "active");
});

test("paused operator state blocks coach operable gate", () => {
  const context = { ...getHappyPathContext(), pausedByOperator: true };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_PAUSED_OPERATOR_STATE,
  ]);
  assert.equal(resolvePilotLifecycleState(context), "paused");
});

test("stopped operator state blocks coach operable gate", () => {
  const context = { ...getHappyPathContext(), stoppedByOperator: true };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_STOPPED_OPERATOR_STATE,
  ]);
  assert.equal(resolvePilotLifecycleState(context), "stopped");
});

test("cancelled operator state blocks coach operable gate and pre-operational cancellation remains enforced", () => {
  const context = { ...getHappyPathContext(), cancelledByOperator: true };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_CANCELLED_OPERATOR_STATE,
  ]);
  assert.throws(
    () => resolvePilotLifecycleState(context),
    /pilot_lifecycle_cancelled_preoperational_only/,
  );
});

test("pre-operational cancellation still resolves to cancelled", () => {
  const context = {
    commercialSatisfied: true,
    workspaceProvisioned: true,
    coachAccountProvisioned: false,
    athleteAccountProvisioned: false,
    linkAccepted: false,
    scopeLocked: false,
    phase1Accepted: false,
    firstExecutableSessionCompiled: false,
    activationSignalReceived: false,
    pausedByOperator: false,
    stoppedByOperator: false,
    cancelledByOperator: true,
  };

  assert.equal(resolvePilotLifecycleState(context), "cancelled");
});

test("multiple missing prerequisites all appear in failure codes", () => {
  const context = {
    ...getHappyPathContext(),
    commercialSatisfied: false,
    scopeLocked: false,
    firstExecutableSessionCompiled: false,
  };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_COMMERCIAL_SATISFIED,
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_SCOPE_LOCKED,
    COACH_OPERABLE_GATE_FAILURE_CODES.MISSING_FIRST_EXECUTABLE_SESSION_COMPILED,
  ]);
});

test("multiple blocking conditions all appear in failure codes", () => {
  const context = {
    ...getHappyPathContext(),
    activationSignalReceived: true,
    pausedByOperator: true,
    stoppedByOperator: true,
    cancelledByOperator: true,
  };

  assert.deepEqual(getCoachOperableGateFailureCodes(context), [
    COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_ACTIVATION_SIGNAL,
    COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_PAUSED_OPERATOR_STATE,
    COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_STOPPED_OPERATOR_STATE,
    COACH_OPERABLE_GATE_FAILURE_CODES.BLOCKED_BY_CANCELLED_OPERATOR_STATE,
  ]);
});

test("gate satisfied implies lifecycle resolves to coach_operable", () => {
  const context = getHappyPathContext();

  assert.equal(isCoachOperableGateSatisfied(context), true);
  assert.equal(resolvePilotLifecycleState(context), "coach_operable");
  assert.equal(assertCoachOperableGateMatchesLifecycle(context), true);
});

test("gate unsatisfied implies lifecycle does not resolve to coach_operable", () => {
  const context = { ...getHappyPathContext(), firstExecutableSessionCompiled: false };

  assert.equal(isCoachOperableGateSatisfied(context), false);
  assert.notEqual(resolvePilotLifecycleState(context), "coach_operable");
  assert.equal(assertCoachOperableGateMatchesLifecycle(context), true);
});

test("blocking reason code mapping resolves lifecycle-aligned reasons", () => {
  const context = {
    ...getHappyPathContext(),
    workspaceProvisioned: false,
    coachAccountProvisioned: false,
    phase1Accepted: false,
  };

  assert.deepEqual(resolveCoachOperableBlockingReasonCodes(context), [
    PILOT_STATUS_REASON_CODES.WORKSPACE_UNPROVISIONED,
    PILOT_STATUS_REASON_CODES.COACH_ACCOUNT_UNPROVISIONED,
    PILOT_STATUS_REASON_CODES.PHASE1_UNACCEPTED,
  ]);
});

test("operator blocking reason code mapping resolves operator reasons", () => {
  const context = {
    ...getHappyPathContext(),
    pausedByOperator: true,
    stoppedByOperator: true,
  };

  assert.deepEqual(resolveCoachOperableBlockingReasonCodes(context), [
    PILOT_STATUS_REASON_CODES.PAUSED_BY_OPERATOR,
    PILOT_STATUS_REASON_CODES.STOPPED_BY_OPERATOR,
  ]);
});