import assert from "node:assert/strict";
import test from "node:test";

import {
  S_REG_16_BATCH_ID,
  S_REG_16_CANDIDATE_STATUS,
  S_REG_16_CONTENT_BATCH_STATUS,
  S_REG_16_EXPECTED_RECORD_IDS,
  S_REG_16_FAILURE_TOKEN,
  S_REG_16_REGISTRY_ID,
  S_REG_16_RUNTIME_STATUS,
  S_REG_16_SLICE_ID,
  sReg16LoadCandidateEquipmentContentBatch1,
  sReg16ValidateCandidateEquipmentRegistryContentBatch1
} from "../ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.mjs";

test("S-REG-16 validates candidate equipment registry content batch 1", () => {
  const result = sReg16ValidateCandidateEquipmentRegistryContentBatch1();

  assert.equal(result.ok, true);
  assert.equal(result.token, S_REG_16_FAILURE_TOKEN);
  assert.equal(result.slice_id, S_REG_16_SLICE_ID);
  assert.equal(result.batch_id, S_REG_16_BATCH_ID);
  assert.equal(result.registry_id, S_REG_16_REGISTRY_ID);
  assert.equal(result.record_count, S_REG_16_EXPECTED_RECORD_IDS.length);
  assert.deepEqual(result.equipment_ids, S_REG_16_EXPECTED_RECORD_IDS);
  assert.deepEqual(result.dependency_inputs, ["S-REG-07", "S-REG-15"]);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_16_RUNTIME_STATUS);
  assert.equal(result.candidate_status, S_REG_16_CANDIDATE_STATUS);
  assert.equal(result.content_batch_status, S_REG_16_CONTENT_BATCH_STATUS);
  assert.equal(result.exercise_equipment_fk_closure_mutation, false);
});

test("S-REG-16 document remains inert and outside active registry law", () => {
  const document = sReg16LoadCandidateEquipmentContentBatch1();

  assert.equal(document.slice_id, "S-REG-16");
  assert.equal(document.registry_id, "equipment_registry");
  assert.equal(document.batch_id, "candidate_equipment_registry_content_expansion_batch_1");
  assert.equal(document.source_queue_slice_id, "S-REG-14");
  assert.equal(document.source_queue_order, 2);
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
  assert.equal(document.exercise_equipment_fk_closure_mutation, false);
  assert.equal(document.record_count, 6);
});

test("S-REG-16 candidate records expose required factual equipment identity fields", () => {
  const document = sReg16LoadCandidateEquipmentContentBatch1();

  for (const record of document.records) {
    assert.equal(record.registry_id, "equipment_registry");
    assert.equal(record.batch_id, "candidate_equipment_registry_content_expansion_batch_1");
    assert.equal(record.source_slice_id, "S-REG-16");
    assert.equal(record.candidate_status, "candidate_content_draft");
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
    assert.equal(record.active_registry_mutation, false);
    assert.equal(record.active_bundle_mutation, false);
    assert.equal(record.registry_law_mutation, false);
    assert.equal(record.engine_runtime_mutation, false);
    assert.equal(record.complete_registry_claim, false);
    assert.equal(record.exercise_equipment_fk_closure_mutation, false);
    assert.equal(record.equipment_scope, "candidate_equipment_identity");
    assert.equal(record.copy_legal_boundary_notes, "factual equipment label only");
    assert.equal(record.substitution_relevance, "candidate_equipment_class_only");
    assert.equal(record.template_relevance, "candidate_equipment_class_only");
    assert.equal(record.low_equipment_alternative_relevance, "candidate_low_equipment_relation_only");
    assert.ok(Array.isArray(record.activity_applicability));
    assert.ok(Array.isArray(record.movement_pattern_applicability));
    assert.ok(record.activity_applicability.length > 0);
    assert.ok(record.movement_pattern_applicability.length > 0);
  }
});

test("S-REG-16 candidate records expand beyond the S-REG-07 seed ids", () => {
  const document = sReg16LoadCandidateEquipmentContentBatch1();

  const seedIds = new Set([
    "barbell",
    "rack",
    "bench",
    "plate",
    "bodyweight",
    "open_floor_space"
  ]);

  for (const record of document.records) {
    assert.equal(seedIds.has(record.equipment_id), false);
  }
});

test("S-REG-16 fails closed on activation or runtime mutation", () => {
  const document = sReg16LoadCandidateEquipmentContentBatch1();

  for (const mutation of [
    { activation_ready: true },
    { active_registry_mutation: true },
    { active_bundle_mutation: true },
    { registry_law_mutation: true },
    { engine_runtime_mutation: true },
    { runtime_status: "runtime" },
    { complete_registry_claim: true },
    { exercise_equipment_fk_closure_mutation: true }
  ]) {
    assert.throws(
      () => sReg16ValidateCandidateEquipmentRegistryContentBatch1({
        document: {
          ...document,
          ...mutation
        }
      }),
      (error) => {
        assert.equal(error.code, S_REG_16_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-16 fails closed on forbidden semantic or closure fields", () => {
  const document = sReg16LoadCandidateEquipmentContentBatch1();

  for (const field of [
    "exercise_ids",
    "assigned_exercise_ids",
    "exercise_equipment_fk_closure",
    "equipment_assignment",
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
    "marker_evaluator",
    "marketplace_equipment_logic",
    "facility_runtime_logic",
    "organisation_runtime_logic"
  ]) {
    const local = structuredClone(document);
    local.records[0][field] = true;

    assert.throws(
      () => sReg16ValidateCandidateEquipmentRegistryContentBatch1({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_16_FAILURE_TOKEN);
        assert.equal(error.reason, "forbidden_candidate_equipment_semantic_key");
        return true;
      }
    );
  }
});

test("S-REG-16 fails closed on FK drift", () => {
  const document = sReg16LoadCandidateEquipmentContentBatch1();

  for (const mutation of [
    { activity_applicability: ["unknown_activity"] },
    { movement_pattern_applicability: ["unknown_movement"] },
    { equipment_id: "barbell" }
  ]) {
    const local = structuredClone(document);
    local.records[0] = {
      ...local.records[0],
      ...mutation
    };

    assert.throws(
      () => sReg16ValidateCandidateEquipmentRegistryContentBatch1({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_16_FAILURE_TOKEN);
        return true;
      }
    );
  }
});