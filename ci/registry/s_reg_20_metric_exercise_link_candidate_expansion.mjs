import fs from "node:fs";

/**
 * DEV NOTE: S-REG-20 metric-exercise link candidate expansion.
 * Purpose: validates the first inert candidate metric-exercise link expansion
 * after S-REG-19, binding factual S-REG-19 metric identities to S-REG-15
 * candidate exercise identities where S-REG-18 activity applicability evidence
 * exists.
 * Boundary: factual FK relationship records only. This module must not activate
 * registries, mutate active registry law, change deterministic engine output,
 * change Phase 1 runtime acceptance, create threshold marker records, create
 * marker evaluator behaviour, create comparison results, create coach
 * interpretation, create programme assignment, create substitution runtime
 * behaviour, or mutate S-REG-12, S-REG-15, S-REG-18, or S-REG-19 files.
 * Determinism: validation is closed over S-REG-12 seed link IDs, S-REG-15
 * exercise IDs, S-REG-18 exercise-activity evidence, S-REG-19 metric IDs,
 * S-REG-14 queue order, and the exact S-REG-20 expansion record order.
 * Failure: invalid metric-exercise link expansion fails closed with
 * CI_S_REG_20_METRIC_EXERCISE_LINK_CANDIDATE_EXPANSION.
 */

import {
  sReg12LoadMetricExerciseLinkCandidateSeedFile,
  sReg12ValidateMetricExerciseLinkCandidateSeeds
} from "./s_reg_12_metric_exercise_link_candidate_seeds.mjs";

import {
  S_REG_15_EXPECTED_RECORD_IDS,
  sReg15LoadCandidateExerciseContentBatch1,
  sReg15ValidateCandidateExerciseRegistryContentBatch1
} from "./s_reg_15_candidate_exercise_registry_content_batch_1.mjs";

import {
  sReg18LoadExerciseActivityApplicabilityCandidateExpansion,
  sReg18ValidateExerciseActivityApplicabilityCandidateExpansion
} from "./s_reg_18_exercise_activity_applicability_candidate_expansion.mjs";

import {
  S_REG_19_EXPECTED_SPORT_METRIC_IDS,
  sReg19LoadSportMetricCandidateExpansion,
  sReg19ValidateSportMetricCandidateExpansion
} from "./s_reg_19_sport_metric_candidate_expansion.mjs";

