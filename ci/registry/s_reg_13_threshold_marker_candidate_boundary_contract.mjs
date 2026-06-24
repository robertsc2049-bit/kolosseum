import fs from "node:fs";
import path from "node:path";

/**
 * DEV NOTE: S-REG-13 threshold marker candidate boundary contract.
 * Purpose: defines the future threshold_marker_registry candidate boundary
 * without creating seed content, evaluator behaviour, active registry law, or
 * engine runtime behaviour.
 * Boundary: this module validates an inert contract only. It may read S-REG-11
 * and S-REG-12 candidate shapes as future dependency expectations, but it must
 * not activate threshold markers, compare values, emit marker results, or alter
 * compile, substitution, session execution, history, or coach/athlete surfaces.
 * Determinism: all allowed fields, operator values, source values, and factual
 * marker status values are fixed closed sets.
 * Failure: throws CI_S_REG_13_THRESHOLD_MARKER_CANDIDATE_BOUNDARY_CONTRACT.
 */

import {
  sReg11LoadSportMetricCandidateSeedFile
} from "./s_reg_11_sport_metric_candidate_seeds.mjs";

import {
  sReg12LoadMetricExerciseLinkCandidateSeedFile
} from "./s_reg_12_metric_exercise_link_candidate_seeds.mjs";

export const S_REG_13_FAILURE_TOKEN = "CI_S_REG_13_THRESHOLD_MARKER_CANDIDATE_BOUNDARY_CONTRACT";
export const S_REG_13_REGISTRY_ID = "threshold_marker_registry";
export const S_REG_13_RUNTIME_STATUS = "non_runtime";
export const S_REG_13_CONTRACT_STATUS = "candidate_boundary_contract";
export const S_REG_13_CANDIDATE_STATUS = "contract_only_no_seed_content";

export const S_REG_13_ALLOWED_FIELDS = Object.freeze([
  "threshold_marker_id",
  "sport_metric_id",
  "activity_id",
  "threshold_operator",
  "threshold_value",
  "threshold_unit",
  "threshold_source",
  "marker_status_allowed_values",
  "source_slice_id",
  "candidate_status",
  "runtime_status",
  "activation_ready",
  "copy_boundary_notes"
]);

export const S_REG_13_ALLOWED_THRESHOLD_OPERATORS = Object.freeze([
  "greater_than_or_equal",
  "less_than_or_equal",
  "equal_to"
]);

export const S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES = Object.freeze([
  "coach_declared",
  "organisation_declared_later",
  "fixture_declared"
]);

export const S_REG_13_ALLOWED_MARKER_STATUS_VALUES = Object.freeze([
  "recorded_met",
  "recorded_not_met",
  "not_recorded",
  "invalid_source",
  "insufficient_recorded_data"
]);

export const S_REG_13_FORBIDDEN_FIELDS = Object.freeze([
  "readiness_score",
  "readiness_status",
  "safety_status",
  "risk_status",
  "capability_score",
  "suitability_status",
  "return_to_play_status",
  "tactical_status",
  "recommendation",
  "ranking",
  "optimisation",
  "intervention",
  "programme_change",
  "substitution_change",
  "evaluator_result",
  "automatic_decision"
]);

const manifestPath = "ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract_manifest.json";

const requiredContractKeys = Object.freeze([
  "slice_id",
  "registry_id",
  "contract_status",
  "candidate_status",
  "runtime_status",
  "activation_ready",
  "seed_content_status",
  "active_registry_exclusion",
  "allowed_fields",
  "allowed_threshold_operators",
  "allowed_threshold_source_values",
  "allowed_marker_status_values",
  "forbidden_fields",
  "future_dependencies",
  "future_fk_expectations",
  "evaluator_exclusion",
  "active_registry_exclusion_notes",
  "copy_boundary_notes"
]);

function fail(reason, details = {}) {
  const error = new Error(reason);
  error.code = S_REG_13_FAILURE_TOKEN;
  error.reason = reason;
  error.details = details;
  throw error;
}

function repoPath(relativePath) {
  return path.join(process.cwd(), relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(repoPath(relativePath), "utf8"));
}

function assertPlainObject(value, reason, details = {}) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(reason, details);
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

function assertNoForbiddenKeys(object, reason) {
  for (const key of Object.keys(object)) {
    if (S_REG_13_FORBIDDEN_FIELDS.includes(key)) {
      fail(reason, { key });
    }
  }
}

export function sReg13ContractPaths() {
  return Object.freeze({
    threshold_marker_registry: manifestPath
  });
}

