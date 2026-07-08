/**
 * DEV NOTE: S-REG-21 threshold marker candidate records.
 * Purpose: validates the first inert threshold_marker_registry candidate record
 * batch after S-REG-13, S-REG-19, and S-REG-20 have strengthened the metric
 * and metric-exercise-link foundations.
 * Boundary: records explicit declared threshold markers only. This module must
 * not evaluate recorded values, emit comparison results, create advice, infer
 * outcomes, alter Phase 1 runtime schema, mutate active registry law, or alter
 * deterministic engine output.
 * Determinism: validation is closed over S-REG-13 allowed fields and closed
 * vocabularies, S-REG-19 sport metric candidates, S-REG-20 metric-exercise
 * link candidates, and S-REG-14 queue order.
 * Failure: throws CI_S_REG_21_THRESHOLD_MARKER_CANDIDATE_RECORDS.
 */

import fs from "node:fs";

import {
  S_REG_13_ALLOWED_FIELDS,
  S_REG_13_ALLOWED_MARKER_STATUS_VALUES,
  S_REG_13_ALLOWED_THRESHOLD_OPERATORS,
  S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES,
  S_REG_13_FORBIDDEN_FIELDS,
  S_REG_13_REGISTRY_ID,
  S_REG_13_RUNTIME_STATUS,
  sReg13LoadThresholdMarkerCandidateBoundaryContractFile,
  sReg13ValidateThresholdMarkerCandidateBoundaryContract
} from "./s_reg_13_threshold_marker_candidate_boundary_contract.mjs";

import {
  sReg14LoadRegistryBuildReadinessManifest,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "./s_reg_14_registry_build_readiness_start_gate.mjs";

import {
  sReg19LoadSportMetricCandidateExpansion,
  sReg19ValidateSportMetricCandidateExpansion
} from "./s_reg_19_sport_metric_candidate_expansion.mjs";

import {
  sReg20LoadMetricExerciseLinkCandidateExpansion,
  sReg20ValidateMetricExerciseLinkCandidateExpansion
} from "./s_reg_20_metric_exercise_link_candidate_expansion.mjs";

export const S_REG_21_SLICE_ID = "S-REG-21";
export const S_REG_21_FAILURE_TOKEN = "CI_S_REG_21_THRESHOLD_MARKER_CANDIDATE_RECORDS";
export const S_REG_21_RUNTIME_STATUS = "non_runtime";
export const S_REG_21_CANDIDATE_STATUS = "candidate_content_draft";
export const S_REG_21_BATCH_ID = "candidate_threshold_marker_records_batch_1";
export const S_REG_21_REGISTRY_ID = S_REG_13_REGISTRY_ID;
export const S_REG_21_CONTENT_BATCH_STATUS = "candidate_content_expanded_inert";
export const S_REG_21_RECORD_STATUS = "candidate_threshold_marker_records_created_inert";

export const S_REG_21_CANDIDATE_PATHS = Object.freeze({
  threshold_marker_candidate_records_batch_1: "ci/registry/s_reg_21_threshold_marker_candidate_records.json",
  s_reg_13_threshold_marker_contract: "ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract_manifest.json",
  s_reg_19_sport_metric_expansion: "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
  s_reg_20_metric_exercise_link_expansion: "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json",
  active_registry_index: "registries/registry_index.json",
  active_registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_21_ALLOWED_THRESHOLD_SOURCE_VALUES = Object.freeze([
  "coach_declared"
]);

export const S_REG_21_EXPECTED_THRESHOLD_MARKER_IDS = Object.freeze([
  "threshold_marker__powerlifting__attempt_count__gte_1",
  "threshold_marker__powerlifting__attempt_count__lte_3",
  "threshold_marker__general_strength__set_count__gte_1",
  "threshold_marker__general_strength__duration_seconds__gte_60",
  "threshold_marker__general_strength__duration_seconds__lte_3600"
]);

export const S_REG_21_EXPECTED_DOCUMENT_KEYS = Object.freeze([
  "slice_id",
  "registry_id",
  "batch_id",
  "registry_target",
  "source_queue_slice_id",
  "source_queue_order",
  "dependency_inputs",
  "foundation_inputs",
  "candidate_status",
  "runtime_status",
  "content_batch_status",
  "threshold_marker_candidate_record_status",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "engine_runtime_mutation",
  "phase1_runtime_schema_mutation",
  "high_volume_content_added",
  "activation_ready",
  "complete_registry_claim",
  "marker_evaluator_mutation",
  "comparison_result_mutation",
  "recorded_value_input_mutation",
  "advice_mutation",
  "outcome_inference_mutation",
  "programme_assignment_mutation",
  "substitution_runtime_mutation",
  "ui_behaviour_mutation",
  "coach_interpretation_mutation",
  "record_count",
  "records"
]);

export const S_REG_21_REQUIRED_FALSE_FLAGS = Object.freeze([
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "engine_runtime_mutation",
  "phase1_runtime_schema_mutation",
  "high_volume_content_added",
  "activation_ready",
  "complete_registry_claim",
  "marker_evaluator_mutation",
  "comparison_result_mutation",
  "recorded_value_input_mutation",
  "advice_mutation",
  "outcome_inference_mutation",
  "programme_assignment_mutation",
  "substitution_runtime_mutation",
  "ui_behaviour_mutation",
  "coach_interpretation_mutation"
]);

export const S_REG_21_FORBIDDEN_RECORD_KEYS = Object.freeze([
  ...S_REG_13_FORBIDDEN_FIELDS,
  "recorded_value",
  "comparison_result",
  "marker_status",
  "marker_evaluator",
  "evaluator_id",
  "evaluator_result",
  "automatic_decision",
  "programme_change",
  "substitution_change",
  "coach_action",
  "athlete_instruction",
  "readiness",
  "safety",
  "suitability",
  "capability",
  "tactical",
  "recommendation",
  "optimisation",
  "ranking",
  "outcome"
]);

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = S_REG_21_FAILURE_TOKEN;
  error.reason = reason;
  error.details = details;
  throw error;
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assertPlainObject(value, reason) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(reason, { actual: value });
  }
}

function assertExactKeys(object, expectedKeys, reason) {
  const actual = Object.keys(object).sort();
  const expected = [...expectedKeys].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(reason, { actual, expected });
  }
}

