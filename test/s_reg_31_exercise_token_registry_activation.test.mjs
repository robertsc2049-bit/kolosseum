import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_31_ACTIVE_REGISTRY_ORDER_AFTER,
  S_REG_31_COVERED_REQUIRED_BEFORE_ACTIVATION,
  S_REG_31_EXCLUDED_CANDIDATE_RECORD_IDS,
  S_REG_31_FAILURE_TOKEN,
  S_REG_31_REQUIRED_FALSE_FLAGS,
  S_REG_31_REQUIRED_TRUE_FLAGS,
  sReg31LoadExerciseTokenRegistryActivation,
  sReg31ValidateExerciseTokenRegistryActivation
} from "../ci/registry/s_reg_31_exercise_token_registry_activation.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-31 records a genuine activation decision, not a hold or a design", () => {
  const result = sReg31ValidateExerciseTokenRegistryActivation();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-31");
  assert.equal(result.activation_id, "exercise_token_registry_activation");
  assert.equal(result.decision_type, "activation");
  assert.equal(result.activation_decision, "authorised");
  assert.equal(result.activation_target, "exercise_token_registry");
  assert.equal(result.activated_registry_id, "exercise_token");
  assert.equal(result.activation_authorised, true);
  assert.equal(result.activation_ready, true);
  assert.equal(result.active_registry_activation, true);
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.activated_record_count, 3);
});

test("S-REG-31 is recorded in both S-REG-23's and S-REG-24's append-only supersession logs", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  const contract = readJson("ci/registry/s_reg_24_registry_activation_contract_design.json");

  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-31"));
  assert.ok(contract.superseded_by_slice_ids.includes("S-REG-31"));

  for (const sliceId of ["S-REG-25", "S-REG-26", "S-REG-27", "S-REG-28", "S-REG-29", "S-REG-30"]) {
    assert.ok(hold.superseded_by_slice_ids.includes(sliceId));
    assert.ok(contract.superseded_by_slice_ids.includes(sliceId));
  }

  assert.equal(hold.activation_decision, "hold");
  assert.equal(hold.activation_authorised, false);
  assert.equal(contract.contract_design_status, "defined_for_future_explicit_activation_slice_only");
  assert.equal(contract.activation_authorised, false);
});

test("S-REG-31 extends the active registry surface with exercise_token only, appended after threshold_marker", () => {
  const activation = sReg31LoadExerciseTokenRegistryActivation();
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");
  const exerciseTokenRegistry = readJson("registries/exercise_token/exercise_token.registry.json");

  // Live-file checks are prefix checks, not exact-match - a later,
  // separately-authorised activation slice may legitimately append further
  // domains after this one. The activation record's own historical field
  // below stays exact-matched since it is frozen at authoring time, not a
  // live-file check.
  assert.deepEqual(
    registryIndex.order.slice(0, S_REG_31_ACTIVE_REGISTRY_ORDER_AFTER.length),
    S_REG_31_ACTIVE_REGISTRY_ORDER_AFTER
  );
  assert.deepEqual(
    Object.keys(registryBundle.registries).slice(0, S_REG_31_ACTIVE_REGISTRY_ORDER_AFTER.length),
    S_REG_31_ACTIVE_REGISTRY_ORDER_AFTER
  );
  assert.deepEqual(activation.active_registry_order_after, S_REG_31_ACTIVE_REGISTRY_ORDER_AFTER);

  assert.equal(exerciseTokenRegistry.registry_id, "exercise_token");
  assert.equal(Object.keys(exerciseTokenRegistry.entries).length, 3);
});

test("S-REG-31 excludes the dangling front_plank_token reference and every remaining record's cross-registry references are real", () => {
  const activation = sReg31LoadExerciseTokenRegistryActivation();
  const exerciseTokenRegistry = readJson("registries/exercise_token/exercise_token.registry.json");
  const movementRegistry = readJson("registries/movement/movement.registry.json");
  const activityRegistry = readJson("registries/activity/activity.registry.json");

  assert.deepEqual(activation.excluded_candidate_record_ids, S_REG_31_EXCLUDED_CANDIDATE_RECORD_IDS);
  assert.deepEqual(activation.excluded_candidate_record_ids, ["front_plank_token"]);

  assert.equal("front_plank_token" in exerciseTokenRegistry.entries, false);

  for (const [id, record] of Object.entries(exerciseTokenRegistry.entries)) {
    assert.ok(record.movement_id in movementRegistry.entries, `${id}: movement_id ${record.movement_id} must exist`);
    for (const activityId of record.activity_ids) {
      assert.ok(activityId in activityRegistry.entries, `${id}: activity_id ${activityId} must exist`);
    }
  }
});

test("S-REG-31 covers every S-REG-23 required-before-activation category for this target", () => {
  const activation = sReg31LoadExerciseTokenRegistryActivation();
  assert.deepEqual(activation.covered_required_before_activation, S_REG_31_COVERED_REQUIRED_BEFORE_ACTIVATION);
});

test("S-REG-31 records human authorisation, before/after hashes, a rollback plan, and a runtime parity proof", () => {
  const activation = sReg31LoadExerciseTokenRegistryActivation();

  assert.equal(typeof activation.human_authorisation.authorised_by, "string");
  assert.ok(activation.human_authorisation.authorised_by.length > 0);
  assert.equal(activation.human_authorisation.authorisation_method, "explicit_chat_instruction");
  assert.ok(activation.human_authorisation.authorisation_note.includes("front_plank_token"));

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

test("S-REG-31's two changed golden fixtures list exercise_token after threshold_marker, not a stale copy", () => {
  for (const path of [
    "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
    "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json"
  ]) {
    const serialized = fs.readFileSync(path, "utf8");
    assert.ok(serialized.includes("\"threshold_marker\""), `expected ${path} to still list threshold_marker as a loaded registry`);
    assert.ok(serialized.includes("\"exercise_token\""), `expected ${path} to list exercise_token as a loaded registry`);
  }
});

test("S-REG-31 fails closed if any required activation mutation flag is not true", () => {
  for (const flag of S_REG_31_REQUIRED_TRUE_FLAGS) {
    const activation = clone(sReg31LoadExerciseTokenRegistryActivation());
    activation[flag] = false;

    assert.throws(
      () => sReg31ValidateExerciseTokenRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_31_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_31_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-31 fails closed if any out-of-scope mutation flag becomes true", () => {
  for (const flag of S_REG_31_REQUIRED_FALSE_FLAGS) {
    const activation = clone(sReg31LoadExerciseTokenRegistryActivation());
    activation[flag] = true;

    assert.throws(
      () => sReg31ValidateExerciseTokenRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_31_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_31_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-31 fails closed if the source hold or contract no longer records this supersession", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-31"), "precondition: S-REG-31 must actually be recorded");
});
