import test from "node:test";
import assert from "node:assert/strict";

import {
  PILOT_STATE_REQUIRED_REASON_POLICY,
  PILOT_STATUS_REASON_CODES,
  PILOT_STATUS_REASON_CODE_LIST,
  assertPilotStateHasRequiredReasonCodes,
  assertPilotStatusReasonCodesMatchContext,
  resolvePilotStatusReasonCodes,
} from "./pilotStatusReasonCodes.mjs";

test("pilot status reason code registry is exact and closed", () => {
  assert.deepEqual(PILOT_STATUS_REASON_CODE_LIST, [
    "commercial_unsettled",
    "workspace_unprovisioned",
    "coach_account_unprovisioned",
    "athlete_account_unprovisioned",
    "coach_athlete_link_unaccepted",
    "scope_unlocked",
    "phase1_unaccepted",
    "first_executable_session_uncompiled",
    "activation_signal_unreceived",
    "paused_by_operator",
    "stopped_by_operator",
    "cancelled_by_operator",
    "renewal_required",
    "expansion_review_required",
  ]);
});

test("state required reason policy is exact", () => {
  assert.deepEqual(PILOT_STATE_REQUIRED_REASON_POLICY, {
    accepted: ["commercial_unsettled"],
    commercial_pending: ["commercial_unsettled"],
    platform_pending: ["workspace_unprovisioned"],
    coach_pending: ["coach_account_unprovisioned"],
    athlete_pending: ["athlete_account_unprovisioned"],
    link_pending: ["coach_athlete_link_unaccepted"],
    scope_pending: ["scope_unlocked"],
    phase1_pending: ["phase1_unaccepted"],
    compile_pending: ["first_executable_session_uncompiled"],
    coach_operable: ["activation_signal_unreceived"],
    active: [],
    paused: ["paused_by_operator"],
    stopped: ["stopped_by_operator"],
    cancelled: ["cancelled_by_operator"],
  });
});

test("reason resolution returns commercial_unsettled for default unresolved pilot", () => {
  assert.deepEqual(resolvePilotStatusReasonCodes({}), [
    PILOT_STATUS_REASON_CODES.COMMERCIAL_UNSETTLED,
  ]);
});

test("reason resolution returns workspace_unprovisioned for platform_pending", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
    }),
    [PILOT_STATUS_REASON_CODES.WORKSPACE_UNPROVISIONED],
  );
});

test("reason resolution returns coach_account_unprovisioned for coach_pending", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
    }),
    [PILOT_STATUS_REASON_CODES.COACH_ACCOUNT_UNPROVISIONED],
  );
});

test("reason resolution returns athlete_account_unprovisioned for athlete_pending", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
    }),
    [PILOT_STATUS_REASON_CODES.ATHLETE_ACCOUNT_UNPROVISIONED],
  );
});

test("reason resolution returns link reason for link_pending", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
    }),
    [PILOT_STATUS_REASON_CODES.COACH_ATHLETE_LINK_UNACCEPTED],
  );
});

test("reason resolution returns scope reason for scope_pending", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
    }),
    [PILOT_STATUS_REASON_CODES.SCOPE_UNLOCKED],
  );
});

test("reason resolution returns phase1 reason for phase1_pending", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
    }),
    [PILOT_STATUS_REASON_CODES.PHASE1_UNACCEPTED],
  );
});

test("reason resolution returns compile reason for compile_pending", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
      phase1Accepted: true,
    }),
    [PILOT_STATUS_REASON_CODES.FIRST_EXECUTABLE_SESSION_UNCOMPILED],
  );
});

test("reason resolution returns activation reason for coach_operable", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
      phase1Accepted: true,
      firstExecutableSessionCompiled: true,
    }),
    [PILOT_STATUS_REASON_CODES.ACTIVATION_SIGNAL_UNRECEIVED],
  );
});

test("reason resolution returns no required reason for active without adjunct conditions", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
      phase1Accepted: true,
      firstExecutableSessionCompiled: true,
      activationSignalReceived: true,
    }),
    [],
  );
});

test("reason resolution returns adjunct reasons for active when flagged", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
      phase1Accepted: true,
      firstExecutableSessionCompiled: true,
      activationSignalReceived: true,
      renewalRequired: true,
      expansionReviewRequired: true,
    }),
    [
      PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED,
      PILOT_STATUS_REASON_CODES.EXPANSION_REVIEW_REQUIRED,
    ],
  );
});

test("reason resolution returns operator reason for paused", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
      phase1Accepted: true,
      firstExecutableSessionCompiled: true,
      pausedByOperator: true,
    }),
    [PILOT_STATUS_REASON_CODES.PAUSED_BY_OPERATOR],
  );
});

test("reason resolution returns operator reason for stopped", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      stoppedByOperator: true,
    }),
    [PILOT_STATUS_REASON_CODES.STOPPED_BY_OPERATOR],
  );
});

test("reason resolution returns operator reason for cancelled", () => {
  assert.deepEqual(
    resolvePilotStatusReasonCodes({
      cancelledByOperator: true,
    }),
    [PILOT_STATUS_REASON_CODES.CANCELLED_BY_OPERATOR],
  );
});

test("non-active state requires at least one explicit reason code", () => {
  assert.throws(
    () => assertPilotStateHasRequiredReasonCodes("platform_pending", []),
    /pilot_status_reason_codes_required_for_state:platform_pending/,
  );
});

test("required reason code missing is rejected", () => {
  assert.throws(
    () =>
      assertPilotStateHasRequiredReasonCodes("compile_pending", [
        PILOT_STATUS_REASON_CODES.PHASE1_UNACCEPTED,
      ]),
    /pilot_status_reason_code_required_missing:compile_pending:first_executable_session_uncompiled/,
  );
});

