import assert from "node:assert/strict";
import test from "node:test";

import {
  S_REG_19_BATCH_ID,
  S_REG_19_CANDIDATE_STATUS,
  S_REG_19_CONTENT_BATCH_STATUS,
  S_REG_19_CONTEXT_SCOPE,
  S_REG_19_EXPECTED_SPORT_METRIC_IDS,
  S_REG_19_EXPANSION_STATUS,
  S_REG_19_FAILURE_TOKEN,
  S_REG_19_METRIC_KIND,
  S_REG_19_REGISTRY_ID,
  S_REG_19_RUNTIME_STATUS,
  S_REG_19_SLICE_ID,
  sReg19LoadSportMetricCandidateExpansion,
  sReg19ValidateSportMetricCandidateExpansion
} from "../ci/registry/s_reg_19_sport_metric_candidate_expansion.mjs";

test("S-REG-19 validates sport metric candidate expansion", () => {
  const result = sReg19ValidateSportMetricCandidateExpansion();

  assert.equal(result.ok, true);
  assert.equal(result.token, S_REG_19_FAILURE_TOKEN);
  assert.equal(result.slice_id, S_REG_19_SLICE_ID);
  assert.equal(result.batch_id, S_REG_19_BATCH_ID);
  assert.equal(result.registry_id, S_REG_19_REGISTRY_ID);
  assert.equal(result.record_count, S_REG_19_EXPECTED_SPORT_METRIC_IDS.length);
  assert.deepEqual(result.sport_metric_ids, S_REG_19_EXPECTED_SPORT_METRIC_IDS);
  assert.deepEqual(result.dependency_inputs, ["S-REG-10", "S-REG-11", "S-REG-18"]);
  assert.deepEqual(result.foundation_inputs, ["S-REG-06"]);
  assert.equal(result.sport_metric_expansion_status, S_REG_19_EXPANSION_STATUS);
  assert.equal(result.metric_kind, S_REG_19_METRIC_KIND);
  assert.equal(result.context_scope, S_REG_19_CONTEXT_SCOPE);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, S_REG_19_RUNTIME_STATUS);
  assert.equal(result.candidate_status, S_REG_19_CANDIDATE_STATUS);
  assert.equal(result.content_batch_status, S_REG_19_CONTENT_BATCH_STATUS);
});

test("S-REG-19 document remains inert and outside active registry law", () => {
  const document = sReg19LoadSportMetricCandidateExpansion();

  assert.equal(document.slice_id, "S-REG-19");
  assert.equal(document.registry_id, "sport_metric_registry_1c");
  assert.equal(document.batch_id, "candidate_sport_metric_expansion_batch_1");
  assert.equal(document.source_queue_slice_id, "S-REG-14");
  assert.equal(document.source_queue_order, 5);
  assert.deepEqual(document.dependency_inputs, ["S-REG-10", "S-REG-11", "S-REG-18"]);
  assert.deepEqual(document.foundation_inputs, ["S-REG-06"]);
  assert.equal(document.candidate_status, "candidate_content_draft");
  assert.equal(document.runtime_status, "non_runtime");
  assert.equal(document.content_batch_status, "candidate_content_expanded_inert");
  assert.equal(document.sport_metric_expansion_status, "candidate_fk_ready");
  assert.equal(document.active_registry_mutation, false);
  assert.equal(document.active_bundle_mutation, false);
  assert.equal(document.registry_law_mutation, false);
  assert.equal(document.engine_runtime_mutation, false);
  assert.equal(document.high_volume_content_added, false);
  assert.equal(document.activation_ready, false);
  assert.equal(document.complete_registry_claim, false);
  assert.equal(document.metric_exercise_link_mutation, false);
  assert.equal(document.marker_evaluator_mutation, false);
  assert.equal(document.threshold_marker_mutation, false);
  assert.equal(document.programme_assignment_mutation, false);
  assert.equal(document.substitution_runtime_mutation, false);
  assert.equal(document.record_count, 6);
});

