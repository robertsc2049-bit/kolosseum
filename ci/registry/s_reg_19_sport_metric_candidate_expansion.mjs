import fs from "node:fs";

/**
 * DEV NOTE: S-REG-19 sport metric candidate expansion.
 * Purpose: validates the first inert sport metric candidate expansion batch
 * after S-REG-18, using the S-REG-11 sport metric shape and S-REG-10 sport
 * context foundation.
 * Boundary: candidate sport metric identity records only. This module must not
 * activate registries, alter active registry law, change engine runtime
 * behaviour, create metric-exercise links, create threshold marker records,
 * create marker evaluator behaviour, create programme assignment, create
 * substitution behaviour, create UI interpretation, or mutate S-REG-10,
 * S-REG-11, or S-REG-18 files.
 * Determinism: validation is closed over S-REG-06 activity IDs, S-REG-10 sport
 * subdivision IDs, S-REG-11 existing metric IDs, S-REG-18 activity evidence,
 * S-REG-14 queue order, and the exact S-REG-19 expansion record order.
 * Failure: invalid sport metric expansion fails closed with
 * CI_S_REG_19_SPORT_METRIC_CANDIDATE_EXPANSION.
 */

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  sReg10LoadSportContextCandidateSeedFiles,
  sReg10ValidateSportContextCandidateSeeds
} from "./s_reg_10_sport_context_candidate_seeds.mjs";

import {
  sReg11LoadSportMetricCandidateSeedFile,
  sReg11ValidateSportMetricCandidateSeeds
} from "./s_reg_11_sport_metric_candidate_seeds.mjs";

import {
  sReg18LoadExerciseActivityApplicabilityCandidateExpansion,
  sReg18ValidateExerciseActivityApplicabilityCandidateExpansion
} from "./s_reg_18_exercise_activity_applicability_candidate_expansion.mjs";

