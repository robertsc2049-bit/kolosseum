import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_09_ACTIVITY_CONTEXT,
  S_REG_09_APPLICABILITY_STATE,
  S_REG_09_FAILURE_TOKEN,
  S_REG_09_REGISTRY_ID,
  S_REG_09_RUNTIME_STATUS,
  S_REG_09_TIER_CAP,
  sReg09CandidatePaths,
  sReg09LoadApplicabilityCandidateSeedFile,
  sReg09ValidateExerciseActivityApplicabilityCandidateSeeds
} from "../ci/registry/s_reg_09_exercise_activity_applicability_candidate_seeds.mjs";

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

test("S-REG-09 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order.slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.equal(fs.existsSync("registries/exercise_activity_applicability_registry"), false);
});

test("S-REG-09 candidate path remains under the S-REG-05 candidate surface", () => {
  assert.deepEqual(sReg09CandidatePaths(), {
    exercise_activity_applicability_registry:
      "ci/registry/candidates/exercise_activity_applicability_registry/exercise_activity_applicability_registry.candidate.registry.json"
  });
});

test("S-REG-09 validates exercise-activity applicability candidate FK closure", () => {
  const result = sReg09ValidateExerciseActivityApplicabilityCandidateSeeds();

  assert.equal(result.ok, true);
  assert.equal(result.registry_id, S_REG_09_REGISTRY_ID);
  assert.equal(result.applicability_count, 12);
  assert.equal(result.exercise_count, 4);
  assert.equal(result.activity_count, 3);
  assert.equal(result.activity_context, S_REG_09_ACTIVITY_CONTEXT);
  assert.equal(result.applicability_state, S_REG_09_APPLICABILITY_STATE);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_09_RUNTIME_STATUS);
});

test("S-REG-09 candidate records are factual training-context links only", () => {
  const document = sReg09LoadApplicabilityCandidateSeedFile();

  assert.equal(document.registry_id, "exercise_activity_applicability_registry");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.activation_ready, false);
  assert.equal(document.records.length, 12);

  for (const record of document.records) {
    assert.equal(record.activity_context, "training");
    assert.equal(record.applicability_state, "allowed");
    assert.deepEqual(record.conditions, []);
    assert.equal(record.tier_cap, S_REG_09_TIER_CAP);
    assert.equal(record.template_applicability, "eligible");
    assert.equal(record.substitution_applicability, "eligible");
    assert.equal(record.source_slice_id, "S-REG-09");
    assert.equal(record.candidate_status, "candidate_content_draft");
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
  }
});

test("S-REG-09 fails closed when an applicability record references an unknown exercise", () => {
  const document = JSON.parse(JSON.stringify(sReg09LoadApplicabilityCandidateSeedFile()));
  document.records[0].exercise_id = "missing_exercise";

  assert.throws(
    () => sReg09ValidateExerciseActivityApplicabilityCandidateSeeds({ applicabilityDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_09_FAILURE_TOKEN);
      assert.equal(error.reason, "applicability_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-09 fails closed when an applicability record references an undeclared activity for the exercise", () => {
  const document = JSON.parse(JSON.stringify(sReg09LoadApplicabilityCandidateSeedFile()));
  document.records[0].activity_id = "missing_activity";

  assert.throws(
    () => sReg09ValidateExerciseActivityApplicabilityCandidateSeeds({ applicabilityDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_09_FAILURE_TOKEN);
      assert.equal(error.reason, "applicability_record_field_invalid");
      return true;
    }
  );
});

test("S-REG-09 refuses recommendation, ranking, optimisation, capability, readiness, safety, or effectiveness fields", () => {
  const document = JSON.parse(JSON.stringify(sReg09LoadApplicabilityCandidateSeedFile()));
  document.records[0].recommendation_score = 1;

  assert.throws(
    () => sReg09ValidateExerciseActivityApplicabilityCandidateSeeds({ applicabilityDocument: document }),
    (error) => {
      assert.equal(error.code, S_REG_09_FAILURE_TOKEN);
      assert.equal(error.reason, "forbidden_applicability_semantic_key");
      return true;
    }
  );
});