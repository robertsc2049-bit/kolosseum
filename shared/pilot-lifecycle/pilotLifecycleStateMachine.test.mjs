import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_PILOT_LIFECYCLE_TRANSITIONS,
  PILOT_LIFECYCLE_STATES,
  PILOT_LIFECYCLE_STATE_LIST,
  assertPilotLifecycleTransitionAllowed,
  assertPilotLifecycleTransitionMatchesContext,
  canTransitionPilotLifecycle,
  resolvePilotLifecycleState,
} from "./pilotLifecycleStateMachine.mjs";

test("pilot lifecycle state enum is exact and closed", () => {
  assert.deepEqual(PILOT_LIFECYCLE_STATE_LIST, [
    "accepted",
    "commercial_pending",
    "platform_pending",
    "coach_pending",
    "athlete_pending",
    "link_pending",
    "scope_pending",
    "phase1_pending",
    "compile_pending",
    "coach_operable",
    "active",
    "paused",
    "stopped",
    "cancelled",
  ]);
});

test("allowed transitions map is exact", () => {
  assert.deepEqual(ALLOWED_PILOT_LIFECYCLE_TRANSITIONS, {
    accepted: ["commercial_pending", "cancelled"],
    commercial_pending: ["platform_pending", "cancelled"],
    platform_pending: ["coach_pending", "cancelled"],
    coach_pending: ["athlete_pending", "cancelled"],
    athlete_pending: ["link_pending", "cancelled"],
    link_pending: ["scope_pending", "cancelled"],
    scope_pending: ["phase1_pending", "cancelled"],
    phase1_pending: ["compile_pending", "cancelled"],
    compile_pending: ["coach_operable", "cancelled"],
    coach_operable: ["active", "paused", "stopped"],
    active: ["paused", "stopped"],
    paused: ["active", "stopped"],
    stopped: [],
    cancelled: [],
  });
});

test("positive transition path from acceptance to active is lawful", () => {
  assert.equal(canTransitionPilotLifecycle("accepted", "commercial_pending"), true);
  assert.equal(canTransitionPilotLifecycle("commercial_pending", "platform_pending"), true);
  assert.equal(canTransitionPilotLifecycle("platform_pending", "coach_pending"), true);
  assert.equal(canTransitionPilotLifecycle("coach_pending", "athlete_pending"), true);
  assert.equal(canTransitionPilotLifecycle("athlete_pending", "link_pending"), true);
  assert.equal(canTransitionPilotLifecycle("link_pending", "scope_pending"), true);
  assert.equal(canTransitionPilotLifecycle("scope_pending", "phase1_pending"), true);
  assert.equal(canTransitionPilotLifecycle("phase1_pending", "compile_pending"), true);
  assert.equal(canTransitionPilotLifecycle("compile_pending", "coach_operable"), true);
  assert.equal(canTransitionPilotLifecycle("coach_operable", "active"), true);
});

test("operational transitions are lawful", () => {
  assert.equal(canTransitionPilotLifecycle("coach_operable", "paused"), true);
  assert.equal(canTransitionPilotLifecycle("coach_operable", "stopped"), true);
  assert.equal(canTransitionPilotLifecycle("active", "paused"), true);
  assert.equal(canTransitionPilotLifecycle("active", "stopped"), true);
  assert.equal(canTransitionPilotLifecycle("paused", "active"), true);
  assert.equal(canTransitionPilotLifecycle("paused", "stopped"), true);
});

test("forbidden transitions fail", () => {
  assert.equal(canTransitionPilotLifecycle("accepted", "active"), false);
  assert.equal(canTransitionPilotLifecycle("link_pending", "compile_pending"), false);
  assert.equal(canTransitionPilotLifecycle("compile_pending", "active"), false);
  assert.equal(canTransitionPilotLifecycle("stopped", "active"), false);
  assert.equal(canTransitionPilotLifecycle("cancelled", "active"), false);
  assert.equal(canTransitionPilotLifecycle("active", "accepted"), false);

  assert.throws(
    () => assertPilotLifecycleTransitionAllowed("accepted", "active"),
    /pilot_lifecycle_transition_forbidden:accepted->active/,
  );
});

test("cancelled is pre-operational only", () => {
  assert.equal(canTransitionPilotLifecycle("accepted", "cancelled"), true);
  assert.equal(canTransitionPilotLifecycle("compile_pending", "cancelled"), true);
  assert.equal(canTransitionPilotLifecycle("coach_operable", "cancelled"), false);
  assert.equal(canTransitionPilotLifecycle("active", "cancelled"), false);
  assert.equal(canTransitionPilotLifecycle("paused", "cancelled"), false);
});

test("resolve state returns commercial_pending by default", () => {
  assert.equal(resolvePilotLifecycleState({}), PILOT_LIFECYCLE_STATES.COMMERCIAL_PENDING);
});

test("resolve state returns platform_pending when commercial is satisfied only", () => {
  assert.equal(
    resolvePilotLifecycleState({ commercialSatisfied: true }),
    PILOT_LIFECYCLE_STATES.PLATFORM_PENDING,
  );
});

test("resolve state returns coach_pending when workspace is provisioned", () => {
  assert.equal(
    resolvePilotLifecycleState({
      commercialSatisfied: true,
      workspaceProvisioned: true,
    }),
    PILOT_LIFECYCLE_STATES.COACH_PENDING,
  );
});

test("resolve state returns athlete_pending when coach account is provisioned", () => {
  assert.equal(
    resolvePilotLifecycleState({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
    }),
    PILOT_LIFECYCLE_STATES.ATHLETE_PENDING,
  );
});