import {
  S_REG_14_BUILD_QUEUE,
  sReg14LoadRegistryBuildReadinessManifest,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "./s_reg_14_registry_build_readiness_start_gate.mjs";

export const S_REG_20_SLICE_ID = "S-REG-20";
export const S_REG_20_FAILURE_TOKEN = "CI_S_REG_20_METRIC_EXERCISE_LINK_CANDIDATE_EXPANSION";
export const S_REG_20_RUNTIME_STATUS = "non_runtime";
export const S_REG_20_CANDIDATE_STATUS = "candidate_content_draft";
export const S_REG_20_BATCH_ID = "candidate_metric_exercise_link_expansion_batch_1";
export const S_REG_20_REGISTRY_ID = "metric_exercise_link_registry_1c_a";
export const S_REG_20_CONTENT_BATCH_STATUS = "candidate_content_expanded_inert";
export const S_REG_20_EXPANSION_STATUS = "candidate_fk_ready";
export const S_REG_20_CONTEXT_SCOPE = "candidate_expansion_only";
export const S_REG_20_LINK_KIND = "factual_metric_exercise_link";
export const S_REG_20_VALUE_CONTEXT = "recorded_value_context_only";

export const S_REG_20_CANDIDATE_PATHS = Object.freeze({
  metric_exercise_link_expansion_batch_1: "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json",
  s_reg_12_metric_exercise_link_seed: "ci/registry/candidates/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.candidate.registry.json",
  s_reg_15_exercise_batch_1: "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json",
  s_reg_18_applicability_batch_1: "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.json",
  s_reg_19_sport_metric_batch_1: "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
  active_registry_index: "registries/registry_index.json",
  active_registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_20_EXPECTED_LINKS = Object.freeze([
  Object.freeze(["powerlifting__attempt_count__paused_back_squat", "powerlifting__attempt_count", "paused_back_squat", "powerlifting"]),
  Object.freeze(["powerlifting__attempt_count__paused_deadlift", "powerlifting__attempt_count", "paused_deadlift", "powerlifting"]),
  Object.freeze(["powerlifting__attempt_count__paused_bench_press", "powerlifting__attempt_count", "paused_bench_press", "powerlifting"]),
  Object.freeze(["general_strength__set_count__paused_back_squat", "general_strength__set_count", "paused_back_squat", "general_strength"]),
  Object.freeze(["general_strength__set_count__romanian_deadlift", "general_strength__set_count", "romanian_deadlift", "general_strength"]),
  Object.freeze(["general_strength__set_count__close_grip_bench_press", "general_strength__set_count", "close_grip_bench_press", "general_strength"]),
  Object.freeze(["general_strength__duration_seconds__tempo_back_squat", "general_strength__duration_seconds", "tempo_back_squat", "general_strength"]),
  Object.freeze(["general_strength__duration_seconds__romanian_deadlift", "general_strength__duration_seconds", "romanian_deadlift", "general_strength"])
]);

export const S_REG_20_EXPECTED_LINK_IDS = Object.freeze(
  S_REG_20_EXPECTED_LINKS.map(([metricExerciseLinkId]) => metricExerciseLinkId)
);

export const S_REG_20_REQUIRED_RECORD_FIELDS = Object.freeze([
  "metric_exercise_link_id",
  "sport_metric_id",
  "exercise_id",
  "activity_id",
  "link_kind",
  "context_scope",
  "value_context",
  "source_slice_id",
  "candidate_status",
  "runtime_status",
  "activation_ready",
  "copy_boundary_notes"
]);

const S_REG_20_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const S_REG_20_FORBIDDEN_KEYS = Object.freeze([
  "active_registry_activation",
  "canonical_registry_activation",
  "phase1_schema_change",
  "phase1_runtime_schema_mutation",
  "threshold_id",
  "threshold_marker_id",
  "threshold_value",
  "threshold_operator",
  "threshold_marker_record",
  "threshold_marker_result",
  "marker_status",
  "marker_evaluator",
  "marker_evaluator_result",
  "evaluator_id",
  "comparison_result",
  "comparison_status",
  "selection_rule",
  "selection_score",
  "ranking_score",
  "rank",
  "recommendation_score",
  "recommended_rank",
  "optimisation_score",
  "optimization_score",
  "capability_score",
  "capability_inference",
  "readiness_score",
  "readiness_status",
  "safety_rating",
  "safety_status",
  "suitability_rating",
  "suitability_status",
  "return_to_play_status",
  "tactical_status",
  "outcome_score",
  "outcome_inference",
  "performance_score",
  "coach_interpretation",
  "programme_assignment",
  "programme_template_formula",
  "substitution_rank",
  "substitution_score",
  "substitution_runtime_change"
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg20MetricExerciseLinkCandidateExpansionError";
  error.code = S_REG_20_FAILURE_TOKEN;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  throw error;
}

function deepFreeze(value) {
  if (!isPlainRecord(value) && !Array.isArray(value)) {
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function requireString(value, field, context) {
  if (typeof value !== "string" || value.length === 0) {
    fail("required_string_invalid", `${field} must be a non-empty string.`, context);
  }

  return value;
}

function requireBoolean(value, field, context) {
  if (typeof value !== "boolean") {
    fail("required_boolean_invalid", `${field} must be a boolean.`, context);
  }

  return value;
}

function assertExactArray(actual, expected, reason, context = {}) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    fail(reason, "Array length mismatch.", { ...context, actual, expected });
  }

  for (let index = 0; index < expected.length; index++) {
    if (actual[index] !== expected[index]) {
      fail(reason, "Array order mismatch.", {
        ...context,
        index,
        actual,
        expected
      });
    }
  }
}

function requireUnique(records, idField, registryId) {
  const seen = new Set();

  for (const record of records) {
    const id = requireString(record[idField], idField, { registry_id: registryId });

    if (seen.has(id)) {
      fail("duplicate_record_id", `${idField} must be unique.`, {
        registry_id: registryId,
        id
      });
    }

    seen.add(id);
  }

  return seen;
}

function assertNoForbiddenKeys(record, context) {
  for (const key of S_REG_20_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_metric_exercise_link_semantic_key", "Metric-exercise link candidate expansion records must not contain activation, Phase 1 mutation, threshold, marker, evaluator, comparison, selection, ranking, recommendation, optimisation, capability, readiness, safety, suitability, return-to-play, tactical, outcome, performance, coach interpretation, programme, or substitution fields.", {
        ...context,
        field: key
      });
    }
  }
}

function assertActiveRegistrySurface() {
  const registryIndex = readJson(S_REG_20_CANDIDATE_PATHS.active_registry_index);
  const registryBundle = readJson(S_REG_20_CANDIDATE_PATHS.active_registry_bundle);

  assertExactArray(registryIndex.order, S_REG_20_ACTIVE_REGISTRY_ORDER, "active_registry_index_order_changed");
  assertExactArray(Object.keys(registryBundle.registries ?? {}), S_REG_20_ACTIVE_REGISTRY_ORDER, "active_registry_bundle_changed");
}

function assertDocumentBoundary(document) {
  if (!isPlainRecord(document)) {
    fail("candidate_metric_exercise_link_document_invalid", "S-REG-20 metric-exercise link expansion document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_20_SLICE_ID,
    registry_id: S_REG_20_REGISTRY_ID,
    batch_id: S_REG_20_BATCH_ID,
    registry_target: S_REG_20_REGISTRY_ID,
    source_queue_slice_id: "S-REG-14",
    source_queue_order: 6,
    candidate_status: S_REG_20_CANDIDATE_STATUS,
    runtime_status: S_REG_20_RUNTIME_STATUS,
    content_batch_status: S_REG_20_CONTENT_BATCH_STATUS,
    metric_exercise_link_expansion_status: S_REG_20_EXPANSION_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    phase1_runtime_schema_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    threshold_marker_mutation: false,
    marker_evaluator_mutation: false,
    comparison_result_mutation: false,
    programme_assignment_mutation: false,
    substitution_runtime_mutation: false,
    ui_behaviour_mutation: false,
    coach_interpretation_mutation: false,
    record_count: S_REG_20_EXPECTED_LINKS.length
  })) {
    if (document[field] !== expected) {
      fail("candidate_metric_exercise_link_document_boundary_field_invalid", "S-REG-20 metric-exercise link expansion document boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  assertExactArray(document.dependency_inputs, ["S-REG-15", "S-REG-19"], "dependency_inputs_invalid");
  assertExactArray(document.foundation_inputs, ["S-REG-12", "S-REG-18"], "foundation_inputs_invalid");

  if (!Array.isArray(document.records)) {
    fail("candidate_metric_exercise_link_records_invalid", "S-REG-20 records must be an array.");
  }

  assertExactArray(
    document.records.map((record) => record.metric_exercise_link_id),
    S_REG_20_EXPECTED_LINK_IDS,
    "candidate_metric_exercise_link_record_order_invalid"
  );
}

function assertQueueBoundary() {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();
  const queueItem = manifest.candidate_build_queue.find((entry) => entry.slice_id === S_REG_20_SLICE_ID);
  const constantQueueItem = S_REG_14_BUILD_QUEUE.find((entry) => entry.slice_id === S_REG_20_SLICE_ID);

  if (!queueItem || !constantQueueItem) {
    fail("s_reg_20_queue_item_missing", "S-REG-14 must declare S-REG-20 in the build queue.");
  }

  for (const [field, expected] of Object.entries({
    order: 6,
    slice_id: S_REG_20_SLICE_ID,
    batch_id: S_REG_20_BATCH_ID,
    registry_target: S_REG_20_REGISTRY_ID,
    proof_command: "npm.cmd run proof:s-reg-20",
    content_status_after_slice: S_REG_20_CONTENT_BATCH_STATUS
  })) {
    if (queueItem[field] !== expected) {
      fail("s_reg_20_queue_item_invalid", "S-REG-14 queue item field mismatch.", {
        field,
        expected,
        actual: queueItem[field]
      });
    }

    if (constantQueueItem[field] !== expected) {
      fail("s_reg_20_constant_queue_item_invalid", "S-REG-14 exported queue item field mismatch.", {
        field,
        expected,
        actual: constantQueueItem[field]
      });
    }
  }

  assertExactArray(queueItem.dependency_inputs, ["S-REG-15", "S-REG-19"], "s_reg_20_queue_dependencies_invalid");
}

function assertSReg12Dependency(sReg12Document) {
  const result = sReg12ValidateMetricExerciseLinkCandidateSeeds({
    metricExerciseLinkDocument: sReg12Document
  });

  if (!result.ok) {
    fail("s_reg_12_dependency_invalid", "S-REG-12 metric-exercise link candidate seed dependency did not validate.", { result });
  }
}

function assertSReg15Dependency(sReg15Document) {
  const result = sReg15ValidateCandidateExerciseRegistryContentBatch1({
    document: sReg15Document
  });

  if (!result.ok) {
    fail("s_reg_15_dependency_invalid", "S-REG-15 candidate exercise expansion did not validate.", { result });
  }

  assertExactArray(result.exercise_ids, S_REG_15_EXPECTED_RECORD_IDS, "s_reg_15_dependency_exercise_ids_invalid");
}

function assertSReg18Dependency(sReg18Document, sReg15Document) {
  const result = sReg18ValidateExerciseActivityApplicabilityCandidateExpansion({
    document: sReg18Document,
    sReg15Document
  });

  if (!result.ok) {
    fail("s_reg_18_dependency_invalid", "S-REG-18 candidate applicability expansion did not validate.", { result });
  }
}

function assertSReg19Dependency(sReg19Document) {
  const result = sReg19ValidateSportMetricCandidateExpansion({
    document: sReg19Document
  });

  if (!result.ok) {
    fail("s_reg_19_dependency_invalid", "S-REG-19 sport metric expansion did not validate.", { result });
  }

  assertExactArray(result.sport_metric_ids, S_REG_19_EXPECTED_SPORT_METRIC_IDS, "s_reg_19_dependency_metric_ids_invalid");
}

function assertRecordBoundary(record, expected, context) {
  if (!isPlainRecord(record)) {
    fail("candidate_metric_exercise_link_record_invalid", "Metric-exercise link candidate expansion record must be a plain object.", context);
  }

  for (const field of S_REG_20_REQUIRED_RECORD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      fail("candidate_metric_exercise_link_required_field_missing", "Metric-exercise link expansion record required field missing.", {
        ...context,
        field
      });
    }
  }

  assertNoForbiddenKeys(record, context);

  requireString(record.metric_exercise_link_id, "metric_exercise_link_id", context);
  requireString(record.sport_metric_id, "sport_metric_id", context);
  requireString(record.exercise_id, "exercise_id", context);
  requireString(record.activity_id, "activity_id", context);
  requireString(record.link_kind, "link_kind", context);
  requireString(record.context_scope, "context_scope", context);
  requireString(record.value_context, "value_context", context);
  requireString(record.source_slice_id, "source_slice_id", context);
  requireString(record.candidate_status, "candidate_status", context);
  requireString(record.runtime_status, "runtime_status", context);
  requireBoolean(record.activation_ready, "activation_ready", context);
  requireString(record.copy_boundary_notes, "copy_boundary_notes", context);

  const [
    expectedMetricExerciseLinkId,
    expectedSportMetricId,
    expectedExerciseId,
    expectedActivityId
  ] = expected;

  for (const [field, expectedValue] of Object.entries({
    metric_exercise_link_id: expectedMetricExerciseLinkId,
    sport_metric_id: expectedSportMetricId,
    exercise_id: expectedExerciseId,
    activity_id: expectedActivityId,
    link_kind: S_REG_20_LINK_KIND,
    context_scope: S_REG_20_CONTEXT_SCOPE,
    value_context: S_REG_20_VALUE_CONTEXT,
    source_slice_id: S_REG_20_SLICE_ID,
    candidate_status: S_REG_20_CANDIDATE_STATUS,
    runtime_status: S_REG_20_RUNTIME_STATUS,
    activation_ready: false,
    copy_boundary_notes: "factual metric-exercise relationship only"
  })) {
    if (record[field] !== expectedValue) {
      fail("candidate_metric_exercise_link_record_field_invalid", "S-REG-20 metric-exercise link record field mismatch.", {
        ...context,
        field,
        expected: expectedValue,
        actual: record[field]
      });
    }
  }
}

function assertLinkRelationship(record, seedLinkIds, metricById, exerciseById, applicabilitySet, context) {
  if (seedLinkIds.has(record.metric_exercise_link_id)) {
    fail("metric_exercise_link_duplicates_s_reg_12_seed", "S-REG-20 must not duplicate an existing S-REG-12 metric-exercise link id.", context);
  }

  const metric = metricById.get(record.sport_metric_id);

  if (!metric) {
    fail("sport_metric_fk_unknown", "Metric-exercise link candidate expansion references an unknown S-REG-19 sport metric id.", context);
  }

  if (metric.activity_id !== record.activity_id) {
    fail("metric_activity_mismatch", "Metric-exercise link activity_id must match the referenced S-REG-19 sport metric activity_id.", {
      ...context,
      metric_activity_id: metric.activity_id
    });
  }

  const exercise = exerciseById.get(record.exercise_id);

  if (!exercise) {
    fail("exercise_fk_unknown", "Metric-exercise link candidate expansion references an unknown S-REG-15 exercise id.", context);
  }

  if (!Array.isArray(exercise.activity_ids) || !exercise.activity_ids.includes(record.activity_id)) {
    fail("exercise_activity_mismatch", "Metric-exercise link activity_id must be declared on the referenced S-REG-15 exercise candidate.", context);
  }

  if (!applicabilitySet.has(`${record.exercise_id}::${record.activity_id}`)) {
    fail("exercise_activity_applicability_missing", "Metric-exercise link must have matching S-REG-18 exercise-activity applicability evidence.", context);
  }
}

export function sReg20CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_20_CANDIDATE_PATHS));
}

