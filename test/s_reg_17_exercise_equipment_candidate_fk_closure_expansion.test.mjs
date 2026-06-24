import assert from "node:assert/strict";
import test from "node:test";

import {
  S_REG_17_BATCH_ID,
  S_REG_17_CANDIDATE_STATUS,
  S_REG_17_CONTENT_BATCH_STATUS,
  S_REG_17_EXPECTED_CLOSURE_IDS,
  S_REG_17_FAILURE_TOKEN,
  S_REG_17_REGISTRY_ID,
  S_REG_17_RUNTIME_STATUS,
  S_REG_17_SLICE_ID,
  sReg17LoadExerciseEquipmentCandidateFkClosureExpansion,
  sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion
} from "../ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.mjs";

test("S-REG-17 validates exercise-equipment candidate FK closure expansion", () => {
  const result = sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion();

  assert.equal(result.ok, true);
  assert.equal(result.token, S_REG_17_FAILURE_TOKEN);
  assert.equal(result.slice_id, S_REG_17_SLICE_ID);
  assert.equal(result.batch_id, S_REG_17_BATCH_ID);
  assert.equal(result.registry_id, S_REG_17_REGISTRY_ID);
  assert.equal(result.record_count, S_REG_17_EXPECTED_CLOSURE_IDS.length);
  assert.deepEqual(result.closure_ids, S_REG_17_EXPECTED_CLOSURE_IDS);
  assert.deepEqual(result.dependency_inputs, ["S-REG-15", "S-REG-16"]);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_17_RUNTIME_STATUS);
  assert.equal(result.candidate_status, S_REG_17_CANDIDATE_STATUS);
  assert.equal(result.content_batch_status, S_REG_17_CONTENT_BATCH_STATUS);
});

test("S-REG-17 document remains inert and outside active registry law", () => {
  const document = sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();

  assert.equal(document.slice_id, "S-REG-17");
  assert.equal(document.registry_id, "exercise_equipment_fk_closure");
  assert.equal(document.batch_id, "candidate_exercise_equipment_fk_closure_expansion_batch_1");
  assert.equal(document.source_queue_slice_id, "S-REG-14");
  assert.equal(document.source_queue_order, 3);
  assert.deepEqual(document.dependency_inputs, ["S-REG-15", "S-REG-16"]);
  assert.equal(document.candidate_status, "candidate_content_draft");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.content_batch_status, "candidate_fk_closure_expanded_inert");
  assert.equal(document.active_registry_mutation, false);
  assert.equal(document.active_bundle_mutation, false);
  assert.equal(document.registry_law_mutation, false);
  assert.equal(document.engine_runtime_mutation, false);
  assert.equal(document.high_volume_content_added, false);
  assert.equal(document.activation_ready, false);
  assert.equal(document.complete_registry_claim, false);
  assert.equal(document.programme_assignment_mutation, false);
  assert.equal(document.substitution_runtime_mutation, false);
  assert.equal(document.marker_evaluator_mutation, false);
  assert.equal(document.threshold_marker_mutation, false);
  assert.equal(document.record_count, 20);
});

test("S-REG-17 candidate closure records expose only factual FK relationship fields", () => {
  const document = sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();

  for (const record of document.records) {
    assert.equal(record.closure_id, `${record.exercise_id}__${record.equipment_id}`);
    assert.equal(record.registry_id, "exercise_equipment_fk_closure");
    assert.equal(record.batch_id, "candidate_exercise_equipment_fk_closure_expansion_batch_1");
    assert.equal(record.exercise_source_slice_id, "S-REG-15");
    assert.equal(record.equipment_source_slice_id, "S-REG-16");
    assert.equal(record.relationship_basis, "activity_and_movement_fk_match");
    assert.equal(record.source_slice_id, "S-REG-17");
    assert.equal(record.candidate_status, "candidate_content_draft");
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
    assert.equal(record.active_registry_mutation, false);
    assert.equal(record.active_bundle_mutation, false);
    assert.equal(record.registry_law_mutation, false);
    assert.equal(record.engine_runtime_mutation, false);
    assert.equal(record.complete_registry_claim, false);
    assert.equal(record.programme_assignment_mutation, false);
    assert.equal(record.substitution_runtime_mutation, false);
    assert.equal(record.marker_evaluator_mutation, false);
    assert.equal(record.threshold_marker_mutation, false);
    assert.equal(record.closure_scope, "candidate_fk_relationship");
    assert.equal(record.copy_legal_boundary_notes, "factual exercise-equipment FK relationship only");
    assert.ok(Array.isArray(record.activity_ids_intersection));
    assert.ok(record.activity_ids_intersection.length > 0);
  }
});