test("wrong reason code for non-active state is rejected", () => {
  assert.throws(
    () =>
      assertPilotStateHasRequiredReasonCodes("coach_pending", [
        PILOT_STATUS_REASON_CODES.WORKSPACE_UNPROVISIONED,
      ]),
    /pilot_status_reason_code_required_missing:coach_pending:coach_account_unprovisioned/,
  );
});

test("non-active state rejects extra unrelated reason code", () => {
  assert.throws(
    () =>
      assertPilotStateHasRequiredReasonCodes("stopped", [
        PILOT_STATUS_REASON_CODES.STOPPED_BY_OPERATOR,
        PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED,
      ]),
    /pilot_status_reason_code_not_allowed_for_state:stopped:renewal_required/,
  );
});

test("coach_operable allows activation reason plus adjunct commercial flags", () => {
  assert.equal(
    assertPilotStateHasRequiredReasonCodes("coach_operable", [
      PILOT_STATUS_REASON_CODES.ACTIVATION_SIGNAL_UNRECEIVED,
      PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED,
      PILOT_STATUS_REASON_CODES.EXPANSION_REVIEW_REQUIRED,
    ]),
    true,
  );
});

test("paused allows operator reason plus adjunct commercial flags", () => {
  assert.equal(
    assertPilotStateHasRequiredReasonCodes("paused", [
      PILOT_STATUS_REASON_CODES.PAUSED_BY_OPERATOR,
      PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED,
    ]),
    true,
  );
});

test("active allows only adjunct commercial flags", () => {
  assert.equal(
    assertPilotStateHasRequiredReasonCodes("active", [
      PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED,
      PILOT_STATUS_REASON_CODES.EXPANSION_REVIEW_REQUIRED,
    ]),
    true,
  );

  assert.throws(
    () =>
      assertPilotStateHasRequiredReasonCodes("active", [
        PILOT_STATUS_REASON_CODES.STOPPED_BY_OPERATOR,
      ]),
    /pilot_status_reason_code_not_allowed_for_state:active:stopped_by_operator/,
  );
});

test("unknown state is rejected", () => {
  assert.throws(
    () =>
      assertPilotStateHasRequiredReasonCodes("not_a_state", [
        PILOT_STATUS_REASON_CODES.COMMERCIAL_UNSETTLED,
      ]),
    /pilot_lifecycle_state_unknown:not_a_state/,
  );
});

test("unknown reason code is rejected", () => {
  assert.throws(
    () =>
      assertPilotStateHasRequiredReasonCodes("commercial_pending", [
        "not_a_reason_code",
      ]),
    /pilot_status_reason_code_unknown:not_a_reason_code/,
  );
});

test("reason codes must be an array", () => {
  assert.throws(
    () => assertPilotStateHasRequiredReasonCodes("commercial_pending", "nope"),
    /pilot_status_reason_codes_must_be_array/,
  );
});

test("duplicate reason codes are normalized and still pass", () => {
  assert.equal(
    assertPilotStateHasRequiredReasonCodes("commercial_pending", [
      PILOT_STATUS_REASON_CODES.COMMERCIAL_UNSETTLED,
      PILOT_STATUS_REASON_CODES.COMMERCIAL_UNSETTLED,
    ]),
    true,
  );
});

test("state and reason codes must match context", () => {
  assert.equal(
    assertPilotStatusReasonCodesMatchContext(
      "compile_pending",
      {
        commercialSatisfied: true,
        workspaceProvisioned: true,
        coachAccountProvisioned: true,
        athleteAccountProvisioned: true,
        linkAccepted: true,
        scopeLocked: true,
        phase1Accepted: true,
      },
      [PILOT_STATUS_REASON_CODES.FIRST_EXECUTABLE_SESSION_UNCOMPILED],
    ),
    true,
  );

  assert.equal(
    assertPilotStatusReasonCodesMatchContext(
      "active",
      {
        commercialSatisfied: true,
        workspaceProvisioned: true,
        coachAccountProvisioned: true,
        athleteAccountProvisioned: true,
        linkAccepted: true,
        scopeLocked: true,
        phase1Accepted: true,
        firstExecutableSessionCompiled: true,
        activationSignalReceived: true,
        renewalRequired: true,
      },
      [PILOT_STATUS_REASON_CODES.RENEWAL_REQUIRED],
    ),
    true,
  );
});

test("state mismatch against context is rejected", () => {
  assert.throws(
    () =>
      assertPilotStatusReasonCodesMatchContext(
        "active",
        {
          commercialSatisfied: true,
        },
        [],
      ),
    /pilot_status_reason_context_state_mismatch:active resolved=platform_pending/,
  );
});

test("reason mismatch against context is rejected", () => {
  assert.throws(
    () =>
      assertPilotStatusReasonCodesMatchContext(
        "coach_operable",
        {
          commercialSatisfied: true,
          workspaceProvisioned: true,
          coachAccountProvisioned: true,
          athleteAccountProvisioned: true,
          linkAccepted: true,
          scopeLocked: true,
          phase1Accepted: true,
          firstExecutableSessionCompiled: true,
          renewalRequired: true,
        },
        [PILOT_STATUS_REASON_CODES.ACTIVATION_SIGNAL_UNRECEIVED],
      ),
    /pilot_status_reason_codes_context_mismatch:coach_operable expected=activation_signal_unreceived,renewal_required actual=activation_signal_unreceived/,
  );
});