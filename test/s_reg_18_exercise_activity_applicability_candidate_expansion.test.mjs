import assert from "node:assert/strict";
import test from "node:test";

import {
  S_REG_18_ACTIVITY_CONTEXT,
  S_REG_18_APPLICABILITY_STATE,
  S_REG_18_BATCH_ID,
  S_REG_18_CANDIDATE_STATUS,
  S_REG_18_CONTENT_BATCH_STATUS,
  S_REG_18_EXPECTED_APPLICABILITY_IDS,
  S_REG_18_FAILURE_TOKEN,
  S_REG_18_REGISTRY_ID,
  S_REG_18_RUNTIME_STATUS,
  S_REG_18_SLICE_ID,
  S_REG_18_TIER_CAP,
  sReg18LoadExerciseActivityApplicabilityCandidateExpansion,
  sReg18ValidateExerciseActivityApplicabilityCandidateExpansion
} from "../ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.mjs";

test("S-REG-18 validates exercise activity applicability candidate expansion", () => {
  const result = sReg18ValidateExerciseActivityApplicabilityCandidateExpansion();

  assert.equal(result.ok, true);
  assert.equal(result.token, S_REG_18_FAILURE_TOKEN);
  assert.equal(result.slice_id, S_REG_18_SLICE_ID);
  assert.equal(result.batch_id, S_REG_18_BATCH_ID);
  assert.equal(result.registry_id, S_REG_18_REGISTRY_ID);
  assert.equal(result.record_count, S_REG_18_EXPECTED_APPLICABILITY_IDS.length);
  assert.deepEqual(result.applicability_ids, S_REG_18_EXPECTED_APPLICABILITY_IDS);
  assert.deepEqual(result.dependency_inputs, ["S-REG-10", "S-REG-15", "S-REG-17"]);
  assert.deepEqual(result.foundation_inputs, ["S-REG-06", "S-REG-09"]);
  assert.equal(result.activity_context, S_REG_18_ACTIVITY_CONTEXT);
  assert.equal(result.applicability_state, S_REG_18_APPLICABILITY_STATE);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_18_RUNTIME_STATUS);
  assert.equal(result.candidate_status, S_REG_18_CANDIDATE_STATUS);
  assert.equal(result.content_batch_status, S_REG_18_CONTENT_BATCH_STATUS);
});

test("S-REG-18 document remains inert and outside active registry law", () => {
  const document = sReg18LoadExerciseActivityApplicabilityCandidateExpansion();

  assert.equal(document.slice_id, "S-REG-18");
  assert.equal(document.registry_id, "exercise_activity_applicability_registry");
  assert.equal(document.batch_id, "candidate_exercise_activity_applicability_expansion_batch_1");
  assert.equal(document.source_queue_slice_id, "S-REG-14");
  assert.equal(document.source_queue_order, 4);
  assert.deepEqual(document.dependency_inputs, ["S-REG-10", "S-REG-15", "S-REG-17"]);
  assert.deepEqual(document.foundation_inputs, ["S-REG-06", "S-REG-09"]);
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
  assert.equal(document.programme_assignment_mutation, false);
  assert.equal(document.substitution_runtime_mutation, false);
  assert.equal(document.marker_evaluator_mutation, false);
  assert.equal(document.threshold_marker_mutation, false);
  assert.equal(document.record_count, 18);
});

test("S-REG-18 candidate records expose only factual training applicability fields", () => {
  const document = sReg18LoadExerciseActivityApplicabilityCandidateExpansion();

  for (const record of document.records) {
    assert.equal(record.applicability_id, `${record.exercise_id}__${record.activity_id}__training`);
    assert.equal(record.activity_context, S_REG_18_ACTIVITY_CONTEXT);
    assert.equal(record.registry_id, "exercise_activity_applicability_registry");
    assert.equal(record.batch_id, "candidate_exercise_activity_applicability_expansion_batch_1");
    assert.equal(record.exercise_source_slice_id, "S-REG-15");
    assert.equal(record.fk_closure_source_slice_id, "S-REG-17");
    assert.equal(record.relationship_basis, "declared_exercise_activity_and_fk_closure_evidence");
    assert.equal(record.applicability_state, S_REG_18_APPLICABILITY_STATE);
    assert.deepEqual(record.conditions, []);
    assert.equal(record.tier_cap, S_REG_18_TIER_CAP);
    assert.equal(record.template_applicability, "eligible");
    assert.equal(record.substitution_applicability, "eligible");
    assert.equal(record.source_slice_id, "S-REG-18");
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
    assert.equal(record.applicability_scope, "candidate_exercise_activity_relationship");
    assert.equal(record.copy_legal_boundary_notes, "factual candidate applicability link only");
    assert.ok(Array.isArray(record.fk_closure_evidence_ids));
    assert.ok(record.fk_closure_evidence_ids.length > 0);
  }
});

test("S-REG-18 applicability matrix remains deterministic", () => {
  const document = sReg18LoadExerciseActivityApplicabilityCandidateExpansion();
  const byExercise = new Map();

  for (const record of document.records) {
    const current = byExercise.get(record.exercise_id) ?? [];
    current.push(record.activity_id);
    byExercise.set(record.exercise_id, current);
  }

  for (const exerciseId of [
    "paused_back_squat",
    "tempo_back_squat",
    "paused_deadlift",
    "romanian_deadlift",
    "paused_bench_press",
    "close_grip_bench_press"
  ]) {
    assert.deepEqual(byExercise.get(exerciseId), [
      "powerlifting",
      "general_strength",
      "rugby_union"
    ]);
  }
});

test("S-REG-18 fails closed on activation or runtime mutation", () => {
  const document = sReg18LoadExerciseActivityApplicabilityCandidateExpansion();

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
      () => sReg18ValidateExerciseActivityApplicabilityCandidateExpansion({
        document: {
          ...document,
          ...mutation
        }
      }),
      (error) => {
        assert.equal(error.code, S_REG_18_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-18 fails closed on forbidden semantic fields", () => {
  const document = sReg18LoadExerciseActivityApplicabilityCandidateExpansion();

  for (const field of [
    "programme_assignment",
    "programme_template_formula",
    "progression_formula",
    "substitution_rank",
    "fallback_logic",
    "recommendation_score",
    "ranking_score",
    "optimisation_score",
    "capability_score",
    "inferred_applicability",
    "preferred_exercise",
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
      () => sReg18ValidateExerciseActivityApplicabilityCandidateExpansion({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_18_FAILURE_TOKEN);
        assert.equal(error.reason, "forbidden_applicability_semantic_key");
        return true;
      }
    );
  }
});

test("S-REG-18 fails closed on unknown FK references or missing FK closure evidence", () => {
  const document = sReg18LoadExerciseActivityApplicabilityCandidateExpansion();

  for (const mutation of [
    { exercise_id: "unknown_exercise", applicability_id: "unknown_exercise__powerlifting__training" },
    { activity_id: "unknown_activity", applicability_id: "paused_back_squat__unknown_activity__training" },
    { fk_closure_evidence_ids: ["unknown_closure_id"] },
    { movement_id: "hinge" },
    { activity_context: "competition" },
    { applicability_state: "conditional" }
  ]) {
    const local = structuredClone(document);
    local.records[0] = {
      ...local.records[0],
      ...mutation
    };

    assert.throws(
      () => sReg18ValidateExerciseActivityApplicabilityCandidateExpansion({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_18_FAILURE_TOKEN);
        return true;
      }
    );
  }
});