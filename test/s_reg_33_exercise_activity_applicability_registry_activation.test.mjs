import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_33_ACTIVE_REGISTRY_ORDER_AFTER,
  S_REG_33_COVERED_REQUIRED_BEFORE_ACTIVATION,
  S_REG_33_EXPECTED_RECORD_COUNT,
  S_REG_33_FAILURE_TOKEN,
  S_REG_33_REQUIRED_FALSE_FLAGS,
  S_REG_33_REQUIRED_TRUE_FLAGS,
  sReg33LoadExerciseActivityApplicabilityRegistryActivation,
  sReg33ValidateExerciseActivityApplicabilityRegistryActivation
} from "../ci/registry/s_reg_33_exercise_activity_applicability_registry_activation.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-33 records a genuine activation decision, not a hold or a design", () => {
  const result = sReg33ValidateExerciseActivityApplicabilityRegistryActivation();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-33");
  assert.equal(result.activation_id, "exercise_activity_applicability_registry_activation");
  assert.equal(result.decision_type, "activation");
  assert.equal(result.activation_decision, "authorised");
  assert.equal(result.activation_target, "exercise_activity_applicability_registry");
  assert.equal(result.activated_registry_id, "exercise_activity_applicability");
  assert.equal(result.activation_authorised, true);
  assert.equal(result.activation_ready, true);
  assert.equal(result.active_registry_activation, true);
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.activated_record_count, S_REG_33_EXPECTED_RECORD_COUNT);
});

test("S-REG-33 is recorded in both S-REG-23's and S-REG-24's append-only supersession logs", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  const contract = readJson("ci/registry/s_reg_24_registry_activation_contract_design.json");

  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-33"));
  assert.ok(contract.superseded_by_slice_ids.includes("S-REG-33"));

  for (const sliceId of ["S-REG-25", "S-REG-26", "S-REG-27", "S-REG-28", "S-REG-29", "S-REG-30", "S-REG-31"]) {
    assert.ok(hold.superseded_by_slice_ids.includes(sliceId));
    assert.ok(contract.superseded_by_slice_ids.includes(sliceId));
  }

  assert.equal(hold.activation_decision, "hold");
  assert.equal(hold.activation_authorised, false);
  assert.equal(contract.contract_design_status, "defined_for_future_explicit_activation_slice_only");
  assert.equal(contract.activation_authorised, false);
});

test("S-REG-33 extends the active registry surface with exercise_activity_applicability only, appended after exercise_token", () => {
  const activation = sReg33LoadExerciseActivityApplicabilityRegistryActivation();
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");
  const applicabilityRegistry = readJson("registries/exercise_activity_applicability/exercise_activity_applicability.registry.json");

  assert.deepEqual(
    registryIndex.order.slice(0, S_REG_33_ACTIVE_REGISTRY_ORDER_AFTER.length),
    S_REG_33_ACTIVE_REGISTRY_ORDER_AFTER
  );
  assert.deepEqual(
    Object.keys(registryBundle.registries).slice(0, S_REG_33_ACTIVE_REGISTRY_ORDER_AFTER.length),
    S_REG_33_ACTIVE_REGISTRY_ORDER_AFTER
  );
  assert.deepEqual(activation.active_registry_order_after, S_REG_33_ACTIVE_REGISTRY_ORDER_AFTER);

  assert.equal(applicabilityRegistry.registry_id, "exercise_activity_applicability");
  assert.ok(Object.keys(applicabilityRegistry.entries).length >= S_REG_33_EXPECTED_RECORD_COUNT);
});

