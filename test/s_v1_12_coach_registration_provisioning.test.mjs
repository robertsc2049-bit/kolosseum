import test from "node:test";
import assert from "node:assert/strict";

import {
  coachRegistrationProvisioningCopyIds,
  compileIgnoringCoachRegistrationProvisioning,
  createCoachRegistrationProvisioningRecord,
  stableCoachProvisioningJson,
  validateCoachRegistrationProvisioningInput
} from "../src/coachRegistrationProvisioning.mjs";

function validInput(overrides = {}) {
  return {
    coach_user_id: "coach_001",
    email: "Coach.One@Example.com",
    display_name: "Coach One",
    account_role: "coach",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: "2026-06-13T12:00:00.000Z",
    ...overrides
  };
}

function assertRejected(input, error) {
  const result = createCoachRegistrationProvisioningRecord(input);
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, error);
  assert.equal(result.body.copy_id, "COACH_REGISTRATION_REJECTED");
}

test("S-V1-12 provisions coach identity as product auth state only", () => {
  const result = createCoachRegistrationProvisioningRecord(validInput());

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.surface_id, "coach_registration_provisioning");
  assert.equal(result.body.version, "1.0.0");
  assert.equal(result.body.coach.coach_user_id, "coach_001");
  assert.equal(result.body.coach.email, "coach.one@example.com");
  assert.equal(result.body.coach.display_name, "Coach One");
  assert.equal(result.body.coach.account_role, "coach");
  assert.equal(result.body.coach.account_state, "active");
  assert.equal(result.body.coach.product_auth_state_only, true);
  assert.equal(result.body.coach.engine_visible, false);
  assert.deepEqual(result.body.coach.copy_ids, [
    "COACH_REGISTRATION_CREATED",
    "COACH_REGISTRATION_PRODUCT_AUTH_ONLY"
  ]);
});

test("S-V1-12 accepts invited coach provisioning state", () => {
  const result = createCoachRegistrationProvisioningRecord(validInput({
    account_state: "invited"
  }));

  assert.equal(result.status, 201);
  assert.equal(result.body.coach.account_state, "invited");
  assert.equal(result.body.coach.engine_visible, false);
});

test("S-V1-12 refuses non-coach account roles", () => {
  for (const role of [
    "athlete",
    "team_admin",
    "gym_admin",
    "federation_admin",
    "enterprise_admin",
    "marketplace_seller"
  ]) {
    assertRejected(validInput({ account_role: role }), "coach_registration_role_not_coach");
  }
});

test("S-V1-12 refuses unknown account fields", () => {
  assertRejected(
    {
      ...validInput(),
      org_id: "org_001"
    },
    "coach_registration_unknown_field_refused"
  );
});

test("S-V1-12 refuses engine-visible registration fields", () => {
  assertRejected(
    {
      ...validInput(),
      engine_input: {
        coach_user_id: "coach_001"
      }
    },
    "coach_registration_engine_visible_field_refused"
  );

  assertRejected(
    {
      ...validInput(),
      compile_input: {
        coach_user_id: "coach_001"
      }
    },
    "coach_registration_engine_visible_field_refused"
  );

  assertRejected(
    {
      ...validInput(),
      can_alter_engine_truth: true
    },
    "coach_registration_engine_visible_field_refused"
  );
});

test("S-V1-12 validates required coach identity fields", () => {
  assertRejected(validInput({ coach_user_id: "" }), "coach_registration_coach_user_id_required");
  assertRejected(validInput({ email: "not-an-email" }), "coach_registration_email_invalid");
  assertRejected(validInput({ display_name: "" }), "coach_registration_display_name_required");
  assertRejected(validInput({ account_state: "disabled" }), "coach_registration_account_state_invalid");
  assertRejected(validInput({ accepted_terms_version: "" }), "coach_registration_terms_version_required");
  assertRejected(validInput({ created_at_iso8601: "13/06/2026" }), "coach_registration_created_at_invalid");
});

test("S-V1-12 validation is closed-world and deterministic", () => {
  const first = validateCoachRegistrationProvisioningInput(validInput());
  const second = validateCoachRegistrationProvisioningInput(validInput());

  assert.deepEqual(first, { ok: true });
  assert.equal(stableCoachProvisioningJson(first), stableCoachProvisioningJson(second));
});

test("S-V1-12 coach identity changes do not affect deterministic compile output", () => {
  const phaseLikeInput = {
    actor_type: "coach",
    execution_scope: "coach_managed",
    activity_id: "powerlifting",
    consent_granted: true,
    governing_authority_id: "coach_001",
    subject_id: "athlete_001"
  };

  const firstCoach = createCoachRegistrationProvisioningRecord(validInput({
    coach_user_id: "coach_001",
    email: "coach.one@example.com",
    display_name: "Coach One"
  }));

  const secondCoach = createCoachRegistrationProvisioningRecord(validInput({
    coach_user_id: "coach_002",
    email: "coach.two@example.com",
    display_name: "Coach Two"
  }));

  const before = compileIgnoringCoachRegistrationProvisioning(phaseLikeInput, [firstCoach.body.coach]);
  const after = compileIgnoringCoachRegistrationProvisioning(phaseLikeInput, [secondCoach.body.coach]);

  assert.equal(after, before);
});

test("S-V1-12 account state changes do not affect deterministic compile output", () => {
  const phaseLikeInput = {
    actor_type: "coach",
    execution_scope: "coach_managed",
    activity_id: "general_strength",
    consent_granted: true,
    governing_authority_id: "coach_001",
    subject_id: "athlete_001"
  };

  const invitedCoach = createCoachRegistrationProvisioningRecord(validInput({
    account_state: "invited"
  }));

  const activeCoach = createCoachRegistrationProvisioningRecord(validInput({
    account_state: "active"
  }));

  const invitedCompile = compileIgnoringCoachRegistrationProvisioning(phaseLikeInput, [invitedCoach.body.coach]);
  const activeCompile = compileIgnoringCoachRegistrationProvisioning(phaseLikeInput, [activeCoach.body.coach]);

  assert.equal(activeCompile, invitedCompile);
});

test("S-V1-12 copy identifiers remain factual and non-advisory", () => {
  const joined = coachRegistrationProvisioningCopyIds.join(" ").toLowerCase();

  for (const forbidden of [
    "recommend",
    "optimal",
    "optimise",
    "optimize",
    "readiness",
    "safe",
    "safety",
    "suitable",
    "rank",
    "score",
    "medical",
    "therapy",
    "risk",
    "performance"
  ]) {
    assert.equal(joined.includes(forbidden), false, `copy id leaked forbidden wording: ${forbidden}`);
  }
});