function assertExactArray(actual, expected, reason) {
  if (!Array.isArray(actual)) {
    fail(reason, { actual });
  }

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(reason, { actual, expected });
  }
}

function assertNoForbiddenRecordKeys(record) {
  for (const key of Object.keys(record)) {
    if (S_REG_21_FORBIDDEN_RECORD_KEYS.includes(key)) {
      fail("threshold_marker_candidate_record_forbidden_key", { key });
    }
  }
}

function buildSportMetricMap(sportMetricDocument) {
  return new Map(sportMetricDocument.records.map((record) => [record.sport_metric_id, record]));
}

function buildLinkedMetricIdSet(metricExerciseLinkDocument) {
  return new Set(metricExerciseLinkDocument.records.map((record) => record.sport_metric_id));
}

function assertThresholdMarkerRecord(record, context) {
  assertPlainObject(record, "threshold_marker_candidate_record_invalid");
  assertExactKeys(record, S_REG_13_ALLOWED_FIELDS, "threshold_marker_candidate_record_field_set_invalid");
  assertNoForbiddenRecordKeys(record);

  if (typeof record.threshold_marker_id !== "string" || !S_REG_21_EXPECTED_THRESHOLD_MARKER_IDS.includes(record.threshold_marker_id)) {
    fail("threshold_marker_candidate_record_id_invalid", { threshold_marker_id: record.threshold_marker_id });
  }

  if (typeof record.sport_metric_id !== "string" || record.sport_metric_id.length === 0) {
    fail("threshold_marker_candidate_record_sport_metric_invalid", { record });
  }

  if (typeof record.activity_id !== "string" || record.activity_id.length === 0) {
    fail("threshold_marker_candidate_record_activity_invalid", { record });
  }

  if (!S_REG_13_ALLOWED_THRESHOLD_OPERATORS.includes(record.threshold_operator)) {
    fail("threshold_marker_candidate_record_operator_invalid", { threshold_operator: record.threshold_operator });
  }

  if (typeof record.threshold_value !== "number" || !Number.isFinite(record.threshold_value)) {
    fail("threshold_marker_candidate_record_value_invalid", { threshold_value: record.threshold_value });
  }

  if (typeof record.threshold_unit !== "string" || record.threshold_unit.length === 0) {
    fail("threshold_marker_candidate_record_unit_invalid", { threshold_unit: record.threshold_unit });
  }

  if (!S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES.includes(record.threshold_source)) {
    fail("threshold_marker_candidate_record_source_not_in_s_reg_13_contract", { threshold_source: record.threshold_source });
  }

  if (!S_REG_21_ALLOWED_THRESHOLD_SOURCE_VALUES.includes(record.threshold_source)) {
    fail("threshold_marker_candidate_record_source_outside_s_reg_21_scope", { threshold_source: record.threshold_source });
  }

  assertExactArray(
    record.marker_status_allowed_values,
    S_REG_13_ALLOWED_MARKER_STATUS_VALUES,
    "threshold_marker_candidate_record_marker_status_values_invalid"
  );

  if (record.source_slice_id !== S_REG_21_SLICE_ID) {
    fail("threshold_marker_candidate_record_source_slice_invalid", { source_slice_id: record.source_slice_id });
  }

  if (record.candidate_status !== S_REG_21_CANDIDATE_STATUS) {
    fail("threshold_marker_candidate_record_candidate_status_invalid", { candidate_status: record.candidate_status });
  }

  if (record.runtime_status !== S_REG_21_RUNTIME_STATUS) {
    fail("threshold_marker_candidate_record_runtime_status_invalid", { runtime_status: record.runtime_status });
  }

  if (record.activation_ready !== false) {
    fail("threshold_marker_candidate_record_activation_ready_invalid", { activation_ready: record.activation_ready });
  }

  if (typeof record.copy_boundary_notes !== "string" || record.copy_boundary_notes.length === 0) {
    fail("threshold_marker_candidate_record_copy_boundary_notes_invalid", { record });
  }

  const sportMetric = context.sportMetricById.get(record.sport_metric_id);
  if (!sportMetric) {
    fail("threshold_marker_candidate_record_sport_metric_fk_missing", { sport_metric_id: record.sport_metric_id });
  }

  if (!context.linkedSportMetricIds.has(record.sport_metric_id)) {
    fail("threshold_marker_candidate_record_metric_exercise_link_missing", { sport_metric_id: record.sport_metric_id });
  }

  if (sportMetric.activity_id !== record.activity_id) {
    fail("threshold_marker_candidate_record_activity_mismatch", {
      threshold_marker_id: record.threshold_marker_id,
      metric_activity_id: sportMetric.activity_id,
      marker_activity_id: record.activity_id
    });
  }

  if (sportMetric.unit !== record.threshold_unit) {
    fail("threshold_marker_candidate_record_unit_mismatch", {
      threshold_marker_id: record.threshold_marker_id,
      metric_unit: sportMetric.unit,
      marker_unit: record.threshold_unit
    });
  }
}