import {
  S_REG_14_BUILD_QUEUE,
  sReg14LoadRegistryBuildReadinessManifest,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "./s_reg_14_registry_build_readiness_start_gate.mjs";

export const S_REG_19_SLICE_ID = "S-REG-19";
export const S_REG_19_FAILURE_TOKEN = "CI_S_REG_19_SPORT_METRIC_CANDIDATE_EXPANSION";
export const S_REG_19_RUNTIME_STATUS = "non_runtime";
export const S_REG_19_CANDIDATE_STATUS = "candidate_content_draft";
export const S_REG_19_BATCH_ID = "candidate_sport_metric_expansion_batch_1";
export const S_REG_19_REGISTRY_ID = "sport_metric_registry_1c";
export const S_REG_19_CONTENT_BATCH_STATUS = "candidate_content_expanded_inert";
export const S_REG_19_EXPANSION_STATUS = "candidate_fk_ready";
export const S_REG_19_CONTEXT_SCOPE = "candidate_expansion_only";
export const S_REG_19_METRIC_KIND = "factual_metric_definition";

export const S_REG_19_CANDIDATE_PATHS = Object.freeze({
  sport_metric_expansion_batch_1: "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
  s_reg_11_sport_metric_seed: "ci/registry/candidates/sport_metric_registry_1c/sport_metric_registry_1c.candidate.registry.json",
  s_reg_18_applicability_batch_1: "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.json",
  active_registry_index: "registries/registry_index.json",
  active_registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_19_EXPECTED_METRICS = Object.freeze([
  Object.freeze(["powerlifting__attempt_count", "powerlifting", "powerlifting__competition_lift", "Attempt count", "count", "integer"]),
  Object.freeze(["powerlifting__body_mass_kg", "powerlifting", "powerlifting__general_preparation", "Body mass", "kg", "number"]),
  Object.freeze(["general_strength__set_count", "general_strength", "general_strength__training", "Set count", "count", "integer"]),
  Object.freeze(["general_strength__duration_seconds", "general_strength", "general_strength__training", "Duration", "seconds", "number"]),
  Object.freeze(["rugby_union__jump_height_cm", "rugby_union", "rugby_union__general_preparation", "Jump height", "cm", "number"]),
  Object.freeze(["rugby_union__sprint_distance_m", "rugby_union", "rugby_union__general_preparation", "Sprint distance", "m", "number"])
]);

export const S_REG_19_EXPECTED_SPORT_METRIC_IDS = Object.freeze(
  S_REG_19_EXPECTED_METRICS.map(([sportMetricId]) => sportMetricId)
);

export const S_REG_19_REQUIRED_RECORD_FIELDS = Object.freeze([
  "sport_metric_id",
  "activity_id",
  "sport_subdivision_id",
  "display_label",
  "metric_kind",
  "unit",
  "value_type",
  "context_scope",
  "source_slice_id",
  "candidate_status",
  "runtime_status",
  "activation_ready",
  "copy_boundary_notes"
]);

const S_REG_19_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const S_REG_19_FORBIDDEN_KEYS = Object.freeze([
  "exercise_id",
  "exercise_ids",
  "exercise_token_id",
  "metric_exercise_link_id",
  "metric_exercise_link_ids",
  "threshold_id",
  "threshold_marker_id",
  "threshold_value",
  "marker_status",
  "marker_evaluator",
  "evaluator_id",
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
  error.name = "SReg19SportMetricCandidateExpansionError";
  error.code = S_REG_19_FAILURE_TOKEN;
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
  for (const key of S_REG_19_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_sport_metric_semantic_key", "Sport metric candidate expansion records must not contain exercise-link, threshold, marker, evaluator, selection, ranking, recommendation, optimisation, capability, readiness, safety, suitability, return-to-play, tactical, outcome, performance, coach interpretation, programme, or substitution fields.", {
        ...context,
        field: key
      });
    }
  }
}

function assertActiveRegistrySurface() {
  const registryIndex = readJson(S_REG_19_CANDIDATE_PATHS.active_registry_index);
  const registryBundle = readJson(S_REG_19_CANDIDATE_PATHS.active_registry_bundle);

  assertExactArray(
    registryIndex.order.slice(0, S_REG_19_ACTIVE_REGISTRY_ORDER.length),
    S_REG_19_ACTIVE_REGISTRY_ORDER,
    "active_registry_index_order_changed"
  );
  assertExactArray(
    Object.keys(registryBundle.registries ?? {}).slice(0, S_REG_19_ACTIVE_REGISTRY_ORDER.length),
    S_REG_19_ACTIVE_REGISTRY_ORDER,
    "active_registry_bundle_changed"
  );
}

function assertDocumentBoundary(document) {
  if (!isPlainRecord(document)) {
    fail("candidate_sport_metric_document_invalid", "S-REG-19 sport metric expansion document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_19_SLICE_ID,
    registry_id: S_REG_19_REGISTRY_ID,
    batch_id: S_REG_19_BATCH_ID,
    registry_target: S_REG_19_REGISTRY_ID,
    source_queue_slice_id: "S-REG-14",
    source_queue_order: 5,
    candidate_status: S_REG_19_CANDIDATE_STATUS,
    runtime_status: S_REG_19_RUNTIME_STATUS,
    content_batch_status: S_REG_19_CONTENT_BATCH_STATUS,
    sport_metric_expansion_status: S_REG_19_EXPANSION_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    metric_exercise_link_mutation: false,
    marker_evaluator_mutation: false,
    threshold_marker_mutation: false,
    programme_assignment_mutation: false,
    substitution_runtime_mutation: false,
    record_count: S_REG_19_EXPECTED_METRICS.length
  })) {
    if (document[field] !== expected) {
      fail("candidate_sport_metric_document_boundary_field_invalid", "S-REG-19 sport metric expansion document boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  assertExactArray(document.dependency_inputs, ["S-REG-10", "S-REG-11", "S-REG-18"], "dependency_inputs_invalid");
  assertExactArray(document.foundation_inputs, ["S-REG-06"], "foundation_inputs_invalid");

  if (!Array.isArray(document.records)) {
    fail("candidate_sport_metric_records_invalid", "S-REG-19 records must be an array.");
  }

  assertExactArray(
    document.records.map((record) => record.sport_metric_id),
    S_REG_19_EXPECTED_SPORT_METRIC_IDS,
    "candidate_sport_metric_record_order_invalid"
  );
}

function assertQueueBoundary() {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();
  const queueItem = manifest.candidate_build_queue.find((entry) => entry.slice_id === S_REG_19_SLICE_ID);
  const constantQueueItem = S_REG_14_BUILD_QUEUE.find((entry) => entry.slice_id === S_REG_19_SLICE_ID);

  if (!queueItem || !constantQueueItem) {
    fail("s_reg_19_queue_item_missing", "S-REG-14 must declare S-REG-19 in the build queue.");
  }

  for (const [field, expected] of Object.entries({
    order: 5,
    slice_id: S_REG_19_SLICE_ID,
    batch_id: S_REG_19_BATCH_ID,
    registry_target: S_REG_19_REGISTRY_ID,
    proof_command: "npm.cmd run proof:s-reg-19",
    content_status_after_slice: S_REG_19_CONTENT_BATCH_STATUS
  })) {
    if (queueItem[field] !== expected) {
      fail("s_reg_19_queue_item_invalid", "S-REG-14 queue item field mismatch.", {
        field,
        expected,
        actual: queueItem[field]
      });
    }

    if (constantQueueItem[field] !== expected) {
      fail("s_reg_19_constant_queue_item_invalid", "S-REG-14 exported queue item field mismatch.", {
        field,
        expected,
        actual: constantQueueItem[field]
      });
    }
  }

  assertExactArray(queueItem.dependency_inputs, ["S-REG-10", "S-REG-11", "S-REG-18"], "s_reg_19_queue_dependencies_invalid");
}

function assertSReg06Dependency(upstream) {
  const result = sReg06ValidateCandidateSeedSurface(upstream);

  if (!result.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate seed surface did not validate.", { result });
  }
}

function assertSReg10Dependency(sportContextSurface, upstreamSurface) {
  const result = sReg10ValidateSportContextCandidateSeeds({
    sportContextSurface,
    upstreamSurface
  });

  if (!result.ok) {
    fail("s_reg_10_dependency_invalid", "S-REG-10 sport context candidate surface did not validate.", { result });
  }
}

function assertSReg11Dependency(sReg11Document, upstreamSurface, sportContextSurface) {
  const result = sReg11ValidateSportMetricCandidateSeeds({
    sportMetricDocument: sReg11Document,
    upstreamSurface,
    sportContextSurface
  });

  if (!result.ok || result.registry_id !== S_REG_19_REGISTRY_ID) {
    fail("s_reg_11_dependency_invalid", "S-REG-11 sport metric candidate seed dependency did not validate.", { result });
  }
}

function assertSReg18Dependency(sReg18Document) {
  const result = sReg18ValidateExerciseActivityApplicabilityCandidateExpansion({
    document: sReg18Document
  });

  if (!result.ok) {
    fail("s_reg_18_dependency_invalid", "S-REG-18 candidate applicability expansion did not validate.", { result });
  }
}

function assertRecordBoundary(record, expected, context) {
  if (!isPlainRecord(record)) {
    fail("candidate_sport_metric_record_invalid", "Sport metric candidate expansion record must be a plain object.", context);
  }

  for (const field of S_REG_19_REQUIRED_RECORD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      fail("candidate_sport_metric_required_field_missing", "Sport metric expansion record required field missing.", {
        ...context,
        field
      });
    }
  }

  assertNoForbiddenKeys(record, context);

  requireString(record.sport_metric_id, "sport_metric_id", context);
  requireString(record.activity_id, "activity_id", context);
  requireString(record.sport_subdivision_id, "sport_subdivision_id", context);
  requireString(record.display_label, "display_label", context);
  requireString(record.metric_kind, "metric_kind", context);
  requireString(record.unit, "unit", context);
  requireString(record.value_type, "value_type", context);
  requireString(record.context_scope, "context_scope", context);
  requireString(record.source_slice_id, "source_slice_id", context);
  requireString(record.candidate_status, "candidate_status", context);
  requireString(record.runtime_status, "runtime_status", context);
  requireBoolean(record.activation_ready, "activation_ready", context);
  requireString(record.copy_boundary_notes, "copy_boundary_notes", context);

  const [
    expectedSportMetricId,
    expectedActivityId,
    expectedSubdivisionId,
    expectedLabel,
    expectedUnit,
    expectedValueType
  ] = expected;

  for (const [field, expectedValue] of Object.entries({
    sport_metric_id: expectedSportMetricId,
    activity_id: expectedActivityId,
    sport_subdivision_id: expectedSubdivisionId,
    display_label: expectedLabel,
    metric_kind: S_REG_19_METRIC_KIND,
    unit: expectedUnit,
    value_type: expectedValueType,
    context_scope: S_REG_19_CONTEXT_SCOPE,
    source_slice_id: S_REG_19_SLICE_ID,
    candidate_status: S_REG_19_CANDIDATE_STATUS,
    runtime_status: S_REG_19_RUNTIME_STATUS,
    activation_ready: false,
    copy_boundary_notes: "factual sport metric definition only"
  })) {
    if (record[field] !== expectedValue) {
      fail("candidate_sport_metric_record_field_invalid", "S-REG-19 sport metric record field mismatch.", {
        ...context,
        field,
        expected: expectedValue,
        actual: record[field]
      });
    }
  }
}

function assertMetricRelationship(record, activityIds, subdivisionById, existingMetricIds, sReg18ActivityIds, context) {
  if (existingMetricIds.has(record.sport_metric_id)) {
    fail("sport_metric_duplicates_s_reg_11_seed", "S-REG-19 must not duplicate an existing S-REG-11 sport metric id.", context);
  }

  if (!activityIds.has(record.activity_id)) {
    fail("activity_fk_unknown", "Sport metric candidate expansion references an unknown activity candidate id.", context);
  }

  if (!sReg18ActivityIds.has(record.activity_id)) {
    fail("s_reg_18_activity_evidence_missing", "Sport metric candidate expansion references an activity without S-REG-18 applicability evidence.", context);
  }

  const subdivision = subdivisionById.get(record.sport_subdivision_id);

  if (!subdivision) {
    fail("subdivision_fk_unknown", "Sport metric candidate expansion references an unknown sport subdivision candidate id.", context);
  }

  if (subdivision.activity_id !== record.activity_id) {
    fail("metric_subdivision_activity_mismatch", "Sport metric activity_id must match the referenced subdivision activity_id.", {
      ...context,
      subdivision_activity_id: subdivision.activity_id
    });
  }
}

export function sReg19CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_19_CANDIDATE_PATHS));
}

