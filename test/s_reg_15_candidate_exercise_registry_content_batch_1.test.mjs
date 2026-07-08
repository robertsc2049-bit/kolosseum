import assert from "node:assert/strict";
import test from "node:test";

import {
  S_REG_15_BATCH_ID,
  S_REG_15_CANDIDATE_STATUS,
  S_REG_15_CONTENT_BATCH_STATUS,
  S_REG_15_EXPECTED_RECORD_IDS,
  S_REG_15_FAILURE_TOKEN,
  S_REG_15_REGISTRY_ID,
  S_REG_15_RUNTIME_STATUS,
  S_REG_15_SLICE_ID,
  sReg15LoadCandidateExerciseContentBatch1,
  sReg15ValidateCandidateExerciseRegistryContentBatch1
} from "../ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.mjs";

test("S-REG-15 validates candidate exercise registry content batch 1", () => {
  const result = sReg15ValidateCandidateExerciseRegistryContentBatch1();

  assert.equal(result.ok, true);
  assert.equal(result.token, S_REG_15_FAILURE_TOKEN);
  assert.equal(result.slice_id, S_REG_15_SLICE_ID);
  assert.equal(result.batch_id, S_REG_15_BATCH_ID);
  assert.equal(result.registry_id, S_REG_15_REGISTRY_ID);
  assert.equal(result.record_count, S_REG_15_EXPECTED_RECORD_IDS.length);
  assert.deepEqual(result.exercise_ids, S_REG_15_EXPECTED_RECORD_IDS);
  assert.deepEqual(result.dependency_inputs, ["S-REG-06", "S-REG-08", "S-REG-09"]);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_15_RUNTIME_STATUS);
  assert.equal(result.candidate_status, S_REG_15_CANDIDATE_STATUS);
  assert.equal(result.content_batch_status, S_REG_15_CONTENT_BATCH_STATUS);
});

test("S-REG-15 document remains inert and outside active registry law", () => {
  const document = sReg15LoadCandidateExerciseContentBatch1();

  assert.equal(document.slice_id, "S-REG-15");
  assert.equal(document.registry_id, "exercise_registry_3a");
  assert.equal(document.batch_id, "candidate_exercise_registry_content_expansion_batch_1");
  assert.equal(document.source_queue_slice_id, "S-REG-14");
  assert.equal(document.source_queue_order, 1);
  assert.equal(document.candidate_status, "candidate_content_draft");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.content_batch_status, "candidate_content_expanded_inert");
  assert.equal(document.active_registry_mutation, false);
  assert.equal(document.active_bundle_mutation, false);
  assert.equal(document.registry_law_mutation, false);
  assert.equal(document.engine_runtime_mutation, false);
  assert.equal(document.high_volume_content_added, false);
  assert.equal(document.activation_ready, false);
  assert.equal(document.complete_registry_claim, false);
  assert.equal(document.record_count, 6);
});

test("S-REG-15 candidate records expose required factual exercise identity fields", () => {
  const document = sReg15LoadCandidateExerciseContentBatch1();

  for (const record of document.records) {
    assert.equal(record.registry_id, "exercise_registry_3a");
    assert.equal(record.batch_id, "candidate_exercise_registry_content_expansion_batch_1");
    assert.equal(record.source_slice_id, "S-REG-15");
    assert.equal(record.candidate_status, "candidate_content_draft");
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
    assert.equal(record.active_registry_mutation, false);
    assert.equal(record.active_bundle_mutation, false);
    assert.equal(record.registry_law_mutation, false);
    assert.equal(record.engine_runtime_mutation, false);
    assert.equal(record.complete_registry_claim, false);
    assert.equal(record.equipment_dependency_status, "candidate_equipment_fk_closed");
    assert.equal(record.equipment_fk_closed_by_slice_id, "S-REG-08");
    assert.equal(record.activity_applicability_dependency_status, "candidate_activity_fk_ready");
    assert.equal(record.activity_applicability_dependency_slice_id, "S-REG-09");
    assert.equal(record.content_scope, "candidate_exercise_identity");
    assert.ok(record.copy_legal_boundary_notes.includes("Factual exercise identity only"));
    assert.ok(Array.isArray(record.activity_ids));
    assert.ok(Array.isArray(record.equipment_ids));
    assert.ok(record.activity_ids.length > 0);
    assert.ok(record.equipment_ids.length > 0);
  }
});

test("S-REG-15 candidate records expand beyond the S-REG-06 seed ids", () => {
  const document = sReg15LoadCandidateExerciseContentBatch1();

  const seedIds = new Set([
    "back_squat",
    "deadlift",
    "bench_press",
    "front_plank"
  ]);

  for (const record of document.records) {
    assert.equal(seedIds.has(record.exercise_id), false);
    assert.equal(seedIds.has(record.parent_seed_exercise_id), true);
  }
});

test("S-REG-15 fails closed on activation or runtime mutation", () => {
  const document = sReg15LoadCandidateExerciseContentBatch1();

  for (const mutation of [
    { activation_ready: true },
    { active_registry_mutation: true },
    { active_bundle_mutation: true },
    { registry_law_mutation: true },
    { engine_runtime_mutation: true },
    { runtime_status: "runtime" },
    { complete_registry_claim: true }
  ]) {
    assert.throws(
      () => sReg15ValidateCandidateExerciseRegistryContentBatch1({
        document: {
          ...document,
          ...mutation
        }
      }),
      (error) => {
        assert.equal(error.code, S_REG_15_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-15 fails closed on forbidden semantic fields", () => {
  const document = sReg15LoadCandidateExerciseContentBatch1();
  const mutated = structuredClone(document);

  for (const field of [
    "recommendation_score",
    "ranking_score",
    "optimisation_score",
    "capability_score",
    "readiness_score",
    "safety_rating",
    "suitability_status",
    "tactical_status",
    "return_to_play_status",
    "effectiveness_score",
    "outcome_inference",
    "marker_evaluator"
  ]) {
    const local = structuredClone(mutated);
    local.records[0][field] = true;

    assert.throws(
      () => sReg15ValidateCandidateExerciseRegistryContentBatch1({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_15_FAILURE_TOKEN);
        assert.equal(error.reason, "forbidden_candidate_exercise_semantic_key");
        return true;
      }
    );
  }
});

test("S-REG-15 fails closed on FK drift", () => {
  const document = sReg15LoadCandidateExerciseContentBatch1();

  for (const mutation of [
    { activity_ids: ["unknown_activity"] },
    { movement_id: "unknown_movement" },
    { exercise_token_id: "unknown_token" },
    { equipment_ids: ["unknown_equipment"] },
    { parent_seed_exercise_id: "unknown_seed" }
  ]) {
    const local = structuredClone(document);
    local.records[0] = {
      ...local.records[0],
      ...mutation
    };

    assert.throws(
      () => sReg15ValidateCandidateExerciseRegistryContentBatch1({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_15_FAILURE_TOKEN);
        return true;
      }
    );
  }
});