export function sReg20LoadMetricExerciseLinkCandidateExpansion() {
  return deepFreeze(readJson(S_REG_20_CANDIDATE_PATHS.metric_exercise_link_expansion_batch_1));
}

export function sReg20ValidateMetricExerciseLinkCandidateExpansion({
  document,
  sReg12Document,
  sReg15Document,
  sReg18Document,
  sReg19Document
} = {}) {
  assertActiveRegistrySurface();
  sReg14ValidateRegistryBuildReadinessStartGate();
  assertQueueBoundary();

  const loadedSReg12Document = sReg12Document ?? sReg12LoadMetricExerciseLinkCandidateSeedFile();
  const loadedSReg15Document = sReg15Document ?? sReg15LoadCandidateExerciseContentBatch1();
  const loadedSReg18Document = sReg18Document ?? sReg18LoadExerciseActivityApplicabilityCandidateExpansion();
  const loadedSReg19Document = sReg19Document ?? sReg19LoadSportMetricCandidateExpansion();
  const loadedDocument = document ?? sReg20LoadMetricExerciseLinkCandidateExpansion();

  assertDocumentBoundary(loadedDocument);
  requireUnique(loadedDocument.records, "metric_exercise_link_id", S_REG_20_REGISTRY_ID);

  assertSReg12Dependency(loadedSReg12Document);
  assertSReg15Dependency(loadedSReg15Document);
  assertSReg18Dependency(loadedSReg18Document, loadedSReg15Document);
  assertSReg19Dependency(loadedSReg19Document);

  const seedLinkIds = new Set(loadedSReg12Document.records.map((record) => record.metric_exercise_link_id));
  const metricById = new Map(loadedSReg19Document.records.map((record) => [record.sport_metric_id, record]));
  const exerciseById = new Map(loadedSReg15Document.records.map((record) => [record.exercise_id, record]));
  const applicabilitySet = new Set(loadedSReg18Document.records.map((record) => `${record.exercise_id}::${record.activity_id}`));

  for (let index = 0; index < S_REG_20_EXPECTED_LINKS.length; index += 1) {
    const record = loadedDocument.records[index];
    const expected = S_REG_20_EXPECTED_LINKS[index];

    const context = {
      metric_exercise_link_id: record?.metric_exercise_link_id ?? null,
      sport_metric_id: record?.sport_metric_id ?? null,
      exercise_id: record?.exercise_id ?? null,
      activity_id: record?.activity_id ?? null,
      batch_id: S_REG_20_BATCH_ID
    };

    assertRecordBoundary(record, expected, context);
    assertLinkRelationship(record, seedLinkIds, metricById, exerciseById, applicabilitySet, context);
  }

  return deepFreeze({
    ok: true,
    token: S_REG_20_FAILURE_TOKEN,
    slice_id: S_REG_20_SLICE_ID,
    batch_id: S_REG_20_BATCH_ID,
    registry_id: S_REG_20_REGISTRY_ID,
    record_count: loadedDocument.records.length,
    metric_exercise_link_ids: loadedDocument.records.map((record) => record.metric_exercise_link_id),
    sport_metric_ids: Array.from(new Set(loadedDocument.records.map((record) => record.sport_metric_id))),
    exercise_ids: Array.from(new Set(loadedDocument.records.map((record) => record.exercise_id))),
    activity_ids: Array.from(new Set(loadedDocument.records.map((record) => record.activity_id))),
    dependency_inputs: loadedDocument.dependency_inputs,
    foundation_inputs: loadedDocument.foundation_inputs,
    metric_exercise_link_expansion_status: S_REG_20_EXPANSION_STATUS,
    link_kind: S_REG_20_LINK_KIND,
    context_scope: S_REG_20_CONTEXT_SCOPE,
    value_context: S_REG_20_VALUE_CONTEXT,
    activation_ready: false,
    runtime_status: S_REG_20_RUNTIME_STATUS
  });
}