export function sReg13LoadThresholdMarkerCandidateBoundaryContractFile() {
  return readJson(manifestPath);
}

export function sReg13BuildValidFutureThresholdMarkerCandidateRecord() {
  return {
    threshold_marker_id: "threshold_marker__fixture_declared__example",
    sport_metric_id: "powerlifting__back_squat_1rm_kg",
    activity_id: "powerlifting",
    threshold_operator: "greater_than_or_equal",
    threshold_value: 100,
    threshold_unit: "kg",
    threshold_source: "fixture_declared",
    marker_status_allowed_values: [...S_REG_13_ALLOWED_MARKER_STATUS_VALUES],
    source_slice_id: "S-REG-13",
    candidate_status: S_REG_13_CANDIDATE_STATUS,
    runtime_status: S_REG_13_RUNTIME_STATUS,
    activation_ready: false,
    copy_boundary_notes: "Future records may compare recorded metric values against explicit declared thresholds only."
  };
}

export function sReg13ValidateFutureThresholdMarkerCandidateRecord(record) {
  assertPlainObject(record, "future_threshold_marker_record_invalid");
  assertExactKeys(record, S_REG_13_ALLOWED_FIELDS, "future_threshold_marker_record_field_set_invalid");
  assertNoForbiddenKeys(record, "forbidden_threshold_marker_semantic_key");

  if (typeof record.threshold_marker_id !== "string" || record.threshold_marker_id.length === 0) {
    fail("future_threshold_marker_record_field_invalid", { field: "threshold_marker_id" });
  }

  if (typeof record.sport_metric_id !== "string" || record.sport_metric_id.length === 0) {
    fail("future_threshold_marker_record_field_invalid", { field: "sport_metric_id" });
  }

  if (typeof record.activity_id !== "string" || record.activity_id.length === 0) {
    fail("future_threshold_marker_record_field_invalid", { field: "activity_id" });
  }

  if (!S_REG_13_ALLOWED_THRESHOLD_OPERATORS.includes(record.threshold_operator)) {
    fail("future_threshold_marker_record_field_invalid", { field: "threshold_operator" });
  }

  if (typeof record.threshold_value !== "number" || !Number.isFinite(record.threshold_value)) {
    fail("future_threshold_marker_record_field_invalid", { field: "threshold_value" });
  }

  if (typeof record.threshold_unit !== "string" || record.threshold_unit.length === 0) {
    fail("future_threshold_marker_record_field_invalid", { field: "threshold_unit" });
  }

  if (!S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES.includes(record.threshold_source)) {
    fail("future_threshold_marker_record_field_invalid", { field: "threshold_source" });
  }

  assertExactArray(
    record.marker_status_allowed_values,
    S_REG_13_ALLOWED_MARKER_STATUS_VALUES,
    "future_threshold_marker_status_values_invalid"
  );

  if (record.source_slice_id !== "S-REG-13") {
    fail("future_threshold_marker_record_field_invalid", { field: "source_slice_id" });
  }

  if (record.candidate_status !== S_REG_13_CANDIDATE_STATUS) {
    fail("future_threshold_marker_record_field_invalid", { field: "candidate_status" });
  }

  if (record.runtime_status !== S_REG_13_RUNTIME_STATUS) {
    fail("future_threshold_marker_record_field_invalid", { field: "runtime_status" });
  }

  if (record.activation_ready !== false) {
    fail("future_threshold_marker_record_field_invalid", { field: "activation_ready" });
  }

  if (typeof record.copy_boundary_notes !== "string" || record.copy_boundary_notes.length === 0) {
    fail("future_threshold_marker_record_field_invalid", { field: "copy_boundary_notes" });
  }

  return Object.freeze({
    ok: true,
    registry_id: S_REG_13_REGISTRY_ID,
    runtime_status: S_REG_13_RUNTIME_STATUS,
    activation_ready: false
  });
}