function assertDocumentFlags(document) {
  for (const flag of S_REG_21_REQUIRED_FALSE_FLAGS) {
    if (document[flag] !== false) {
      fail("threshold_marker_candidate_document_false_flag_invalid", { flag, actual: document[flag] });
    }
  }
}

function assertQueueAlignment() {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();
  sReg14ValidateRegistryBuildReadinessStartGate(manifest);

  const queueEntry = manifest.candidate_build_queue.find((entry) => entry.slice_id === S_REG_21_SLICE_ID);
  if (!queueEntry) {
    fail("threshold_marker_candidate_s_reg_14_queue_entry_missing");
  }

  if (queueEntry.order !== 7) {
    fail("threshold_marker_candidate_s_reg_14_queue_order_invalid", { order: queueEntry.order });
  }

  if (queueEntry.batch_id !== S_REG_21_BATCH_ID) {
    fail("threshold_marker_candidate_s_reg_14_batch_id_invalid", { batch_id: queueEntry.batch_id });
  }

  if (queueEntry.registry_target !== S_REG_21_REGISTRY_ID) {
    fail("threshold_marker_candidate_s_reg_14_registry_target_invalid", { registry_target: queueEntry.registry_target });
  }

  assertExactArray(
    queueEntry.dependency_inputs,
    ["S-REG-13", "S-REG-19", "S-REG-20"],
    "threshold_marker_candidate_s_reg_14_dependency_inputs_invalid"
  );

  if (queueEntry.proof_command !== "npm.cmd run proof:s-reg-21") {
    fail("threshold_marker_candidate_s_reg_14_proof_command_invalid", { proof_command: queueEntry.proof_command });
  }
}

