import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_13_ALLOWED_FIELDS,
  S_REG_13_ALLOWED_MARKER_STATUS_VALUES,
  S_REG_13_ALLOWED_THRESHOLD_OPERATORS,
  S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES,
  S_REG_13_CANDIDATE_STATUS,
  S_REG_13_CONTRACT_STATUS,
  S_REG_13_FAILURE_TOKEN,
  S_REG_13_FORBIDDEN_FIELDS,
  S_REG_13_REGISTRY_ID,
  S_REG_13_RUNTIME_STATUS,
  sReg13BuildValidFutureThresholdMarkerCandidateRecord,
  sReg13ContractPaths,
  sReg13LoadThresholdMarkerCandidateBoundaryContractFile,
  sReg13ValidateFutureThresholdMarkerCandidateRecord,
  sReg13ValidateThresholdMarkerCandidateBoundaryContract
} from "../ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const registryIndex = readJson("registries/registry_index.json");
const registryBundle = readJson("registries/registry_bundle.json");

const expectedCompactIds = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

test("S-REG-13 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order, expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries), expectedCompactIds);
  assert.equal(fs.existsSync("registries/threshold_marker_registry"), false);
  assert.equal(fs.existsSync("registries/threshold_marker_registry.json"), false);
  assert.equal(
    fs.existsSync("ci/registry/candidates/threshold_marker_registry/threshold_marker_registry.candidate.registry.json"),
    false
  );
});

test("S-REG-13 contract path remains outside candidate seed content", () => {
  assert.deepEqual(sReg13ContractPaths(), {
    threshold_marker_registry:
      "ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract_manifest.json"
  });
});

test("S-REG-13 validates the inert threshold marker candidate boundary contract", () => {
  const result = sReg13ValidateThresholdMarkerCandidateBoundaryContract();

  assert.equal(result.ok, true);
  assert.equal(result.registry_id, S_REG_13_REGISTRY_ID);
  assert.equal(result.contract_status, S_REG_13_CONTRACT_STATUS);
  assert.equal(result.candidate_status, S_REG_13_CANDIDATE_STATUS);
  assert.equal(result.runtime_status, S_REG_13_RUNTIME_STATUS);
  assert.equal(result.activation_ready, false);
  assert.equal(result.allowed_field_count, S_REG_13_ALLOWED_FIELDS.length);
  assert.equal(result.forbidden_field_count, S_REG_13_FORBIDDEN_FIELDS.length);
  assert.equal(result.seed_content_status, "not_created");
  assert.deepEqual(result.allowed_marker_status_values, S_REG_13_ALLOWED_MARKER_STATUS_VALUES);
  assert.deepEqual(result.threshold_operator_values, S_REG_13_ALLOWED_THRESHOLD_OPERATORS);
  assert.deepEqual(result.threshold_source_values, S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES);
  assert.ok(result.sport_metric_count > 0);
  assert.ok(result.metric_exercise_link_count > 0);
});

test("S-REG-13 contract contains no threshold marker seed records", () => {
  const document = sReg13LoadThresholdMarkerCandidateBoundaryContractFile();

  assert.equal(Object.hasOwn(document, "records"), false);
  assert.equal(document.seed_content_status, "not_created");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.activation_ready, false);
});

test("S-REG-13 validates the exact future factual status vocabulary", () => {
  const document = sReg13LoadThresholdMarkerCandidateBoundaryContractFile();

  assert.deepEqual(document.allowed_marker_status_values, [
    "recorded_met",
    "recorded_not_met",
    "not_recorded",
    "invalid_source",
    "insufficient_recorded_data"
  ]);

  for (const forbiddenStatus of [
    "ready",
    "safe",
    "suitable",
    "capable",
    "recommended",
    "ranked",
    "optimised",
    "intervention_required",
    "return_to_play"
  ]) {
    assert.equal(document.allowed_marker_status_values.includes(forbiddenStatus), false);
  }
});

test("S-REG-13 accepts a future record shape only when it is explicit and inert", () => {
  const record = sReg13BuildValidFutureThresholdMarkerCandidateRecord();
  const result = sReg13ValidateFutureThresholdMarkerCandidateRecord(record);

  assert.equal(result.ok, true);
  assert.equal(result.registry_id, "threshold_marker_registry");
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.activation_ready, false);
});

test("S-REG-13 refuses readiness, safety, suitability, tactical, recommendation, and evaluator semantics", () => {
  for (const forbiddenField of S_REG_13_FORBIDDEN_FIELDS) {
    const record = sReg13BuildValidFutureThresholdMarkerCandidateRecord();
    record[forbiddenField] = "forbidden";

    assert.throws(
      () => sReg13ValidateFutureThresholdMarkerCandidateRecord(record),
      (error) => {
        assert.equal(error.code, S_REG_13_FAILURE_TOKEN);
        assert.equal(error.reason, "future_threshold_marker_record_field_set_invalid");
        return true;
      }
    );
  }
});

test("S-REG-13 refuses real comparison or marker evaluator expansion", () => {
  for (const forbiddenField of [
    "recorded_value",
    "comparison_result",
    "marker_evaluator",
    "evaluator_id",
    "automatic_decision",
    "programme_change",
    "substitution_change"
  ]) {
    const record = sReg13BuildValidFutureThresholdMarkerCandidateRecord();
    record[forbiddenField] = "forbidden";

    assert.throws(
      () => sReg13ValidateFutureThresholdMarkerCandidateRecord(record),
      (error) => {
        assert.equal(error.code, S_REG_13_FAILURE_TOKEN);
        assert.equal(error.reason, "future_threshold_marker_record_field_set_invalid");
        return true;
      }
    );
  }
});

test("S-REG-13 fails closed if the contract is activated", () => {
  const document = JSON.parse(JSON.stringify(sReg13LoadThresholdMarkerCandidateBoundaryContractFile()));
  document.activation_ready = true;

  assert.throws(
    () => sReg13ValidateThresholdMarkerCandidateBoundaryContract({ contractDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_13_FAILURE_TOKEN);
      assert.equal(error.reason, "threshold_marker_contract_field_invalid");
      return true;
    }
  );
});

test("S-REG-13 fails closed if threshold operators or sources drift", () => {
  const operatorRecord = sReg13BuildValidFutureThresholdMarkerCandidateRecord();
  operatorRecord.threshold_operator = "approximately_equal";

  assert.throws(
    () => sReg13ValidateFutureThresholdMarkerCandidateRecord(operatorRecord),
    (error) => {
      assert.equal(error.code, S_REG_13_FAILURE_TOKEN);
      assert.equal(error.reason, "future_threshold_marker_record_field_invalid");
      return true;
    }
  );

  const sourceRecord = sReg13BuildValidFutureThresholdMarkerCandidateRecord();
  sourceRecord.threshold_source = "system_inferred";

  assert.throws(
    () => sReg13ValidateFutureThresholdMarkerCandidateRecord(sourceRecord),
    (error) => {
      assert.equal(error.code, S_REG_13_FAILURE_TOKEN);
      assert.equal(error.reason, "future_threshold_marker_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-13 fails closed if factual status vocabulary drifts", () => {
  const record = sReg13BuildValidFutureThresholdMarkerCandidateRecord();
  record.marker_status_allowed_values = ["recorded_met", "ready"];

  assert.throws(
    () => sReg13ValidateFutureThresholdMarkerCandidateRecord(record),
    (error) => {
      assert.equal(error.code, S_REG_13_FAILURE_TOKEN);
      assert.equal(error.reason, "future_threshold_marker_status_values_invalid");
      return true;
    }
  );
});