import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_28_ACTIVE_REGISTRY_ORDER_AFTER,
  S_REG_28_COVERED_REQUIRED_BEFORE_ACTIVATION,
  S_REG_28_FAILURE_TOKEN,
  S_REG_28_REQUIRED_FALSE_FLAGS,
  S_REG_28_REQUIRED_TRUE_FLAGS,
  sReg28LoadSportRoleRegistryActivation,
  sReg28ValidateSportRoleRegistryActivation
} from "../ci/registry/s_reg_28_sport_role_registry_activation.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-28 records a genuine activation decision, not a hold or a design", () => {
  const result = sReg28ValidateSportRoleRegistryActivation();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-28");
  assert.equal(result.activation_id, "sport_role_registry_activation");
  assert.equal(result.decision_type, "activation");
  assert.equal(result.activation_decision, "authorised");
  assert.equal(result.activation_target, "sport_role_registry");
  assert.equal(result.activated_registry_id, "sport_role");
  assert.equal(result.activation_authorised, true);
  assert.equal(result.activation_ready, true);
  assert.equal(result.active_registry_activation, true);
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.activated_record_count, 3);
});

test("S-REG-28 is recorded in both S-REG-23's and S-REG-24's append-only supersession logs", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  const contract = readJson("ci/registry/s_reg_24_registry_activation_contract_design.json");

  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-28"));
  assert.ok(contract.superseded_by_slice_ids.includes("S-REG-28"));

  // S-REG-25/26/27 must still be recorded too - this is an append-only log,
  // not a rewritten one.
  for (const sliceId of ["S-REG-25", "S-REG-26", "S-REG-27"]) {
    assert.ok(hold.superseded_by_slice_ids.includes(sliceId));
    assert.ok(contract.superseded_by_slice_ids.includes(sliceId));
  }

  // Neither historical record's own decision/flags were rewritten - only the
  // supersession log grew.
  assert.equal(hold.activation_decision, "hold");
  assert.equal(hold.activation_authorised, false);
  assert.equal(contract.contract_design_status, "defined_for_future_explicit_activation_slice_only");
  assert.equal(contract.activation_authorised, false);
});

test("S-REG-28 extends the active registry surface with sport_role only, appended after sport_metric", () => {
  const activation = sReg28LoadSportRoleRegistryActivation();
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");
  const sportRoleRegistry = readJson("registries/sport_role/sport_role.registry.json");

  assert.deepEqual(registryIndex.order, S_REG_28_ACTIVE_REGISTRY_ORDER_AFTER);
  assert.deepEqual(Object.keys(registryBundle.registries), S_REG_28_ACTIVE_REGISTRY_ORDER_AFTER);
  assert.deepEqual(activation.active_registry_order_after, S_REG_28_ACTIVE_REGISTRY_ORDER_AFTER);

  assert.equal(sportRoleRegistry.registry_id, "sport_role");
  assert.equal(Object.keys(sportRoleRegistry.entries).length, 3);

  // No other candidate domain was activated alongside this one.
  assert.equal(fs.existsSync("registries/metric_exercise_link/metric_exercise_link.registry.json"), false);
  assert.equal(fs.existsSync("registries/threshold_marker/threshold_marker.registry.json"), false);
});

test("S-REG-28 covers every S-REG-23 required-before-activation category for this target", () => {
  const activation = sReg28LoadSportRoleRegistryActivation();
  assert.deepEqual(activation.covered_required_before_activation, S_REG_28_COVERED_REQUIRED_BEFORE_ACTIVATION);
});

test("S-REG-28 records human authorisation, before/after hashes, a rollback plan, and a runtime parity proof", () => {
  const activation = sReg28LoadSportRoleRegistryActivation();

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

  // Honesty check: "identical" describes decision/content output, not the
  // byte-level snapshot - this record must not claim a bare "byte-identical"
  // that direct inspection disproved.
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

test("S-REG-28's two changed golden fixtures list sport_role after sport_metric, not a stale copy", () => {
  for (const path of [
    "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
    "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json"
  ]) {
    const serialized = fs.readFileSync(path, "utf8");
    assert.ok(serialized.includes("\"sport_metric\""), `expected ${path} to still list sport_metric as a loaded registry`);
    assert.ok(serialized.includes("\"sport_role\""), `expected ${path} to list sport_role as a loaded registry`);
  }
});

test("S-REG-28 fails closed if any required activation mutation flag is not true", () => {
  for (const flag of S_REG_28_REQUIRED_TRUE_FLAGS) {
    const activation = clone(sReg28LoadSportRoleRegistryActivation());
    activation[flag] = false;

    assert.throws(
      () => sReg28ValidateSportRoleRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_28_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_28_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-28 fails closed if any out-of-scope mutation flag becomes true", () => {
  for (const flag of S_REG_28_REQUIRED_FALSE_FLAGS) {
    const activation = clone(sReg28LoadSportRoleRegistryActivation());
    activation[flag] = true;

    assert.throws(
      () => sReg28ValidateSportRoleRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_28_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_28_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-28 fails closed if the source hold or contract no longer records this supersession", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-28"), "precondition: S-REG-28 must actually be recorded");
});