test("S-REG-19 candidate records expose factual metric identity fields only", () => {
  const document = sReg19LoadSportMetricCandidateExpansion();

  for (const record of document.records) {
    assert.equal(record.metric_kind, S_REG_19_METRIC_KIND);
    assert.equal(record.context_scope, S_REG_19_CONTEXT_SCOPE);
    assert.equal(record.source_slice_id, "S-REG-19");
    assert.equal(record.candidate_status, "candidate_content_draft");
    assert.equal(record.runtime_status, "non_runtime");
    assert.equal(record.activation_ready, false);
    assert.equal(record.copy_boundary_notes, "factual sport metric definition only");
    assert.equal(Object.hasOwn(record, "exercise_id"), false);
    assert.equal(Object.hasOwn(record, "exercise_ids"), false);
    assert.equal(Object.hasOwn(record, "metric_exercise_link_id"), false);
    assert.equal(Object.hasOwn(record, "threshold_id"), false);
    assert.equal(Object.hasOwn(record, "threshold_marker_id"), false);
    assert.equal(Object.hasOwn(record, "threshold_value"), false);
    assert.equal(Object.hasOwn(record, "marker_status"), false);
    assert.equal(Object.hasOwn(record, "marker_evaluator"), false);
    assert.equal(Object.hasOwn(record, "recommendation_score"), false);
    assert.equal(Object.hasOwn(record, "readiness_score"), false);
    assert.equal(Object.hasOwn(record, "safety_rating"), false);
    assert.equal(Object.hasOwn(record, "suitability_status"), false);
    assert.equal(Object.hasOwn(record, "outcome_inference"), false);
    assert.equal(Object.hasOwn(record, "coach_interpretation"), false);
  }
});

test("S-REG-19 metric order remains deterministic", () => {
  const document = sReg19LoadSportMetricCandidateExpansion();

  assert.deepEqual(
    document.records.map((record) => record.sport_metric_id),
    [
      "powerlifting__attempt_count",
      "powerlifting__body_mass_kg",
      "general_strength__set_count",
      "general_strength__duration_seconds",
      "rugby_union__jump_height_cm",
      "rugby_union__sprint_distance_m"
    ]
  );
});

test("S-REG-19 fails closed on activation or runtime mutation", () => {
  const document = sReg19LoadSportMetricCandidateExpansion();

  for (const mutation of [
    { activation_ready: true },
    { active_registry_mutation: true },
    { active_bundle_mutation: true },
    { registry_law_mutation: true },
    { engine_runtime_mutation: true },
    { runtime_status: "runtime" },
    { complete_registry_claim: true },
    { metric_exercise_link_mutation: true },
    { marker_evaluator_mutation: true },
    { threshold_marker_mutation: true },
    { programme_assignment_mutation: true },
    { substitution_runtime_mutation: true }
  ]) {
    assert.throws(
      () => sReg19ValidateSportMetricCandidateExpansion({
        document: {
          ...document,
          ...mutation
        }
      }),
      (error) => {
        assert.equal(error.code, S_REG_19_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-19 fails closed on forbidden semantic fields", () => {
  const document = sReg19LoadSportMetricCandidateExpansion();

  for (const field of [
    "exercise_id",
    "metric_exercise_link_id",
    "threshold_id",
    "threshold_marker_id",
    "threshold_value",
    "marker_status",
    "marker_evaluator",
    "selection_score",
    "ranking_score",
    "recommendation_score",
    "optimisation_score",
    "capability_score",
    "readiness_score",
    "safety_rating",
    "suitability_status",
    "return_to_play_status",
    "tactical_status",
    "outcome_inference",
    "coach_interpretation",
    "programme_assignment",
    "substitution_rank"
  ]) {
    const local = structuredClone(document);
    local.records[0][field] = true;

    assert.throws(
      () => sReg19ValidateSportMetricCandidateExpansion({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_19_FAILURE_TOKEN);
        assert.equal(error.reason, "forbidden_sport_metric_semantic_key");
        return true;
      }
    );
  }
});

test("S-REG-19 fails closed on invalid metric FK references or duplicate seed metric id", () => {
  const document = sReg19LoadSportMetricCandidateExpansion();

  for (const mutation of [
    { sport_metric_id: "powerlifting__load_kg" },
    { activity_id: "missing_activity" },
    { sport_subdivision_id: "missing_subdivision" },
    { sport_subdivision_id: "general_strength__training" },
    { context_scope: "candidate_seed_only" },
    { metric_kind: "derived_metric" }
  ]) {
    const local = structuredClone(document);
    local.records[0] = {
      ...local.records[0],
      ...mutation
    };

    assert.throws(
      () => sReg19ValidateSportMetricCandidateExpansion({ document: local }),
      (error) => {
        assert.equal(error.code, S_REG_19_FAILURE_TOKEN);
        return true;
      }
    );
  }
});