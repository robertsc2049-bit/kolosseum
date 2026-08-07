import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_11_CONTEXT_SCOPE,
  S_REG_11_FAILURE_TOKEN,
  S_REG_11_METRIC_KIND,
  S_REG_11_RUNTIME_STATUS,
  S_REG_11_SEED_STATUS,
  sReg11CandidatePaths,
  sReg11LoadSportMetricCandidateSeedFile,
  sReg11ValidateSportMetricCandidateSeeds
} from "../ci/registry/s_reg_11_sport_metric_candidate_seeds.mjs";

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

test("S-REG-11 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order.slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.equal(fs.existsSync("registries/sport_metric_registry_1c"), false);
  assert.equal(fs.existsSync("registries/metric_exercise_link_registry_1c_a"), false);
  assert.equal(fs.existsSync("registries/threshold_marker_registry"), false);
});

test("S-REG-11 candidate path remains under the S-REG-05 candidate surface", () => {
  assert.deepEqual(sReg11CandidatePaths(), {
    sport_metric_registry_1c:
      "ci/registry/candidates/sport_metric_registry_1c/sport_metric_registry_1c.candidate.registry.json"
  });
});

test("S-REG-11 validates sport metric candidate FK closure", () => {
  const result = sReg11ValidateSportMetricCandidateSeeds();

  assert.equal(result.ok, true);
  assert.equal(result.registry_id, "sport_metric_registry_1c");
  assert.equal(result.sport_metric_count, 6);
  assert.equal(result.activity_count, 3);
  assert.equal(result.subdivision_count, 4);
  assert.equal(result.sport_metric_seed_status, S_REG_11_SEED_STATUS);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_11_RUNTIME_STATUS);
});

test("S-REG-11 candidate records are factual metric definitions only", () => {
  const document = sReg11LoadSportMetricCandidateSeedFile();

  assert.equal(document.candidate_status, "candidate_content_draft");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.activation_ready, false);
  assert.equal(document.sport_metric_seed_status, "candidate_fk_ready");

  for (const record of document.records) {
    assert.equal(record.metric_kind, S_REG_11_METRIC_KIND);
    assert.equal(record.context_scope, S_REG_11_CONTEXT_SCOPE);
    assert.equal(record.source_slice_id, "S-REG-11");
    assert.equal(record.candidate_status, "candidate_content_draft");
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
    assert.equal(Object.hasOwn(record, "exercise_id"), false);
    assert.equal(Object.hasOwn(record, "threshold_id"), false);
    assert.equal(Object.hasOwn(record, "threshold_marker_id"), false);
    assert.equal(Object.hasOwn(record, "marker_status"), false);
  }
});

test("S-REG-11 fails closed when a metric references an unknown activity", () => {
  const document = JSON.parse(JSON.stringify(sReg11LoadSportMetricCandidateSeedFile()));
  document.records[0].activity_id = "missing_activity";

  assert.throws(
    () => sReg11ValidateSportMetricCandidateSeeds({ sportMetricDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_11_FAILURE_TOKEN);
      assert.equal(error.reason, "sport_metric_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-11 fails closed when a metric references an unknown subdivision", () => {
  const document = JSON.parse(JSON.stringify(sReg11LoadSportMetricCandidateSeedFile()));
  document.records[0].sport_subdivision_id = "missing_subdivision";

  assert.throws(
    () => sReg11ValidateSportMetricCandidateSeeds({ sportMetricDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_11_FAILURE_TOKEN);
      assert.equal(error.reason, "sport_metric_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-11 refuses metric-exercise-link and threshold-marker fields", () => {
  const document = JSON.parse(JSON.stringify(sReg11LoadSportMetricCandidateSeedFile()));
  document.records[0].exercise_id = "back_squat";

  assert.throws(
    () => sReg11ValidateSportMetricCandidateSeeds({ sportMetricDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_11_FAILURE_TOKEN);
      assert.equal(error.reason, "forbidden_sport_metric_semantic_key");
      return true;
    }
  );

  const thresholdDocument = JSON.parse(JSON.stringify(sReg11LoadSportMetricCandidateSeedFile()));
  thresholdDocument.records[0].threshold_marker_id = "forbidden_marker";

  assert.throws(
    () => sReg11ValidateSportMetricCandidateSeeds({ sportMetricDocument: thresholdDocument }),
    (error) => {
      assert.equal(error.code, S_REG_11_FAILURE_TOKEN);
      assert.equal(error.reason, "forbidden_sport_metric_semantic_key");
      return true;
    }
  );
});