test("resolve state returns link_pending when both accounts are provisioned", () => {
  assert.equal(
    resolvePilotLifecycleState({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
    }),
    PILOT_LIFECYCLE_STATES.LINK_PENDING,
  );
});

test("resolve state returns scope_pending when link is accepted", () => {
  assert.equal(
    resolvePilotLifecycleState({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
    }),
    PILOT_LIFECYCLE_STATES.SCOPE_PENDING,
  );
});

test("resolve state returns phase1_pending when scope is locked", () => {
  assert.equal(
    resolvePilotLifecycleState({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
    }),
    PILOT_LIFECYCLE_STATES.PHASE1_PENDING,
  );
});

test("resolve state returns compile_pending when phase1 is accepted", () => {
  assert.equal(
    resolvePilotLifecycleState({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
      phase1Accepted: true,
    }),
    PILOT_LIFECYCLE_STATES.COMPILE_PENDING,
  );
});

test("resolve state returns coach_operable when first executable session is compiled", () => {
  assert.equal(
    resolvePilotLifecycleState({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
      phase1Accepted: true,
      firstExecutableSessionCompiled: true,
    }),
    PILOT_LIFECYCLE_STATES.COACH_OPERABLE,
  );
});

test("resolve state returns active only when activation signal exists", () => {
  assert.equal(
    resolvePilotLifecycleState({
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
    PILOT_LIFECYCLE_STATES.ACTIVE,
  );
});

test("resolve state returns paused and stopped as explicit operator states", () => {
  assert.equal(
    resolvePilotLifecycleState({
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
    PILOT_LIFECYCLE_STATES.PAUSED,
  );

  assert.equal(
    resolvePilotLifecycleState({
      stoppedByOperator: true,
    }),
    PILOT_LIFECYCLE_STATES.STOPPED,
  );
});

test("resolve state returns cancelled only when pre-operational", () => {
  assert.equal(
    resolvePilotLifecycleState({
      commercialSatisfied: true,
      workspaceProvisioned: true,
      cancelledByOperator: true,
    }),
    PILOT_LIFECYCLE_STATES.CANCELLED,
  );

  assert.throws(
    () =>
      resolvePilotLifecycleState({
        commercialSatisfied: true,
        workspaceProvisioned: true,
        coachAccountProvisioned: true,
        athleteAccountProvisioned: true,
        linkAccepted: true,
        scopeLocked: true,
        phase1Accepted: true,
        firstExecutableSessionCompiled: true,
        cancelledByOperator: true,
      }),
    /pilot_lifecycle_cancelled_preoperational_only/,
  );
});

test("active requires compiled session", () => {
  assert.throws(
    () =>
      resolvePilotLifecycleState({
        activationSignalReceived: true,
      }),
    /pilot_lifecycle_active_requires_compiled_session/,
  );
});

test("transition-to-state context checks are enforced", () => {
  assert.equal(
    assertPilotLifecycleTransitionMatchesContext("accepted", "commercial_pending", {
      commercialSatisfied: false,
    }),
    true,
  );

  assert.equal(
    assertPilotLifecycleTransitionMatchesContext("compile_pending", "coach_operable", {
      commercialSatisfied: true,
      workspaceProvisioned: true,
      coachAccountProvisioned: true,
      athleteAccountProvisioned: true,
      linkAccepted: true,
      scopeLocked: true,
      phase1Accepted: true,
      firstExecutableSessionCompiled: true,
    }),
    true,
  );

  assert.equal(
    assertPilotLifecycleTransitionMatchesContext("coach_operable", "active", {
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
    true,
  );
});

test("transition context mismatch fails", () => {
  assert.throws(
    () =>
      assertPilotLifecycleTransitionMatchesContext("phase1_pending", "compile_pending", {
        commercialSatisfied: true,
        workspaceProvisioned: true,
        coachAccountProvisioned: true,
        athleteAccountProvisioned: true,
        linkAccepted: true,
        scopeLocked: true,
        phase1Accepted: false,
      }),
    /pilot_lifecycle_transition_context_mismatch/,
  );
});

test("coach_operable requires compiled session in transition checks", () => {
  assert.throws(
    () =>
      assertPilotLifecycleTransitionMatchesContext("compile_pending", "coach_operable", {
        commercialSatisfied: true,
        workspaceProvisioned: true,
        coachAccountProvisioned: true,
        athleteAccountProvisioned: true,
        linkAccepted: true,
        scopeLocked: true,
        phase1Accepted: true,
        firstExecutableSessionCompiled: false,
      }),
    /pilot_lifecycle_transition_context_mismatch/,
  );
});

test("active requires activation signal in transition checks", () => {
  assert.throws(
    () =>
      assertPilotLifecycleTransitionMatchesContext("coach_operable", "active", {
        commercialSatisfied: true,
        workspaceProvisioned: true,
        coachAccountProvisioned: true,
        athleteAccountProvisioned: true,
        linkAccepted: true,
        scopeLocked: true,
        phase1Accepted: true,
        firstExecutableSessionCompiled: true,
        activationSignalReceived: false,
      }),
    /pilot_lifecycle_transition_context_mismatch/,
  );
});

test("single explicit lifecycle state resolves for representative contexts", () => {
  const resolvedStates = [
    resolvePilotLifecycleState({}),
    resolvePilotLifecycleState({ commercialSatisfied: true }),
    resolvePilotLifecycleState({ commercialSatisfied: true, workspaceProvisioned: true }),
    resolvePilotLifecycleState({
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
    resolvePilotLifecycleState({
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
  ];

  for (const state of resolvedStates) {
    assert.equal(PILOT_LIFECYCLE_STATE_LIST.includes(state), true);
  }
});