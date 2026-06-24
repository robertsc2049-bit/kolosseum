import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_21_CANDIDATE_STATUS,
  S_REG_21_EXPECTED_THRESHOLD_MARKER_IDS,
  S_REG_21_FAILURE_TOKEN,
  S_REG_21_REGISTRY_ID,
  S_REG_21_REQUIRED_FALSE_FLAGS,
  S_REG_21_RUNTIME_STATUS,
  sReg21LoadThresholdMarkerCandidateRecords,
  sReg21ValidateThresholdMarkerCandidateRecords
} from "../ci/registry/s_reg_21_threshold_marker_candidate_records.mjs";

import {
  S_REG_13_ALLOWED_FIELDS,
  S_REG_13_ALLOWED_MARKER_STATUS_VALUES
} from "../ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const registryIndex = readJson("registries/registry_index.json");
const registryBundle = readJson("registries/registry_bundle.json");
const expectedCompactIds = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

test("S-REG-21 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order, expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries), expectedCompactIds);
  assert.equal(fs.existsSync("registries/threshold_marker_registry"), false);
  assert.equal(fs.existsSync("registries/threshold_marker_registry.json"), false);
  assert.equal(
    fs.existsSync("ci/registry/candidates/threshold_marker_registry/threshold_marker_registry.candidate.registry.json"),
    false
  );
});

test("S-REG-21 validates threshold marker candidate records", () => {
  const result = sReg21ValidateThresholdMarkerCandidateRecords();

  assert.equal(result.ok, true);
  assert.equal(result.registry_id, S_REG_21_REGISTRY_ID);
  assert.equal(result.record_count, 5);
  assert.deepEqual(result.threshold_marker_ids, S_REG_21_EXPECTED_THRESHOLD_MARKER_IDS);
  assert.deepEqual(result.dependency_inputs, ["S-REG-13", "S-REG-19", "S-REG-20"]);
  assert.deepEqual(result.foundation_inputs, ["S-REG-14"]);
  assert.deepEqual(result.marker_status_allowed_values, S_REG_13_ALLOWED_MARKER_STATUS_VALUES);
  assert.equal(result.runtime_status, S_REG_21_RUNTIME_STATUS);
  assert.equal(result.activation_ready, false);
});

test("S-REG-21 document remains inert and outside active registry law", () => {
  const document = sReg21LoadThresholdMarkerCandidateRecords();

  assert.equal(document.registry_id, "threshold_marker_registry");
  assert.equal(document.registry_target, "threshold_marker_registry");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.activation_ready, false);
  assert.equal(document.complete_registry_claim, false);

  for (const flag of S_REG_21_REQUIRED_FALSE_FLAGS) {
    assert.equal(document[flag], false, `${flag} must stay false`);
  }

  assert.equal(Object.hasOwn(document, "marker_evaluator"), false);
  assert.equal(Object.hasOwn(document, "comparison_result"), false);
  assert.equal(Object.hasOwn(document, "recorded_value"), false);
});

test("S-REG-21 candidate records expose only S-REG-13 threshold marker fields", () => {
  const document = sReg21LoadThresholdMarkerCandidateRecords();

  for (const record of document.records) {
    assert.deepEqual(Object.keys(record).sort(), [...S_REG_13_ALLOWED_FIELDS].sort());
    assert.equal(record.source_slice_id, "S-REG-21");
    assert.equal(record.candidate_status, S_REG_21_CANDIDATE_STATUS);
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
    assert.deepEqual(record.marker_status_allowed_values, S_REG_13_ALLOWED_MARKER_STATUS_VALUES);
  }
});

test("S-REG-21 links only metrics strengthened by S-REG-20 metric-exercise links", () => {
  const document = sReg21LoadThresholdMarkerCandidateRecords();
  const linkedMetricIds = new Set(
    readJson("ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json").records.map(
      (record) => record.sport_metric_id
    )
  );

  for (const record of document.records) {
    assert.equal(linkedMetricIds.has(record.sport_metric_id), true);
  }

  assert.equal(document.records.some((record) => record.sport_metric_id === "powerlifting__body_mass_kg"), false);
  assert.equal(document.records.some((record) => record.activity_id === "rugby_union"), false);
});

test("S-REG-21 marker order remains deterministic", () => {
  const document = sReg21LoadThresholdMarkerCandidateRecords();

  assert.deepEqual(
    document.records.map((record) => record.threshold_marker_id),
    S_REG_21_EXPECTED_THRESHOLD_MARKER_IDS
  );
});

test("S-REG-21 fails closed on activation, runtime, evaluator, comparison, recorded value, advice, outcome, UI, coach, programme, or substitution mutation", () => {
  for (const flag of S_REG_21_REQUIRED_FALSE_FLAGS) {
    const document = clone(sReg21LoadThresholdMarkerCandidateRecords());
    document[flag] = true;

    assert.throws(
      () => sReg21ValidateThresholdMarkerCandidateRecords({ thresholdMarkerDocument: document }),
      (error) => {
        assert.equal(error.code, S_REG_21_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-21 fails closed on forbidden semantic record fields", () => {
  for (const forbiddenField of [
    "recorded_value",
    "comparison_result",
    "marker_status",
    "marker_evaluator",
    "evaluator_result",
    "automatic_decision",
    "readiness_status",
    "safety_status",
    "suitability_status",
    "tactical_status",
    "recommendation",
    "optimisation",
    "outcome"
  ]) {
    const document = clone(sReg21LoadThresholdMarkerCandidateRecords());
    document.records[0][forbiddenField] = "forbidden";

    assert.throws(
      () => sReg21ValidateThresholdMarkerCandidateRecords({ thresholdMarkerDocument: document }),
      (error) => {
        assert.equal(error.code, S_REG_21_FAILURE_TOKEN);
        assert.match(error.reason, /field_set_invalid|forbidden_key/u);
        return true;
      }
    );
  }
});

test("S-REG-21 fails closed on invalid FK references or unlinked sport metrics", () => {
  const unknownMetric = clone(sReg21LoadThresholdMarkerCandidateRecords());
  unknownMetric.records[0].sport_metric_id = "unknown__metric";

  assert.throws(
    () => sReg21ValidateThresholdMarkerCandidateRecords({ thresholdMarkerDocument: unknownMetric }),
    (error) => {
      assert.equal(error.code, S_REG_21_FAILURE_TOKEN);
      return true;
    }
  );

  const unlinkedMetric = clone(sReg21LoadThresholdMarkerCandidateRecords());
  unlinkedMetric.records[0].sport_metric_id = "powerlifting__body_mass_kg";
  unlinkedMetric.records[0].threshold_unit = "kg";

  assert.throws(
    () => sReg21ValidateThresholdMarkerCandidateRecords({ thresholdMarkerDocument: unlinkedMetric }),
    (error) => {
      assert.equal(error.code, S_REG_21_FAILURE_TOKEN);
      assert.equal(error.reason, "threshold_marker_candidate_record_metric_exercise_link_missing");
      return true;
    }
  );

  const unitMismatch = clone(sReg21LoadThresholdMarkerCandidateRecords());
  unitMismatch.records[0].threshold_unit = "kg";

  assert.throws(
    () => sReg21ValidateThresholdMarkerCandidateRecords({ thresholdMarkerDocument: unitMismatch }),
    (error) => {
      assert.equal(error.code, S_REG_21_FAILURE_TOKEN);
      assert.equal(error.reason, "threshold_marker_candidate_record_unit_mismatch");
      return true;
    }
  );
});