export function sReg21LoadThresholdMarkerCandidateRecords() {
  return readJson(S_REG_21_CANDIDATE_PATHS.threshold_marker_candidate_records_batch_1);
}

export function sReg21BuildThresholdMarkerCandidateRecordMap(records) {
  return new Map(records.map((record) => [record.threshold_marker_id, record]));
}

export function sReg21ValidateThresholdMarkerCandidateRecords({
  thresholdMarkerDocument = sReg21LoadThresholdMarkerCandidateRecords(),
  thresholdMarkerContractDocument = sReg13LoadThresholdMarkerCandidateBoundaryContractFile(),
  sportMetricDocument = sReg19LoadSportMetricCandidateExpansion(),
  metricExerciseLinkDocument = sReg20LoadMetricExerciseLinkCandidateExpansion()
} = {}) {
  assertPlainObject(thresholdMarkerDocument, "threshold_marker_candidate_document_invalid");
  assertExactKeys(thresholdMarkerDocument, S_REG_21_EXPECTED_DOCUMENT_KEYS, "threshold_marker_candidate_document_field_set_invalid");

  sReg19ValidateSportMetricCandidateExpansion({ sportMetricDocument });
  sReg20ValidateMetricExerciseLinkCandidateExpansion({ metricExerciseLinkDocument });
  sReg13ValidateThresholdMarkerCandidateBoundaryContract({
    contractDocument: thresholdMarkerContractDocument,
    sportMetricDocument,
    metricExerciseLinkDocument
  });
  assertQueueAlignment();

  if (thresholdMarkerDocument.slice_id !== S_REG_21_SLICE_ID) {
    fail("threshold_marker_candidate_document_slice_id_invalid", { slice_id: thresholdMarkerDocument.slice_id });
  }

  if (thresholdMarkerDocument.registry_id !== S_REG_21_REGISTRY_ID || thresholdMarkerDocument.registry_target !== S_REG_21_REGISTRY_ID) {
    fail("threshold_marker_candidate_document_registry_id_invalid", {
      registry_id: thresholdMarkerDocument.registry_id,
      registry_target: thresholdMarkerDocument.registry_target
    });
  }

  if (thresholdMarkerDocument.batch_id !== S_REG_21_BATCH_ID) {
    fail("threshold_marker_candidate_document_batch_id_invalid", { batch_id: thresholdMarkerDocument.batch_id });
  }

  if (thresholdMarkerDocument.source_queue_slice_id !== "S-REG-14" || thresholdMarkerDocument.source_queue_order !== 7) {
    fail("threshold_marker_candidate_document_queue_reference_invalid", {
      source_queue_slice_id: thresholdMarkerDocument.source_queue_slice_id,
      source_queue_order: thresholdMarkerDocument.source_queue_order
    });
  }

  assertExactArray(
    thresholdMarkerDocument.dependency_inputs,
    ["S-REG-13", "S-REG-19", "S-REG-20"],
    "threshold_marker_candidate_document_dependency_inputs_invalid"
  );

  assertExactArray(
    thresholdMarkerDocument.foundation_inputs,
    ["S-REG-14"],
    "threshold_marker_candidate_document_foundation_inputs_invalid"
  );

  if (thresholdMarkerDocument.candidate_status !== S_REG_21_CANDIDATE_STATUS) {
    fail("threshold_marker_candidate_document_candidate_status_invalid", { candidate_status: thresholdMarkerDocument.candidate_status });
  }

  if (thresholdMarkerDocument.runtime_status !== S_REG_21_RUNTIME_STATUS) {
    fail("threshold_marker_candidate_document_runtime_status_invalid", { runtime_status: thresholdMarkerDocument.runtime_status });
  }

  if (thresholdMarkerDocument.content_batch_status !== S_REG_21_CONTENT_BATCH_STATUS) {
    fail("threshold_marker_candidate_document_content_batch_status_invalid", {
      content_batch_status: thresholdMarkerDocument.content_batch_status
    });
  }

  if (thresholdMarkerDocument.threshold_marker_candidate_record_status !== S_REG_21_RECORD_STATUS) {
    fail("threshold_marker_candidate_document_record_status_invalid", {
      threshold_marker_candidate_record_status: thresholdMarkerDocument.threshold_marker_candidate_record_status
    });
  }

  assertDocumentFlags(thresholdMarkerDocument);

  if (!Array.isArray(thresholdMarkerDocument.records)) {
    fail("threshold_marker_candidate_document_records_invalid");
  }

  if (thresholdMarkerDocument.record_count !== thresholdMarkerDocument.records.length) {
    fail("threshold_marker_candidate_document_record_count_invalid", {
      record_count: thresholdMarkerDocument.record_count,
      actual: thresholdMarkerDocument.records.length
    });
  }

  assertExactArray(
    thresholdMarkerDocument.records.map((record) => record.threshold_marker_id),
    S_REG_21_EXPECTED_THRESHOLD_MARKER_IDS,
    "threshold_marker_candidate_record_order_invalid"
  );

  const recordIds = new Set();
  const metricOperatorValueUnit = new Set();
  const context = {
    sportMetricById: buildSportMetricMap(sportMetricDocument),
    linkedSportMetricIds: buildLinkedMetricIdSet(metricExerciseLinkDocument)
  };

  for (const record of thresholdMarkerDocument.records) {
    assertThresholdMarkerRecord(record, context);

    if (recordIds.has(record.threshold_marker_id)) {
      fail("threshold_marker_candidate_record_duplicate_id", { threshold_marker_id: record.threshold_marker_id });
    }

    recordIds.add(record.threshold_marker_id);

    const uniquenessKey = [
      record.sport_metric_id,
      record.threshold_operator,
      record.threshold_value,
      record.threshold_unit
    ].join("__");

    if (metricOperatorValueUnit.has(uniquenessKey)) {
      fail("threshold_marker_candidate_record_duplicate_threshold", { uniquenessKey });
    }

    metricOperatorValueUnit.add(uniquenessKey);
  }

  return Object.freeze({
    ok: true,
    token: S_REG_21_FAILURE_TOKEN,
    slice_id: S_REG_21_SLICE_ID,
    registry_id: S_REG_21_REGISTRY_ID,
    batch_id: S_REG_21_BATCH_ID,
    record_count: thresholdMarkerDocument.records.length,
    threshold_marker_ids: thresholdMarkerDocument.records.map((record) => record.threshold_marker_id),
    dependency_inputs: [...thresholdMarkerDocument.dependency_inputs],
    foundation_inputs: [...thresholdMarkerDocument.foundation_inputs],
    threshold_source_values: [...S_REG_21_ALLOWED_THRESHOLD_SOURCE_VALUES],
    marker_status_allowed_values: [...S_REG_13_ALLOWED_MARKER_STATUS_VALUES],
    activation_ready: false,
    runtime_status: S_REG_21_RUNTIME_STATUS
  });
}