import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_22_DEPENDENCY_INPUTS,
  S_REG_22_EXPECTED_CANDIDATE_BATCHES,
  S_REG_22_FAILURE_TOKEN,
  S_REG_22_REQUIRED_FALSE_FLAGS,
  sReg22LoadCandidateRegistryBuildReview,
  sReg22ValidateCandidateRegistryBuildReview
} from "../ci/registry/s_reg_22_candidate_registry_build_review.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-22 keeps the active registry surface compact and inactive", () => {
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");

  assert.deepEqual(registryIndex.order.slice(0, 4), ["activity", "movement", "exercise", "program"]);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, 4), ["activity", "movement", "exercise", "program"]);
  assert.equal(fs.existsSync("registries/threshold_marker_registry.json"), false);
  assert.equal(fs.existsSync("registries/sport_metric_registry_1c.json"), false);
  assert.equal(fs.existsSync("registries/metric_exercise_link_registry_1c_a.json"), false);
});

test("S-REG-22 validates the candidate registry build review", () => {
  const result = sReg22ValidateCandidateRegistryBuildReview();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-22");
  assert.equal(result.batch_id, "candidate_registry_review_and_activation_gate");
  assert.equal(result.registry_target, "candidate_registry_review_gate");
  assert.deepEqual(result.dependency_inputs, S_REG_22_DEPENDENCY_INPUTS);
  assert.equal(result.reviewed_candidate_batch_count, 7);
  assert.equal(result.reviewed_candidate_record_count, 69);
  assert.equal(result.candidate_review_status, "candidate_reviewed_fk_closed_pending_activation_decision");
  assert.equal(result.activation_ready, false);
  assert.equal(result.active_registry_activation, false);
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.activation_decision, "not_authorised_pending_later_explicit_activation_slice");
});

test("S-REG-22 review batch order mirrors the S-REG-14 queue dependency order", () => {
  const review = sReg22LoadCandidateRegistryBuildReview();
  const sReg14Manifest = readJson("ci/registry/s_reg_14_registry_build_readiness_start_gate_manifest.json");
  const sReg22QueueEntry = sReg14Manifest.candidate_build_queue.find((entry) => entry.slice_id === "S-REG-22");

  assert.deepEqual(review.dependency_inputs, sReg22QueueEntry.dependency_inputs);
  assert.deepEqual(
    review.reviewed_candidate_batches.map((batch) => batch.slice_id),
    sReg22QueueEntry.dependency_inputs
  );
  assert.equal(sReg22QueueEntry.order, 8);
  assert.equal(sReg22QueueEntry.proof_command, "npm.cmd run proof:s-reg-22");
});

test("S-REG-22 confirms every reviewed candidate batch exists and remains inert", () => {
  const review = sReg22LoadCandidateRegistryBuildReview();

  for (const expected of S_REG_22_EXPECTED_CANDIDATE_BATCHES) {
    const candidate = readJson(expected.path);
    const reviewBatch = review.reviewed_candidate_batches.find((batch) => batch.slice_id === expected.slice_id);

    assert.ok(reviewBatch);
    assert.equal(candidate.slice_id, expected.slice_id);
    assert.equal(candidate.registry_id, expected.registry_id);
    assert.equal(candidate.batch_id, expected.batch_id);
    assert.equal(candidate.record_count, expected.record_count);
    assert.equal(candidate.records.length, expected.record_count);
    assert.equal(candidate.runtime_status, "non_runtime");
    assert.equal(candidate.activation_ready, false);
    assert.equal(candidate.active_registry_mutation, false);
    assert.equal(candidate.active_bundle_mutation, false);
    assert.equal(candidate.registry_law_mutation, false);

    assert.equal(reviewBatch.record_count, candidate.record_count);
    assert.equal(reviewBatch.review_status, "reviewed_inert_fk_closed");
    assert.equal(reviewBatch.activation_ready, false);
    assert.equal(reviewBatch.runtime_status, "non_runtime");
  }
});

test("S-REG-22 keeps activation unauthorised pending a later explicit activation slice", () => {
  const review = sReg22LoadCandidateRegistryBuildReview();

  for (const flag of S_REG_22_REQUIRED_FALSE_FLAGS) {
    assert.equal(review[flag], false, `${flag} must stay false`);
  }

  assert.equal(review.activation_decision, "not_authorised_pending_later_explicit_activation_slice");
  assert.equal(review.later_activation_requirement, "separate_explicit_activation_slice_required");
  assert.equal(review.review_findings.active_registry_activation_authorised, false);
  assert.equal(review.review_findings.activation_gate_remains_blocked_pending_later_slice, true);
});

test("S-REG-22 fails closed on activation or runtime mutation", () => {
  for (const flag of S_REG_22_REQUIRED_FALSE_FLAGS) {
    const review = clone(sReg22LoadCandidateRegistryBuildReview());
    review[flag] = true;

    assert.throws(
      () => sReg22ValidateCandidateRegistryBuildReview({ reviewDocument: review }),
      (error) => {
        assert.equal(error.code, S_REG_22_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-22 fails closed on forbidden review semantics", () => {
  for (const forbiddenField of [
    "records",
    "active_registry_records",
    "registry_bundle",
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
    "readiness",
    "safety",
    "suitability",
    "capability",
    "tactical",
    "recommendation",
    "optimisation",
    "outcome"
  ]) {
    const review = clone(sReg22LoadCandidateRegistryBuildReview());
    review[forbiddenField] = "forbidden";

    assert.throws(
      () => sReg22ValidateCandidateRegistryBuildReview({ reviewDocument: review }),
      (error) => {
        assert.equal(error.code, S_REG_22_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_22_forbidden_review_key_present");
        return true;
      }
    );
  }
});

test("S-REG-22 fails closed if review dependency order or record counts drift", () => {
  const orderDrift = clone(sReg22LoadCandidateRegistryBuildReview());
  orderDrift.dependency_inputs = [...orderDrift.dependency_inputs].reverse();

  assert.throws(
    () => sReg22ValidateCandidateRegistryBuildReview({ reviewDocument: orderDrift }),
    (error) => {
      assert.equal(error.code, S_REG_22_FAILURE_TOKEN);
      assert.equal(error.reason, "s_reg_22_dependency_inputs_invalid");
      return true;
    }
  );

  const countDrift = clone(sReg22LoadCandidateRegistryBuildReview());
  countDrift.reviewed_candidate_batches[0].record_count = 999;

  assert.throws(
    () => sReg22ValidateCandidateRegistryBuildReview({ reviewDocument: countDrift }),
    (error) => {
      assert.equal(error.code, S_REG_22_FAILURE_TOKEN);
      assert.equal(error.reason, "s_reg_22_review_batch_record_count_invalid");
      return true;
    }
  );
});