test("S-REG-17 closure matrix remains deterministic", () => {
  const document = sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();

  const byExercise = new Map();

  for (const record of document.records) {
    const current = byExercise.get(record.exercise_id) ?? [];
    current.push(record.equipment_id);
    byExercise.set(record.exercise_id, current);
  }

  assert.deepEqual(byExercise.get("paused_back_squat"), [
    "dumbbell",
    "kettlebell",
    "resistance_band"
  ]);

  assert.deepEqual(byExercise.get("tempo_back_squat"), [
    "dumbbell",
    "kettlebell",
    "resistance_band"
  ]);

  assert.deepEqual(byExercise.get("paused_deadlift"), [
    "dumbbell",
    "kettlebell",
    "resistance_band"
  ]);

  assert.deepEqual(byExercise.get("romanian_deadlift"), [
    "dumbbell",
    "kettlebell",
    "resistance_band"
  ]);

  assert.deepEqual(byExercise.get("paused_bench_press"), [
    "dumbbell",
    "adjustable_bench",
    "cable_machine",
    "resistance_band"
  ]);

  assert.deepEqual(byExercise.get("close_grip_bench_press"), [
    "dumbbell",
    "adjustable_bench",
    "cable_machine",
    "resistance_band"
  ]);
});

test("S-REG-17 fails closed on activation or runtime mutation", () => {
  const document = sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();

  for (const mutation of [
    { activation_ready: true },
    { active_registry_mutation: true },
    { active_bundle_mutation: true },
    { registry_law_mutation: true },
    { engine_runtime_mutation: true },
    { runtime_status: "runtime" },
    { complete_registry_claim: true },
    { programme_assignment_mutation: true },
    { substitution_runtime_mutation: true },
    { marker_evaluator_mutation: true },
    { threshold_marker_mutation: true }
  ]) {
    assert.throws(
      () => sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion({
        document: {
          ...document,
          ...mutation
        }
      }),
      (error) => {
        assert.equal(error.code, S_REG_17_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-17 fails closed on forbidden semantic fields", () => {
  const document = sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();

  for (const field of [
    "programme_assignment",
    "programme_template_formula",
    "progression_formula",
    "substitution_rank",
    "fallback_logic",
    "equipment_advice",
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
    "coach_interpretation",
    "marketplace_logic",
    "facility_runtime_logic",
    "organisation_runtime_logic",
    "threshold_marker_result",
    "marker_evaluator_result"
  ]) {
    const local = structuredClone(document);
    local.records[0][field] = true;

    assert.throws(
      () => sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_17_FAILURE_TOKEN);
        assert.equal(error.reason, "forbidden_candidate_fk_closure_semantic_key");
        return true;
      }
    );
  }
});

test("S-REG-17 fails closed on unknown FK references or missing relationship closure", () => {
  const document = sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();

  for (const mutation of [
    { exercise_id: "unknown_exercise", closure_id: "unknown_exercise__dumbbell" },
    { equipment_id: "unknown_equipment", closure_id: "paused_back_squat__unknown_equipment" },
    { movement_id: "brace" },
    { activity_ids_intersection: ["unknown_activity"] }
  ]) {
    const local = structuredClone(document);
    local.records[0] = {
      ...local.records[0],
      ...mutation
    };

    assert.throws(
      () => sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_17_FAILURE_TOKEN);
        return true;
      }
    );
  }
});