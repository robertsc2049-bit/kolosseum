import test from "node:test";
import assert from "node:assert/strict";

import {
  ONBOARDING_START_NON_TRIGGER_FACTS,
  ONBOARDING_START_TRIGGER_EVENTS,
  assertOnboardingStarted,
  assertOnboardingStartedTriggerLawful,
  assertOnboardingStartNotInferred,
  getOnboardingStartedTriggerEvents,
  resolveOnboardingStarted,
} from "./onboardingStartGateContract.mjs";

test("onboarding start trigger registry is exact", () => {
  assert.deepEqual(ONBOARDING_START_TRIGGER_EVENTS, [
    "coach_invite_sent",
    "athlete_invite_sent",
    "link_acceptance_recorded",
    "phase1_declaration_started",
    "first_compile_attempt_started",
  ]);
});

test("onboarding start non-trigger fact registry is exact", () => {
  assert.deepEqual(ONBOARDING_START_NON_TRIGGER_FACTS, [
    "commercialSatisfied",
    "workspaceProvisioned",
    "coachAccountProvisioned",
    "athleteAccountProvisioned",
    "linkAccepted",
    "scopeLocked",
    "phase1Accepted",
    "firstExecutableSessionCompiled",
    "activationSignalReceived",
    "pausedByOperator",
    "stoppedByOperator",
    "cancelledByOperator",
  ]);
});

test("coach invite sent triggers onboarding start", () => {
  assert.equal(resolveOnboardingStarted(["coach_invite_sent"]), true);
  assert.equal(assertOnboardingStarted(["coach_invite_sent"]), true);
});

test("athlete invite sent triggers onboarding start", () => {
  assert.equal(resolveOnboardingStarted(["athlete_invite_sent"]), true);
});

test("link acceptance recorded triggers onboarding start", () => {
  assert.equal(resolveOnboardingStarted(["link_acceptance_recorded"]), true);
});

test("phase1 declaration started triggers onboarding start", () => {
  assert.equal(resolveOnboardingStarted(["phase1_declaration_started"]), true);
});

test("first compile attempt started triggers onboarding start", () => {
  assert.equal(resolveOnboardingStarted(["first_compile_attempt_started"]), true);
});

test("multiple lawful trigger events dedupe and remain factual", () => {
  assert.deepEqual(
    getOnboardingStartedTriggerEvents([
      "coach_invite_sent",
      "coach_invite_sent",
      "phase1_declaration_started",
    ]),
    ["coach_invite_sent", "phase1_declaration_started"],
  );
});

test("no trigger events means onboarding has not started", () => {
  assert.equal(resolveOnboardingStarted([]), false);
  assert.throws(
    () => assertOnboardingStarted([]),
    /onboarding_start_not_triggered/,
  );
});

test("lawful trigger validation accepts all whitelisted events", () => {
  for (const eventName of ONBOARDING_START_TRIGGER_EVENTS) {
    assert.equal(assertOnboardingStartedTriggerLawful(eventName), true);
  }
});

test("unknown trigger name hard-fails", () => {
  assert.throws(
    () => assertOnboardingStartedTriggerLawful("workspace_provisioned"),
    /onboarding_start_event_unknown:workspace_provisioned/,
  );
});

test("invalid trigger type hard-fails", () => {
  assert.throws(
    () => assertOnboardingStartedTriggerLawful(""),
    /onboarding_start_event_invalid:/,
  );

  assert.throws(
    () => getOnboardingStartedTriggerEvents([null]),
    /onboarding_start_event_invalid:null/,
  );
});

test("events input must be array", () => {
  assert.throws(
    () => resolveOnboardingStarted("coach_invite_sent"),
    /onboarding_start_events_must_be_array/,
  );
});

test("commercial satisfied alone does not trigger onboarding start", () => {
  const context = { commercialSatisfied: true };

  assert.equal(resolveOnboardingStarted([]), false);
  assert.equal(assertOnboardingStartNotInferred(context, []), true);
});

test("workspace provisioned alone does not trigger onboarding start", () => {
  const context = { workspaceProvisioned: true };

  assert.equal(resolveOnboardingStarted([]), false);
  assert.equal(assertOnboardingStartNotInferred(context, []), true);
});

test("accounts provisioned alone do not trigger onboarding start", () => {
  const context = {
    coachAccountProvisioned: true,
    athleteAccountProvisioned: true,
  };

  assert.equal(resolveOnboardingStarted([]), false);
  assert.equal(assertOnboardingStartNotInferred(context, []), true);
});

test("link accepted alone does not trigger onboarding start without trigger event", () => {
  const context = { linkAccepted: true };

  assert.equal(resolveOnboardingStarted([]), false);
  assert.equal(assertOnboardingStartNotInferred(context, []), true);
});

test("scope locked alone does not trigger onboarding start", () => {
  const context = { scopeLocked: true };

  assert.equal(resolveOnboardingStarted([]), false);
  assert.equal(assertOnboardingStartNotInferred(context, []), true);
});

test("phase1 accepted alone does not trigger onboarding start", () => {
  const context = { phase1Accepted: true };

  assert.equal(resolveOnboardingStarted([]), false);
  assert.equal(assertOnboardingStartNotInferred(context, []), true);
});

test("compiled session alone does not trigger onboarding start", () => {
  const context = { firstExecutableSessionCompiled: true };

  assert.equal(resolveOnboardingStarted([]), false);
  assert.equal(assertOnboardingStartNotInferred(context, []), true);
});

test("downstream active conditions alone do not trigger onboarding start", () => {
  const context = {
    activationSignalReceived: true,
    firstExecutableSessionCompiled: true,
  };

  assert.equal(resolveOnboardingStarted([]), false);
  assert.equal(assertOnboardingStartNotInferred(context, []), true);
});

test("paused stopped and cancelled flags alone do not trigger onboarding start", () => {
  assert.equal(
    assertOnboardingStartNotInferred({ pausedByOperator: true }, []),
    true,
  );
  assert.equal(
    assertOnboardingStartNotInferred({ stoppedByOperator: true }, []),
    true,
  );
  assert.equal(
    assertOnboardingStartNotInferred({ cancelledByOperator: true }, []),
    true,
  );
});

test("explicit trigger remains lawful even when ambient setup facts are present", () => {
  const context = {
    commercialSatisfied: true,
    workspaceProvisioned: true,
    coachAccountProvisioned: true,
    athleteAccountProvisioned: true,
    linkAccepted: true,
  };

  assert.equal(resolveOnboardingStarted(["coach_invite_sent"]), true);
  assert.equal(assertOnboardingStartNotInferred(context, ["coach_invite_sent"]), true);
});

test("trigger list is closed world and rejects ambient fact names", () => {
  assert.throws(
    () => getOnboardingStartedTriggerEvents(["commercialSatisfied"]),
    /onboarding_start_event_unknown:commercialSatisfied/,
  );

  assert.throws(
    () => getOnboardingStartedTriggerEvents(["phase1Accepted"]),
    /onboarding_start_event_unknown:phase1Accepted/,
  );

  assert.throws(
    () => getOnboardingStartedTriggerEvents(["firstExecutableSessionCompiled"]),
    /onboarding_start_event_unknown:firstExecutableSessionCompiled/,
  );
});