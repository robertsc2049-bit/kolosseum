import assert from "node:assert/strict";
import test from "node:test";

import {
  S_REG_20_BATCH_ID,
  S_REG_20_EXPECTED_LINK_IDS,
  S_REG_20_EXPANSION_STATUS,
  S_REG_20_FAILURE_TOKEN,
  S_REG_20_LINK_KIND,
  S_REG_20_REGISTRY_ID,
  S_REG_20_SLICE_ID,
  S_REG_20_VALUE_CONTEXT,
  sReg20LoadMetricExerciseLinkCandidateExpansion,
  sReg20ValidateMetricExerciseLinkCandidateExpansion
} from "../ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.mjs";

test("S-REG-20 validates metric-exercise link candidate expansion", () => {
  const result = sReg20ValidateMetricExerciseLinkCandidateExpansion();

  assert.equal(result.ok, true);
  assert.equal(result.token, S_REG_20_FAILURE_TOKEN);
  assert.equal(result.slice_id, S_REG_20_SLICE_ID);
  assert.equal(result.batch_id, S_REG_20_BATCH_ID);
  assert.equal(result.registry_id, S_REG_20_REGISTRY_ID);
  assert.equal(result.record_count, S_REG_20_EXPECTED_LINK_IDS.length);
  assert.deepEqual(result.metric_exercise_link_ids, S_REG_20_EXPECTED_LINK_IDS);
  assert.deepEqual(result.dependency_inputs, ["S-REG-15", "S-REG-19"]);
  assert.deepEqual(result.foundation_inputs, ["S-REG-12", "S-REG-18"]);
  assert.equal(result.metric_exercise_link_expansion_status, S_REG_20_EXPANSION_STATUS);
  assert.equal(result.link_kind, S_REG_20_LINK_KIND);
  assert.equal(result.value_context, S_REG_20_VALUE_CONTEXT);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, "non_runtime");
});

test("S-REG-20 document remains inert and outside active registry law", () => {
  const document = sReg20LoadMetricExerciseLinkCandidateExpansion();

  assert.equal(document.slice_id, S_REG_20_SLICE_ID);
  assert.equal(document.registry_id, S_REG_20_REGISTRY_ID);
  assert.equal(document.batch_id, S_REG_20_BATCH_ID);
  assert.equal(document.source_queue_slice_id, "S-REG-14");
  assert.equal(document.source_queue_order, 6);
  assert.deepEqual(document.dependency_inputs, ["S-REG-15", "S-REG-19"]);
  assert.deepEqual(document.foundation_inputs, ["S-REG-12", "S-REG-18"]);
  assert.equal(document.candidate_status, "candidate_content_draft");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.content_batch_status, "candidate_content_expanded_inert");
  assert.equal(document.metric_exercise_link_expansion_status, S_REG_20_EXPANSION_STATUS);
  assert.equal(document.active_registry_mutation, false);
  assert.equal(document.active_bundle_mutation, false);
  assert.equal(document.registry_law_mutation, false);
  assert.equal(document.engine_runtime_mutation, false);
  assert.equal(document.phase1_runtime_schema_mutation, false);
  assert.equal(document.activation_ready, false);
  assert.equal(document.complete_registry_claim, false);
  assert.equal(document.threshold_marker_mutation, false);
  assert.equal(document.marker_evaluator_mutation, false);
  assert.equal(document.comparison_result_mutation, false);
  assert.equal(document.programme_assignment_mutation, false);
  assert.equal(document.substitution_runtime_mutation, false);
  assert.equal(document.ui_behaviour_mutation, false);
  assert.equal(document.coach_interpretation_mutation, false);
});

