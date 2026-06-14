// DEV NOTE: Human-maintained S-V1-19 test. Proves executable-session flow is
// gated by factual account, relationship, and declaration state only.

import test from "node:test";
import assert from "node:assert/strict";

import {
  OnboardingStartGateError,
  assertOnboardingStartGateAllowsExecutableSessionFlow,
  compileIgnoringOnboardingStartGate,
  onboardingStartGateBlockedReasons,
  resolveOnboardingStartGate
} from "../src/onboardingStartGate.mjs";
import {
  createPhase1DeclarationRecord,
  phase1DeclarationPins,
  stablePhase1DeclarationJson,
  supersedeAcceptedDeclarationRecord
} from "../src/phase1DeclarationSurface.mjs";

function validAthleteAccount(overrides = {}) {
  return {
    athlete_user_id: "athlete_001",
    email: "athlete.one@example.com",
    display_name: "Athlete One",
    account_role: "athlete",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: "2026-06-14T12:00:00.000Z",
    product_auth_state_only: true,
    engine_visible: false,
    ...overrides
  };
}

function validRelationship(overrides = {}) {
  return {
    relationship_id: "relationship_001",
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: "2026-06-14T13:00:00.000Z",
    created_at_iso8601: "2026-06-14T12:00:00.000Z",
    updated_at_iso8601: "2026-06-14T13:00:00.000Z",
    revoked_at_iso8601: null,
    expires_at_iso8601: null,
    product_permission_state_only: true,
    engine_visible: false,
    ...overrides
  };
}

function validPayload(overrides = {}) {
  return {
    actor_type: "individual_user",
    execution_scope: "individual",
    activity_id: "powerlifting",
    phase1_schema_version: phase1DeclarationPins.phase1_schema_version,
    engine_compatibility: phase1DeclarationPins.engine_compatibility,
    enum_bundle_version: phase1DeclarationPins.enum_bundle_version,
    consent_granted: true,
    jurisdiction_acknowledged: true,
    ...overrides
  };
}

function validDeclarationInput(overrides = {}) {
  return {
    declaration_id: "declaration_v1_19_001",
    declared_by_user_id: "athlete_001",
    subject_user_id: "athlete_001",
    declaration_source: "user_declared",
    declaration_scope: "phase1_compile_prerequisite",
    declaration_state: "accepted",
    declaration_payload: validPayload(),
    declared_at_iso8601: "2026-06-14T14:00:00.000Z",
    accepted_terms_version: "terms_v1",
    copy_acknowledgement_id: "PHASE_1_DECLARATION_USER_DECLARED_FACTUAL",
    ...overrides
  };
}

function validDeclarationRecord(overrides = {}) {
  const result = createPhase1DeclarationRecord(validDeclarationInput(overrides));
  assert.equal(result.status, 201);
  return result.body.declaration;
}

function phaseLikeInput(overrides = {}) {
  return {
    actor_type: "individual_user",
    execution_scope: "individual",
    activity_id: "powerlifting",
    consent_granted: true,
    jurisdiction_acknowledged: true,
    ...overrides
  };
}

function validGateInput(overrides = {}) {
  return {
    onboarding_events: ["athlete_invite_sent"],
    athlete_user_id: "athlete_001",
    athlete_account: validAthleteAccount(),
    relationship_records: [validRelationship()],
    declaration_record: validDeclarationRecord(),
    phase_like_input: phaseLikeInput(),
    ...overrides
  };
}

test("S-V1-19 blocked reason registry is exact and factual", () => {
  assert.deepEqual(onboardingStartGateBlockedReasons, [
    "onboarding_start_trigger_missing",
    "onboarding_start_trigger_invalid",
    "athlete_account_missing",
    "athlete_account_inactive",
    "coach_athlete_relationship_missing",
    "coach_athlete_relationship_not_accepted",
    "phase1_declaration_missing",
    "phase1_declaration_not_current_valid"
  ]);

  for (const reason of onboardingStartGateBlockedReasons) {
    assert.doesNotMatch(reason, /recommend|advice|medical|diagnosis|clearance|team|rank|score/i);
  }
});

test("S-V1-19 blocks missing onboarding trigger with factual reason", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    onboarding_events: []
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["onboarding_start_trigger_missing"]);
});