export function sReg13ValidateThresholdMarkerCandidateBoundaryContract({
  contractDocument = sReg13LoadThresholdMarkerCandidateBoundaryContractFile(),
  sportMetricDocument = sReg11LoadSportMetricCandidateSeedFile(),
  metricExerciseLinkDocument = sReg12LoadMetricExerciseLinkCandidateSeedFile()
} = {}) {
  assertPlainObject(contractDocument, "threshold_marker_contract_invalid");
  assertExactKeys(contractDocument, requiredContractKeys, "threshold_marker_contract_field_set_invalid");

  if (contractDocument.slice_id !== "S-REG-13") {
    fail("threshold_marker_contract_field_invalid", { field: "slice_id" });
  }

  if (contractDocument.registry_id !== S_REG_13_REGISTRY_ID) {
    fail("threshold_marker_contract_field_invalid", { field: "registry_id" });
  }

  if (contractDocument.contract_status !== S_REG_13_CONTRACT_STATUS) {
    fail("threshold_marker_contract_field_invalid", { field: "contract_status" });
  }

  if (contractDocument.candidate_status !== S_REG_13_CANDIDATE_STATUS) {
    fail("threshold_marker_contract_field_invalid", { field: "candidate_status" });
  }

  if (contractDocument.runtime_status !== S_REG_13_RUNTIME_STATUS) {
    fail("threshold_marker_contract_field_invalid", { field: "runtime_status" });
  }

  if (contractDocument.activation_ready !== false) {
    fail("threshold_marker_contract_field_invalid", { field: "activation_ready" });
  }

  if (contractDocument.seed_content_status !== "not_created") {
    fail("threshold_marker_contract_field_invalid", { field: "seed_content_status" });
  }

  if (contractDocument.active_registry_exclusion !== true) {
    fail("threshold_marker_contract_field_invalid", { field: "active_registry_exclusion" });
  }

  if (Object.hasOwn(contractDocument, "records")) {
    fail("threshold_marker_seed_content_present");
  }

  assertExactArray(contractDocument.allowed_fields, S_REG_13_ALLOWED_FIELDS, "threshold_marker_allowed_fields_invalid");
  assertExactArray(
    contractDocument.allowed_threshold_operators,
    S_REG_13_ALLOWED_THRESHOLD_OPERATORS,
    "threshold_marker_allowed_threshold_operators_invalid"
  );
  assertExactArray(
    contractDocument.allowed_threshold_source_values,
    S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES,
    "threshold_marker_allowed_threshold_source_values_invalid"
  );
  assertExactArray(
    contractDocument.allowed_marker_status_values,
    S_REG_13_ALLOWED_MARKER_STATUS_VALUES,
    "threshold_marker_allowed_status_values_invalid"
  );
  assertExactArray(contractDocument.forbidden_fields, S_REG_13_FORBIDDEN_FIELDS, "threshold_marker_forbidden_fields_invalid");

  for (const forbiddenField of S_REG_13_FORBIDDEN_FIELDS) {
    if (contractDocument.allowed_fields.includes(forbiddenField)) {
      fail("threshold_marker_forbidden_field_allowed", { forbidden_field: forbiddenField });
    }
  }

  assertPlainObject(contractDocument.future_fk_expectations, "threshold_marker_future_fk_expectations_invalid");
  assertExactArray(
    contractDocument.future_dependencies,
    ["sport_metric_registry_1c", "metric_exercise_link_registry_1c_a"],
    "threshold_marker_future_dependencies_invalid"
  );

  assertPlainObject(sportMetricDocument, "threshold_marker_upstream_s_reg_11_invalid");
  assertPlainObject(metricExerciseLinkDocument, "threshold_marker_upstream_s_reg_12_invalid");

  if (!Array.isArray(sportMetricDocument.records) || sportMetricDocument.records.length === 0) {
    fail("threshold_marker_upstream_s_reg_11_invalid");
  }

  if (!Array.isArray(metricExerciseLinkDocument.records) || metricExerciseLinkDocument.records.length === 0) {
    fail("threshold_marker_upstream_s_reg_12_invalid");
  }

  return Object.freeze({
    ok: true,
    registry_id: S_REG_13_REGISTRY_ID,
    contract_status: S_REG_13_CONTRACT_STATUS,
    candidate_status: S_REG_13_CANDIDATE_STATUS,
    runtime_status: S_REG_13_RUNTIME_STATUS,
    activation_ready: false,
    allowed_field_count: S_REG_13_ALLOWED_FIELDS.length,
    forbidden_field_count: S_REG_13_FORBIDDEN_FIELDS.length,
    allowed_marker_status_values: [...S_REG_13_ALLOWED_MARKER_STATUS_VALUES],
    threshold_operator_values: [...S_REG_13_ALLOWED_THRESHOLD_OPERATORS],
    threshold_source_values: [...S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES],
    sport_metric_count: sportMetricDocument.records.length,
    metric_exercise_link_count: metricExerciseLinkDocument.records.length,
    seed_content_status: "not_created"
  });
}