import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_29_ACTIVE_REGISTRY_ORDER_AFTER,
  S_REG_29_COVERED_REQUIRED_BEFORE_ACTIVATION,
  S_REG_29_EXCLUDED_CANDIDATE_RECORD_IDS,
  S_REG_29_FAILURE_TOKEN,
  S_REG_29_REQUIRED_FALSE_FLAGS,
  S_REG_29_REQUIRED_TRUE_FLAGS,
  sReg29LoadMetricExerciseLinkRegistryActivation,
  sReg29ValidateMetricExerciseLinkRegistryActivation
} from "../ci/registry/s_reg_29_metric_exercise_link_registry_activation.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-29 records a genuine activation decision, not a hold or a design", () => {
  const result = sReg29ValidateMetricExerciseLinkRegistryActivation();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-29");
  assert.equal(result.activation_id, "metric_exercise_link_registry_activation");
  assert.equal(result.decision_type, "activation");
  assert.equal(result.activation_decision, "authorised");
  assert.equal(result.activation_target, "metric_exercise_link_registry");
  assert.equal(result.activated_registry_id, "metric_exercise_link");
  assert.equal(result.activation_authorised, true);
  assert.equal(result.activation_ready, true);
  assert.equal(result.active_registry_activation, true);
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.activated_record_count, 12);
});

test("S-REG-29 is recorded in both S-REG-23's and S-REG-24's append-only supersession logs", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  const contract = readJson("ci/registry/s_reg_24_registry_activation_contract_design.json");

  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-29"));
  assert.ok(contract.superseded_by_slice_ids.includes("S-REG-29"));

  for (const sliceId of ["S-REG-25", "S-REG-26", "S-REG-27", "S-REG-28"]) {
    assert.ok(hold.superseded_by_slice_ids.includes(sliceId));
    assert.ok(contract.superseded_by_slice_ids.includes(sliceId));
  }

  assert.equal(hold.activation_decision, "hold");
  assert.equal(hold.activation_authorised, false);
  assert.equal(contract.contract_design_status, "defined_for_future_explicit_activation_slice_only");
  assert.equal(contract.activation_authorised, false);
});

test("S-REG-29 extends the active registry surface with metric_exercise_link only, appended after sport_role", () => {
  const activation = sReg29LoadMetricExerciseLinkRegistryActivation();
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");
  const metricExerciseLinkRegistry = readJson("registries/metric_exercise_link/metric_exercise_link.registry.json");

  assert.deepEqual(registryIndex.order, S_REG_29_ACTIVE_REGISTRY_ORDER_AFTER);
  assert.deepEqual(Object.keys(registryBundle.registries), S_REG_29_ACTIVE_REGISTRY_ORDER_AFTER);
  assert.deepEqual(activation.active_registry_order_after, S_REG_29_ACTIVE_REGISTRY_ORDER_AFTER);

  assert.equal(metricExerciseLinkRegistry.registry_id, "metric_exercise_link");
  assert.equal(Object.keys(metricExerciseLinkRegistry.entries).length, 12);

  // No other candidate domain was activated alongside this one.
  assert.equal(fs.existsSync("registries/threshold_marker/threshold_marker.registry.json"), false);
});

test("S-REG-29 excludes the dangling front_plank reference and every remaining record's cross-registry references are real", () => {
  const activation = sReg29LoadMetricExerciseLinkRegistryActivation();
  const metricExerciseLinkRegistry = readJson("registries/metric_exercise_link/metric_exercise_link.registry.json");
  const exerciseRegistry = readJson("registries/exercise/exercise.registry.json");
  const sportMetricRegistry = readJson("registries/sport_metric/sport_metric.registry.json");

  assert.deepEqual(activation.excluded_candidate_record_ids, S_REG_29_EXCLUDED_CANDIDATE_RECORD_IDS);
  assert.deepEqual(activation.excluded_candidate_record_ids, ["rugby_union__body_mass_kg__front_plank"]);

  assert.equal("rugby_union__body_mass_kg__front_plank" in metricExerciseLinkRegistry.entries, false);

  for (const [id, record] of Object.entries(metricExerciseLinkRegistry.entries)) {
    assert.ok(record.exercise_id in exerciseRegistry.entries, `${id}: exercise_id ${record.exercise_id} must exist`);
    assert.ok(record.sport_metric_id in sportMetricRegistry.entries, `${id}: sport_metric_id ${record.sport_metric_id} must exist`);
  }
});

test("S-REG-29 covers every S-REG-23 required-before-activation category for this target", () => {
  const activation = sReg29LoadMetricExerciseLinkRegistryActivation();
  assert.deepEqual(activation.covered_required_before_activation, S_REG_29_COVERED_REQUIRED_BEFORE_ACTIVATION);
});

test("S-REG-29 records human authorisation, before/after hashes, a rollback plan, and a runtime parity proof", () => {
  const activation = sReg29LoadMetricExerciseLinkRegistryActivation();

  assert.equal(typeof activation.human_authorisation.authorised_by, "string");
  assert.ok(activation.human_authorisation.authorised_by.length > 0);
  assert.equal(activation.human_authorisation.authorisation_method, "explicit_chat_instruction");
  assert.ok(activation.human_authorisation.authorisation_note.includes("front_plank"));

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

test("S-REG-29's two changed golden fixtures list metric_exercise_link after sport_role, not a stale copy", () => {
  for (const path of [
    "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
    "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json"
  ]) {
    const serialized = fs.readFileSync(path, "utf8");
    assert.ok(serialized.includes("\"sport_role\""), `expected ${path} to still list sport_role as a loaded registry`);
    assert.ok(serialized.includes("\"metric_exercise_link\""), `expected ${path} to list metric_exercise_link as a loaded registry`);
  }
});

test("S-REG-29 fails closed if any required activation mutation flag is not true", () => {
  for (const flag of S_REG_29_REQUIRED_TRUE_FLAGS) {
    const activation = clone(sReg29LoadMetricExerciseLinkRegistryActivation());
    activation[flag] = false;

    assert.throws(
      () => sReg29ValidateMetricExerciseLinkRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_29_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_29_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-29 fails closed if any out-of-scope mutation flag becomes true", () => {
  for (const flag of S_REG_29_REQUIRED_FALSE_FLAGS) {
    const activation = clone(sReg29LoadMetricExerciseLinkRegistryActivation());
    activation[flag] = true;

    assert.throws(
      () => sReg29ValidateMetricExerciseLinkRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_29_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_29_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-29 fails closed if the source hold or contract no longer records this supersession", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-29"), "precondition: S-REG-29 must actually be recorded");
});