test("S-V1-19 blocks unknown onboarding trigger with factual reason", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    onboarding_events: ["workspace_provisioned"]
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["onboarding_start_trigger_invalid"]);
});

test("S-V1-19 blocks missing athlete account with factual reason", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    athlete_account: null
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["athlete_account_missing"]);
});

test("S-V1-19 blocks inactive athlete account with factual reason", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    athlete_account: validAthleteAccount({
      account_state: "invited"
    })
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["athlete_account_inactive"]);
});

test("S-V1-19 blocks missing relationship with factual reason", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    relationship_records: []
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["coach_athlete_relationship_missing"]);
});

test("S-V1-19 blocks non-accepted relationship with factual reason", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    relationship_records: [
      validRelationship({
        relationship_state: "invited",
        accepted_at_iso8601: null
      })
    ]
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["coach_athlete_relationship_not_accepted"]);
});

test("S-V1-19 blocks missing declaration with factual reason", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    declaration_record: null
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["phase1_declaration_missing"]);
});

test("S-V1-19 blocks superseded declaration with factual reason", () => {
  const record = validDeclarationRecord();
  const superseded = supersedeAcceptedDeclarationRecord(record, "2026-06-15T12:00:00.000Z");

  const result = resolveOnboardingStartGate(validGateInput({
    declaration_record: superseded
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["phase1_declaration_not_current_valid"]);
});

test("S-V1-19 blocks mismatched declaration hash with factual reason", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    declaration_record: {
      ...validDeclarationRecord(),
      declaration_payload_sha256: "0".repeat(64)
    }
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, ["phase1_declaration_not_current_valid"]);
});

test("S-V1-19 collects multiple factual blocked reasons in stable order", () => {
  const result = resolveOnboardingStartGate(validGateInput({
    onboarding_events: [],
    athlete_account: null,
    relationship_records: [],
    declaration_record: null
  }));

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blocked_reasons, [
    "onboarding_start_trigger_missing",
    "athlete_account_missing",
    "coach_athlete_relationship_missing",
    "phase1_declaration_missing"
  ]);
});

test("S-V1-19 valid path is allowed", () => {
  const result = resolveOnboardingStartGate(validGateInput());

  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.surface_id, "onboarding_start_gate");
  assert.equal(result.version, "1.0.0");
  assert.deepEqual(result.blocked_reasons, []);
  assert.equal(result.compile_admission, "declaration_current_valid");
  assert.equal(result.compile_probe_output, stablePhase1DeclarationJson(phaseLikeInput()));
  assert.equal(result.product_onboarding_state_only, true);
  assert.equal(result.engine_visible, false);
});

test("S-V1-19 assert wrapper throws blocked error with factual reasons", () => {
  assert.throws(
    () => assertOnboardingStartGateAllowsExecutableSessionFlow(validGateInput({
      athlete_account: null
    })),
    (error) =>
      error instanceof OnboardingStartGateError &&
      error.code === "onboarding_start_gate_blocked" &&
      error.blocked_reasons.includes("athlete_account_missing") &&
      error.product_onboarding_state_only === true &&
      error.engine_visible === false
  );

  assert.equal(assertOnboardingStartGateAllowsExecutableSessionFlow(validGateInput()), true);
});

test("S-V1-19 product state cannot mutate engine-facing probe output", () => {
  const phaseInput = phaseLikeInput();

  const first = resolveOnboardingStartGate(validGateInput({
    external_product_state: {
      coach_note_state: "present",
      presentation_state: "compact",
      billing_status: "paid"
    }
  }));

  const second = resolveOnboardingStartGate(validGateInput({
    external_product_state: {
      coach_note_state: "changed",
      presentation_state: "expanded",
      billing_status: "unpaid"
    }
  }));

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(first.compile_probe_output, second.compile_probe_output);

  assert.equal(
    compileIgnoringOnboardingStartGate(phaseInput, [first]),
    stablePhase1DeclarationJson(phaseInput)
  );

  assert.equal(
    compileIgnoringOnboardingStartGate(phaseInput, [second]),
    stablePhase1DeclarationJson(phaseInput)
  );
});