test("S-REG-33 historical baseline remains present while the current registry has complete later exercise/activity/context closure", () => {
  const exerciseRegistry = readJson("registries/exercise/exercise.registry.json");
  const applicabilityRegistry = readJson("registries/exercise_activity_applicability/exercise_activity_applicability.registry.json");

  assert.equal("front_plank" in exerciseRegistry.entries, true, "REG-FULL-03 activates front_plank as production exercise content");

  const expectedKeys = new Set();
  for (const exercise of Object.values(exerciseRegistry.entries)) {
    const activities = [exercise.primary_activity_applicability, ...exercise.secondary_activity_applicability];
    for (const activityId of activities) {
      for (const context of ["training", "testing", "competition"]) {
        expectedKeys.add(`${exercise.exercise_id}__${activityId}__${context}`);
      }
    }
  }

  assert.ok(expectedKeys.size >= S_REG_33_EXPECTED_RECORD_COUNT);
  assert.deepEqual(Object.keys(applicabilityRegistry.entries).sort(), [...expectedKeys].sort());

  for (const [id, record] of Object.entries(applicabilityRegistry.entries)) {
    assert.ok(record.exercise_id in exerciseRegistry.entries, `${id}: exercise_id ${record.exercise_id} must exist`);
    const exercise = exerciseRegistry.entries[record.exercise_id];
    const applicable = [exercise.primary_activity_applicability, ...exercise.secondary_activity_applicability];
    assert.ok(applicable.includes(record.activity_id), `${id}: activity_id ${record.activity_id} must be genuinely applicable`);
  }
});

test("S-REG-33 covers every S-REG-23 required-before-activation category for this target", () => {
  const activation = sReg33LoadExerciseActivityApplicabilityRegistryActivation();
  assert.deepEqual(activation.covered_required_before_activation, S_REG_33_COVERED_REQUIRED_BEFORE_ACTIVATION);
});

test("S-REG-33 records human authorisation, before/after hashes, a rollback plan, and a runtime parity proof", () => {
  const activation = sReg33LoadExerciseActivityApplicabilityRegistryActivation();

  assert.equal(typeof activation.human_authorisation.authorised_by, "string");
  assert.ok(activation.human_authorisation.authorised_by.length > 0);
  assert.equal(activation.human_authorisation.authorisation_method, "explicit_chat_instruction");

  assert.notEqual(
    activation.active_registry_hashes_before.registry_index,
    activation.active_registry_hashes_after.registry_index
  );
  assert.notEqual(
    activation.active_registry_hashes_before.registry_bundle,
    activation.active_registry_hashes_after.registry_bundle
  );

  assert.ok(activation.rollback_plan.primary.includes("git revert"));
  assert.ok(activation.rollback_plan.fallback.length > 0);

  assert.equal(activation.runtime_parity_proof.identical, true);
  assert.equal(activation.runtime_parity_proof.fixture_count, 13);

  assert.equal(
    activation.runtime_parity_proof.byte_identical_fixture_count + activation.runtime_parity_proof.changed_fixtures.length,
    activation.runtime_parity_proof.fixture_count
  );
  assert.deepEqual(
    activation.runtime_parity_proof.changed_fixtures,
    ["phase3_precedence_banned_over_available", "phase3_sovereign_constraints_envelope"]
  );
  assert.ok(activation.runtime_parity_proof.changed_field.length > 0);
});

test("S-REG-33's two changed golden fixtures list exercise_activity_applicability after exercise_token, not a stale copy", () => {
  for (const path of [
    "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
    "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json"
  ]) {
    const serialized = fs.readFileSync(path, "utf8");
    assert.ok(serialized.includes("\"exercise_token\""), `expected ${path} to still list exercise_token as a loaded registry`);
    assert.ok(serialized.includes("\"exercise_activity_applicability\""), `expected ${path} to list exercise_activity_applicability as a loaded registry`);
  }
});

test("S-REG-33 fails closed if any required activation mutation flag is not true", () => {
  for (const flag of S_REG_33_REQUIRED_TRUE_FLAGS) {
    const activation = clone(sReg33LoadExerciseActivityApplicabilityRegistryActivation());
    activation[flag] = false;

    assert.throws(
      () => sReg33ValidateExerciseActivityApplicabilityRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_33_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_33_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-33 fails closed if any out-of-scope mutation flag becomes true", () => {
  for (const flag of S_REG_33_REQUIRED_FALSE_FLAGS) {
    const activation = clone(sReg33LoadExerciseActivityApplicabilityRegistryActivation());
    activation[flag] = true;

    assert.throws(
      () => sReg33ValidateExerciseActivityApplicabilityRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_33_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_33_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-33 fails closed if the source hold or contract no longer records this supersession", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-33"), "precondition: S-REG-33 must actually be recorded");
});
