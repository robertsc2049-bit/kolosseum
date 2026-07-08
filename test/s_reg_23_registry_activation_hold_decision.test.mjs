import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_23_CANDIDATE_CHAIN_REVIEWED,
  S_REG_23_FAILURE_TOKEN,
  S_REG_23_HOLD_REASON_CODES,
  S_REG_23_REQUIRED_BEFORE_ACTIVATION,
  S_REG_23_REQUIRED_FALSE_FLAGS,
  sReg23LoadRegistryActivationHoldDecision,
  sReg23ValidateRegistryActivationHoldDecision
} from "../ci/registry/s_reg_23_registry_activation_hold_decision.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-23 records a hold decision only", () => {
  const result = sReg23ValidateRegistryActivationHoldDecision();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-23");
  assert.equal(result.decision_id, "registry_activation_hold_decision");
  assert.equal(result.decision_type, "hold");
  assert.equal(result.activation_decision, "hold");
  assert.equal(result.activation_authorised, false);
  assert.equal(result.activation_ready, false);
  assert.equal(result.active_registry_activation, false);
  assert.equal(result.runtime_status, "non_runtime");
  assert.deepEqual(result.hold_reason_codes, S_REG_23_HOLD_REASON_CODES);
  assert.deepEqual(result.required_before_activation, S_REG_23_REQUIRED_BEFORE_ACTIVATION);
});

test("S-REG-23 source review remains the S-REG-22 later-activation requirement", () => {
  const decision = sReg23LoadRegistryActivationHoldDecision();
  const review = readJson("ci/registry/s_reg_22_candidate_registry_build_review.json");

  assert.equal(decision.source_review_slice_id, "S-REG-22");
  assert.equal(decision.source_review_id, "candidate_registry_review_and_activation_gate");
  assert.equal(decision.source_review_status, "candidate_reviewed_fk_closed_pending_activation_decision");
  assert.equal(review.activation_decision, "not_authorised_pending_later_explicit_activation_slice");
  assert.equal(review.later_activation_requirement, "separate_explicit_activation_slice_required");
  assert.equal(review.active_registry_activation, false);
  assert.equal(review.activation_ready, false);
});

test("S-REG-23 active registry surface remains compact and unchanged", () => {
  const decision = sReg23LoadRegistryActivationHoldDecision();
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");

  assert.deepEqual(registryIndex.order, ["activity", "movement", "exercise", "program"]);
  assert.deepEqual(Object.keys(registryBundle.registries), ["activity", "movement", "exercise", "program"]);
  assert.deepEqual(decision.active_registry_surface_observed.registry_index_order, registryIndex.order);
  assert.deepEqual(decision.active_registry_surface_observed.registry_bundle_keys, Object.keys(registryBundle.registries));

  assert.equal(fs.existsSync("registries/threshold_marker_registry.json"), false);
  assert.equal(fs.existsSync("registries/sport_metric_registry_1c.json"), false);
  assert.equal(fs.existsSync("registries/metric_exercise_link_registry_1c_a.json"), false);
});

test("S-REG-23 candidate chain is reviewed but not activated", () => {
  const decision = sReg23LoadRegistryActivationHoldDecision();

  assert.deepEqual(decision.candidate_chain_reviewed, S_REG_23_CANDIDATE_CHAIN_REVIEWED);

  for (const path of [
    "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json",
    "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.json",
    "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.json",
    "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.json",
    "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
    "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json",
    "ci/registry/s_reg_21_threshold_marker_candidate_records.json",
    "ci/registry/s_reg_22_candidate_registry_build_review.json"
  ]) {
    assert.equal(fs.existsSync(path), true, path);
  }
});

test("S-REG-23 fails closed if any activation or runtime mutation flag is true", () => {
  for (const flag of S_REG_23_REQUIRED_FALSE_FLAGS) {
    const decision = clone(sReg23LoadRegistryActivationHoldDecision());
    decision[flag] = true;

    assert.throws(
      () => sReg23ValidateRegistryActivationHoldDecision({ decisionDocument: decision }),
      (error) => {
        assert.equal(error.code, S_REG_23_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_23_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-23 fails closed if hold reasons or activation requirements drift", () => {
  const reasonDrift = clone(sReg23LoadRegistryActivationHoldDecision());
  reasonDrift.hold_reason_codes = [...reasonDrift.hold_reason_codes].reverse();

  assert.throws(
    () => sReg23ValidateRegistryActivationHoldDecision({ decisionDocument: reasonDrift }),
    (error) => {
      assert.equal(error.code, S_REG_23_FAILURE_TOKEN);
      assert.equal(error.reason, "s_reg_23_hold_reason_codes_invalid");
      return true;
    }
  );

  const requirementDrift = clone(sReg23LoadRegistryActivationHoldDecision());
  requirementDrift.required_before_activation = requirementDrift.required_before_activation.slice(0, -1);

  assert.throws(
    () => sReg23ValidateRegistryActivationHoldDecision({ decisionDocument: requirementDrift }),
    (error) => {
      assert.equal(error.code, S_REG_23_FAILURE_TOKEN);
      assert.equal(error.reason, "s_reg_23_required_before_activation_invalid");
      return true;
    }
  );
});

test("S-REG-23 fails closed on forbidden activation payload semantics", () => {
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
    "programme_assignment",
    "substitution_rule",
    "ui_route",
    "recommendation",
    "optimisation",
    "outcome"
  ]) {
    const decision = clone(sReg23LoadRegistryActivationHoldDecision());
    decision[forbiddenField] = "forbidden";

    assert.throws(
      () => sReg23ValidateRegistryActivationHoldDecision({ decisionDocument: decision }),
      (error) => {
        assert.equal(error.code, S_REG_23_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_23_forbidden_key_present");
        return true;
      }
    );
  }
});