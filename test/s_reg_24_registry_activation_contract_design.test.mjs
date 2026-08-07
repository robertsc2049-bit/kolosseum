import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER,
  S_REG_24_COVERED_S_REG_23_REQUIREMENTS,
  S_REG_24_FAILURE_TOKEN,
  S_REG_24_FUTURE_ALLOWED_ACTIVATION_MUTATIONS,
  S_REG_24_FUTURE_FORBIDDEN_ACTIVATION_SHORTCUTS,
  S_REG_24_FUTURE_REGISTRY_LOAD_ORDER_EDGES,
  S_REG_24_FUTURE_REQUIRED_PROOF_COMMANDS,
  S_REG_24_REQUIRED_FALSE_FLAGS,
  S_REG_24_REQUIRED_TRUE_FLAGS,
  sReg24LoadRegistryActivationContractDesign,
  sReg24ValidateRegistryActivationContractDesign
} from "../ci/registry/s_reg_24_registry_activation_contract_design.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-24 defines activation contract design without authorising activation", () => {
  const result = sReg24ValidateRegistryActivationContractDesign();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-24");
  assert.equal(result.contract_id, "registry_activation_contract_design");
  assert.equal(result.contract_type, "design_only");
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.contract_design_status, "defined_for_future_explicit_activation_slice_only");
  assert.equal(result.source_hold_slice_id, "S-REG-23");
  assert.equal(result.activation_authorised, false);
  assert.equal(result.activation_ready, false);
  assert.equal(result.active_registry_activation, false);
  assert.equal(result.covered_requirement_count, 11);
});

test("S-REG-24 covers the S-REG-23 required-before-activation checklist exactly", () => {
  const contract = sReg24LoadRegistryActivationContractDesign();
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");

  assert.deepEqual(contract.covered_s_reg_23_requirements, S_REG_24_COVERED_S_REG_23_REQUIREMENTS);
  assert.deepEqual(contract.covered_s_reg_23_requirements, hold.required_before_activation);
  assert.equal(hold.activation_decision, "hold");
  assert.equal(hold.activation_authorised, false);
  assert.equal(hold.activation_ready, false);
  assert.equal(hold.active_registry_activation, false);
});

test("S-REG-24's own historical observation of the active registry surface remains an immutable fact, even after a later slice legitimately extends the live surface", () => {
  const contract = sReg24LoadRegistryActivationContractDesign();
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");

  assert.deepEqual(contract.current_active_registry_surface_observed.registry_index_order, S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER);
  assert.deepEqual(contract.current_active_registry_surface_observed.registry_bundle_keys, S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER);

  assert.deepEqual(registryIndex.order.slice(0, S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER.length), S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER);
  assert.deepEqual(
    Object.keys(registryBundle.registries).slice(0, S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER.length),
    S_REG_24_COMPACT_ACTIVE_REGISTRY_ORDER
  );

  assert.equal(fs.existsSync("registries/threshold_marker_registry.json"), false);
  assert.equal(fs.existsSync("registries/sport_metric_registry_1c.json"), false);
  assert.equal(fs.existsSync("registries/metric_exercise_link_registry_1c_a.json"), false);
});

test("S-REG-24 records which later slices have superseded (acted on) this contract, append-only", () => {
  const contract = sReg24LoadRegistryActivationContractDesign();

  assert.ok(Array.isArray(contract.superseded_by_slice_ids));
  for (const sliceId of contract.superseded_by_slice_ids) {
    assert.equal(typeof sliceId, "string");
    assert.ok(sliceId.trim().length > 0);
  }
});

test("S-REG-24 defines future activation contract gates without making current mutations", () => {
  const contract = sReg24LoadRegistryActivationContractDesign();

  for (const flag of S_REG_24_REQUIRED_TRUE_FLAGS) {
    assert.equal(contract[flag], true, `${flag} must be true`);
  }

  for (const flag of S_REG_24_REQUIRED_FALSE_FLAGS) {
    assert.equal(contract[flag], false, `${flag} must be false`);
  }

  assert.deepEqual(contract.future_allowed_activation_mutations, S_REG_24_FUTURE_ALLOWED_ACTIVATION_MUTATIONS);
  assert.deepEqual(contract.future_forbidden_activation_shortcuts, S_REG_24_FUTURE_FORBIDDEN_ACTIVATION_SHORTCUTS);
  assert.deepEqual(contract.future_registry_load_order_edges, S_REG_24_FUTURE_REGISTRY_LOAD_ORDER_EDGES);
  assert.deepEqual(contract.future_required_proof_commands, S_REG_24_FUTURE_REQUIRED_PROOF_COMMANDS);
});

test("S-REG-24 fails closed if any current activation or runtime mutation flag becomes true", () => {
  for (const flag of S_REG_24_REQUIRED_FALSE_FLAGS) {
    const contract = clone(sReg24LoadRegistryActivationContractDesign());
    contract[flag] = true;

    assert.throws(
      () => sReg24ValidateRegistryActivationContractDesign({ contractDocument: contract }),
      (error) => {
        assert.equal(error.code, S_REG_24_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_24_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-24 fails closed if any required contract design flag becomes false", () => {
  for (const flag of S_REG_24_REQUIRED_TRUE_FLAGS) {
    const contract = clone(sReg24LoadRegistryActivationContractDesign());
    contract[flag] = false;

    assert.throws(
      () => sReg24ValidateRegistryActivationContractDesign({ contractDocument: contract }),
      (error) => {
        assert.equal(error.code, S_REG_24_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_24_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-24 fails closed if future activation proof or shortcut contract drifts", () => {
  const proofDrift = clone(sReg24LoadRegistryActivationContractDesign());
  proofDrift.future_required_proof_commands = proofDrift.future_required_proof_commands.slice(0, -1);

  assert.throws(
    () => sReg24ValidateRegistryActivationContractDesign({ contractDocument: proofDrift }),
    (error) => {
      assert.equal(error.code, S_REG_24_FAILURE_TOKEN);
      assert.equal(error.reason, "s_reg_24_future_required_proof_commands_invalid");
      return true;
    }
  );

  const shortcutDrift = clone(sReg24LoadRegistryActivationContractDesign());
  shortcutDrift.future_forbidden_activation_shortcuts = [...shortcutDrift.future_forbidden_activation_shortcuts].reverse();

  assert.throws(
    () => sReg24ValidateRegistryActivationContractDesign({ contractDocument: shortcutDrift }),
    (error) => {
      assert.equal(error.code, S_REG_24_FAILURE_TOKEN);
      assert.equal(error.reason, "s_reg_24_future_forbidden_activation_shortcuts_invalid");
      return true;
    }
  );
});

test("S-REG-24 fails closed on activation payload semantics", () => {
  for (const forbiddenField of [
    "records",
    "active_registry_records",
    "registry_bundle_payload",
    "registry_index_payload",
    "engine_output",
    "phase1_runtime_schema",
    "marker_evaluator",
    "comparison_result",
    "recorded_value",
    "coach_action",
    "athlete_instruction",
    "programme_assignment_payload",
    "substitution_rule",
    "ui_route",
    "ranking",
    "outcome"
  ]) {
    const contract = clone(sReg24LoadRegistryActivationContractDesign());
    contract[forbiddenField] = "forbidden";

    assert.throws(
      () => sReg24ValidateRegistryActivationContractDesign({ contractDocument: contract }),
      (error) => {
        assert.equal(error.code, S_REG_24_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_24_forbidden_payload_key_present");
        return true;
      }
    );
  }
});