test("S-REG-20 candidate records expose factual FK relationship fields only", () => {
  const document = sReg20LoadMetricExerciseLinkCandidateExpansion();

  for (const record of document.records) {
    assert.equal(record.link_kind, S_REG_20_LINK_KIND);
    assert.equal(record.context_scope, "candidate_expansion_only");
    assert.equal(record.value_context, S_REG_20_VALUE_CONTEXT);
    assert.equal(record.source_slice_id, S_REG_20_SLICE_ID);
    assert.equal(record.candidate_status, "candidate_content_draft");
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
    assert.equal(record.copy_boundary_notes, "factual metric-exercise relationship only");

    assert.equal(Object.hasOwn(record, "threshold_id"), false);
    assert.equal(Object.hasOwn(record, "threshold_marker_id"), false);
    assert.equal(Object.hasOwn(record, "threshold_value"), false);
    assert.equal(Object.hasOwn(record, "marker_status"), false);
    assert.equal(Object.hasOwn(record, "marker_evaluator"), false);
    assert.equal(Object.hasOwn(record, "comparison_result"), false);
    assert.equal(Object.hasOwn(record, "recommendation_score"), false);
    assert.equal(Object.hasOwn(record, "readiness_score"), false);
    assert.equal(Object.hasOwn(record, "safety_status"), false);
    assert.equal(Object.hasOwn(record, "suitability_status"), false);
    assert.equal(Object.hasOwn(record, "outcome_score"), false);
    assert.equal(Object.hasOwn(record, "coach_interpretation"), false);
    assert.equal(Object.hasOwn(record, "programme_assignment"), false);
    assert.equal(Object.hasOwn(record, "substitution_score"), false);
  }
});

test("S-REG-20 link order remains deterministic", () => {
  const document = sReg20LoadMetricExerciseLinkCandidateExpansion();

  assert.deepEqual(
    document.records.map((record) => record.metric_exercise_link_id),
    S_REG_20_EXPECTED_LINK_IDS
  );
});

test("S-REG-20 fails closed on activation, runtime, Phase 1, threshold, evaluator, comparison, UI, coach, programme, or substitution mutation", () => {
  const document = sReg20LoadMetricExerciseLinkCandidateExpansion();

  for (const patch of [
    { active_registry_mutation: true },
    { active_bundle_mutation: true },
    { registry_law_mutation: true },
    { engine_runtime_mutation: true },
    { phase1_runtime_schema_mutation: true },
    { threshold_marker_mutation: true },
    { marker_evaluator_mutation: true },
    { comparison_result_mutation: true },
    { programme_assignment_mutation: true },
    { substitution_runtime_mutation: true },
    { ui_behaviour_mutation: true },
    { coach_interpretation_mutation: true }
  ]) {
    assert.throws(
      () => sReg20ValidateMetricExerciseLinkCandidateExpansion({
        document: {
          ...document,
          ...patch
        }
      }),
      (error) => {
        assert.equal(error.code, S_REG_20_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-20 fails closed on forbidden semantic fields", () => {
  const document = sReg20LoadMetricExerciseLinkCandidateExpansion();

  for (const field of [
    "threshold_id",
    "threshold_marker_id",
    "threshold_value",
    "marker_status",
    "marker_evaluator",
    "comparison_result",
    "selection_score",
    "ranking_score",
    "recommendation_score",
    "readiness_score",
    "safety_status",
    "suitability_status",
    "tactical_status",
    "outcome_score",
    "coach_interpretation",
    "programme_assignment",
    "substitution_score"
  ]) {
    const patched = {
      ...document,
      records: document.records.map((record, index) => index === 0 ? { ...record, [field]: "forbidden" } : record)
    };

    assert.throws(
      () => sReg20ValidateMetricExerciseLinkCandidateExpansion({ document: patched }),
      (error) => {
        assert.equal(error.code, S_REG_20_FAILURE_TOKEN);
        assert.equal(error.reason, "forbidden_metric_exercise_link_semantic_key");
        return true;
      }
    );
  }
});

test("S-REG-20 fails closed on invalid FK references or duplicate seed link id", () => {
  const document = sReg20LoadMetricExerciseLinkCandidateExpansion();

  for (const patch of [
    { metric_exercise_link_id: "powerlifting__load_kg__back_squat" },
    { sport_metric_id: "unknown_metric" },
    { exercise_id: "unknown_exercise" },
    { activity_id: "rugby_union" }
  ]) {
    const patched = {
      ...document,
      records: document.records.map((record, index) => index === 0 ? { ...record, ...patch } : record)
    };

    assert.throws(
      () => sReg20ValidateMetricExerciseLinkCandidateExpansion({ document: patched }),
      (error) => {
        assert.equal(error.code, S_REG_20_FAILURE_TOKEN);
        return true;
      }
    );
  }
});