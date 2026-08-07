import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_12_CONTEXT_SCOPE,
  S_REG_12_FAILURE_TOKEN,
  S_REG_12_LINK_KIND,
  S_REG_12_RUNTIME_STATUS,
  S_REG_12_SEED_STATUS,
  S_REG_12_VALUE_CONTEXT,
  sReg12CandidatePaths,
  sReg12LoadMetricExerciseLinkCandidateSeedFile,
  sReg12ValidateMetricExerciseLinkCandidateSeeds
} from "../ci/registry/s_reg_12_metric_exercise_link_candidate_seeds.mjs";

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

test("S-REG-12 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order.slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.equal(fs.existsSync("registries/metric_exercise_link_registry_1c_a"), false);
  assert.equal(fs.existsSync("registries/threshold_marker_registry"), false);
  assert.equal(fs.existsSync("registries/sport_metric_registry_1c"), false);
});

test("S-REG-12 candidate path remains under the S-REG-05 candidate surface", () => {
  assert.deepEqual(sReg12CandidatePaths(), {
    metric_exercise_link_registry_1c_a:
      "ci/registry/candidates/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.candidate.registry.json"
  });
});

test("S-REG-12 validates metric-exercise link candidate FK closure", () => {
  const result = sReg12ValidateMetricExerciseLinkCandidateSeeds();

  assert.equal(result.ok, true);
  assert.equal(result.registry_id, "metric_exercise_link_registry_1c_a");
  assert.equal(result.metric_exercise_link_count, 13);
  assert.equal(result.sport_metric_count, 6);
  assert.equal(result.exercise_count, 4);
  assert.equal(result.activity_count, 3);
  assert.equal(result.metric_exercise_link_seed_status, S_REG_12_SEED_STATUS);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_12_RUNTIME_STATUS);
});

test("S-REG-12 candidate records are factual relationship records only", () => {
  const document = sReg12LoadMetricExerciseLinkCandidateSeedFile();

  assert.equal(document.candidate_status, "candidate_content_draft");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.activation_ready, false);
  assert.equal(document.metric_exercise_link_seed_status, "candidate_fk_ready");

  for (const record of document.records) {
    assert.equal(record.link_kind, S_REG_12_LINK_KIND);
    assert.equal(record.context_scope, S_REG_12_CONTEXT_SCOPE);
    assert.equal(record.value_context, S_REG_12_VALUE_CONTEXT);
    assert.equal(record.source_slice_id, "S-REG-12");
    assert.equal(record.candidate_status, "candidate_content_draft");
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
    assert.equal(Object.hasOwn(record, "threshold_id"), false);
    assert.equal(Object.hasOwn(record, "threshold_marker_id"), false);
    assert.equal(Object.hasOwn(record, "marker_status"), false);
    assert.equal(Object.hasOwn(record, "marker_evaluator"), false);
  }
});

test("S-REG-12 does not link rugby sprint time before a sprint exercise candidate exists", () => {
  const document = sReg12LoadMetricExerciseLinkCandidateSeedFile();

  assert.equal(
    document.records.some((record) => record.sport_metric_id === "rugby_union__sprint_time_seconds"),
    false
  );
});

test("S-REG-12 fails closed when a link references an unknown sport metric", () => {
  const document = JSON.parse(JSON.stringify(sReg12LoadMetricExerciseLinkCandidateSeedFile()));
  document.records[0].sport_metric_id = "missing_metric";

  assert.throws(
    () => sReg12ValidateMetricExerciseLinkCandidateSeeds({ metricExerciseLinkDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_12_FAILURE_TOKEN);
      assert.equal(error.reason, "metric_exercise_link_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-12 fails closed when a link references an unknown exercise", () => {
  const document = JSON.parse(JSON.stringify(sReg12LoadMetricExerciseLinkCandidateSeedFile()));
  document.records[0].exercise_id = "missing_exercise";

  assert.throws(
    () => sReg12ValidateMetricExerciseLinkCandidateSeeds({ metricExerciseLinkDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_12_FAILURE_TOKEN);
      assert.equal(error.reason, "metric_exercise_link_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-12 refuses threshold marker and evaluator fields", () => {
  const document = JSON.parse(JSON.stringify(sReg12LoadMetricExerciseLinkCandidateSeedFile()));
  document.records[0].threshold_marker_id = "forbidden_marker";

  assert.throws(
    () => sReg12ValidateMetricExerciseLinkCandidateSeeds({ metricExerciseLinkDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_12_FAILURE_TOKEN);
      assert.equal(error.reason, "forbidden_metric_exercise_link_semantic_key");
      return true;
    }
  );

  const evaluatorDocument = JSON.parse(JSON.stringify(sReg12LoadMetricExerciseLinkCandidateSeedFile()));
  evaluatorDocument.records[0].marker_evaluator = "forbidden_evaluator";

  assert.throws(
    () => sReg12ValidateMetricExerciseLinkCandidateSeeds({ metricExerciseLinkDocument: evaluatorDocument }),
    (error) => {
      assert.equal(error.code, S_REG_12_FAILURE_TOKEN);
      assert.equal(error.reason, "forbidden_metric_exercise_link_semantic_key");
      return true;
    }
  );
});