export function sReg19LoadSportMetricCandidateExpansion() {
  return deepFreeze(readJson(S_REG_19_CANDIDATE_PATHS.sport_metric_expansion_batch_1));
}

export function sReg19ValidateSportMetricCandidateExpansion({
  document,
  upstreamSurface,
  sportContextSurface,
  sReg11Document,
  sReg18Document
} = {}) {
  assertActiveRegistrySurface();
  sReg14ValidateRegistryBuildReadinessStartGate();
  assertQueueBoundary();

  const loadedUpstreamSurface = upstreamSurface ?? sReg06LoadCandidateSeedFiles();
  const loadedSportContextSurface = sportContextSurface ?? sReg10LoadSportContextCandidateSeedFiles();
  const loadedSReg11Document = sReg11Document ?? sReg11LoadSportMetricCandidateSeedFile();
  const loadedSReg18Document = sReg18Document ?? sReg18LoadExerciseActivityApplicabilityCandidateExpansion();
  const loadedDocument = document ?? sReg19LoadSportMetricCandidateExpansion();

  assertDocumentBoundary(loadedDocument);
  requireUnique(loadedDocument.records, "sport_metric_id", S_REG_19_REGISTRY_ID);

  assertSReg06Dependency(loadedUpstreamSurface);
  assertSReg10Dependency(loadedSportContextSurface, loadedUpstreamSurface);
  assertSReg11Dependency(loadedSReg11Document, loadedUpstreamSurface, loadedSportContextSurface);
  assertSReg18Dependency(loadedSReg18Document);

  const activityIds = new Set(loadedUpstreamSurface.activity_registry_1.records.map((record) => record.activity_id));
  const subdivisionById = new Map(loadedSportContextSurface.sport_subdivision_registry_1a.records.map((record) => [record.sport_subdivision_id, record]));
  const existingMetricIds = new Set(loadedSReg11Document.records.map((record) => record.sport_metric_id));
  const sReg18ActivityIds = new Set(loadedSReg18Document.records.map((record) => record.activity_id));

  for (let index = 0; index < S_REG_19_EXPECTED_METRICS.length; index += 1) {
    const record = loadedDocument.records[index];
    const expected = S_REG_19_EXPECTED_METRICS[index];

    const context = {
      sport_metric_id: record?.sport_metric_id ?? null,
      activity_id: record?.activity_id ?? null,
      sport_subdivision_id: record?.sport_subdivision_id ?? null,
      batch_id: S_REG_19_BATCH_ID
    };

    assertRecordBoundary(record, expected, context);
    assertMetricRelationship(record, activityIds, subdivisionById, existingMetricIds, sReg18ActivityIds, context);
  }

  return deepFreeze({
    ok: true,
    token: S_REG_19_FAILURE_TOKEN,
    slice_id: S_REG_19_SLICE_ID,
    batch_id: S_REG_19_BATCH_ID,
    registry_id: S_REG_19_REGISTRY_ID,
    record_count: loadedDocument.records.length,
    sport_metric_ids: loadedDocument.records.map((record) => record.sport_metric_id),
    activity_ids: [...new Set(loadedDocument.records.map((record) => record.activity_id))],
    sport_subdivision_ids: [...new Set(loadedDocument.records.map((record) => record.sport_subdivision_id))],
    dependency_inputs: loadedDocument.dependency_inputs,
    foundation_inputs: loadedDocument.foundation_inputs,
    sport_metric_expansion_status: S_REG_19_EXPANSION_STATUS,
    metric_kind: S_REG_19_METRIC_KIND,
    context_scope: S_REG_19_CONTEXT_SCOPE,
    activation_ready: false,
    runtime_status: S_REG_19_RUNTIME_STATUS,
    candidate_status: S_REG_19_CANDIDATE_STATUS,
    content_batch_status: S_REG_19_CONTENT_BATCH_STATUS
  });
}