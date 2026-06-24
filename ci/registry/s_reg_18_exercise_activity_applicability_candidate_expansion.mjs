import fs from "node:fs";

/**
 * DEV NOTE: S-REG-18 exercise activity applicability candidate expansion.
 * Purpose: validates the first inert candidate applicability expansion for the
 * S-REG-15 candidate exercises and locked activity set, with S-REG-17 FK closure
 * evidence.
 * Boundary: candidate exercise-activity applicability records only. This module
 * must not activate registries, alter active registry law, change engine
 * runtime behaviour, create programme assignment, create substitution behaviour,
 * create marker evaluator behaviour, create threshold marker records, create
 * new exercise/equipment/FK-closure content, or mutate S-REG-15/S-REG-17 files.
 * Determinism: validation is closed over S-REG-06 activity IDs, S-REG-09
 * applicability seed shape, S-REG-14 queue order, S-REG-15 exercise records,
 * and S-REG-17 FK closure evidence.
 * Failure: invalid applicability expansion fails closed with
 * CI_S_REG_18_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_EXPANSION.
 */

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  sReg09ValidateExerciseActivityApplicabilityCandidateSeeds
} from "./s_reg_09_exercise_activity_applicability_candidate_seeds.mjs";

import {
  S_REG_15_EXPECTED_RECORD_IDS,
  sReg15LoadCandidateExerciseContentBatch1,
  sReg15ValidateCandidateExerciseRegistryContentBatch1
} from "./s_reg_15_candidate_exercise_registry_content_batch_1.mjs";

import {
  S_REG_17_EXPECTED_CLOSURE_IDS,
  sReg17LoadExerciseEquipmentCandidateFkClosureExpansion,
  sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion
} from "./s_reg_17_exercise_equipment_candidate_fk_closure_expansion.mjs";

import {
  S_REG_14_BUILD_QUEUE,
  sReg14LoadRegistryBuildReadinessManifest,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "./s_reg_14_registry_build_readiness_start_gate.mjs";

export const S_REG_18_SLICE_ID = "S-REG-18";
export const S_REG_18_FAILURE_TOKEN = "CI_S_REG_18_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_EXPANSION";
export const S_REG_18_RUNTIME_STATUS = "non_runtime";
export const S_REG_18_CANDIDATE_STATUS = "candidate_content_draft";
export const S_REG_18_BATCH_ID = "candidate_exercise_activity_applicability_expansion_batch_1";
export const S_REG_18_REGISTRY_ID = "exercise_activity_applicability_registry";
export const S_REG_18_CONTENT_BATCH_STATUS = "candidate_content_expanded_inert";
export const S_REG_18_ACTIVITY_CONTEXT = "training";
export const S_REG_18_APPLICABILITY_STATE = "allowed";
export const S_REG_18_TIER_CAP = "candidate_expansion_only";

export const S_REG_18_CANDIDATE_PATHS = Object.freeze({
  applicability_batch_1: "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.json",
  s_reg_15_exercise_batch_1: "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json",
  s_reg_17_fk_closure_batch_1: "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.json",
  active_registry_index: "registries/registry_index.json",
  active_registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_18_EXPECTED_APPLICABILITY_IDS = Object.freeze([
  "paused_back_squat__powerlifting__training",
  "paused_back_squat__general_strength__training",
  "paused_back_squat__rugby_union__training",
  "tempo_back_squat__powerlifting__training",
  "tempo_back_squat__general_strength__training",
  "tempo_back_squat__rugby_union__training",
  "paused_deadlift__powerlifting__training",
  "paused_deadlift__general_strength__training",
  "paused_deadlift__rugby_union__training",
  "romanian_deadlift__powerlifting__training",
  "romanian_deadlift__general_strength__training",
  "romanian_deadlift__rugby_union__training",
  "paused_bench_press__powerlifting__training",
  "paused_bench_press__general_strength__training",
  "paused_bench_press__rugby_union__training",
  "close_grip_bench_press__powerlifting__training",
  "close_grip_bench_press__general_strength__training",
  "close_grip_bench_press__rugby_union__training"
]);

export const S_REG_18_LOCKED_ACTIVITY_IDS = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

export const S_REG_18_REQUIRED_RECORD_FIELDS = Object.freeze([
  "applicability_id",
  "exercise_id",
  "activity_id",
  "activity_context",
  "registry_id",
  "batch_id",
  "exercise_batch_id",
  "exercise_source_slice_id",
  "fk_closure_source_slice_id",
  "fk_closure_evidence_ids",
  "movement_id",
  "relationship_basis",
  "applicability_state",
  "conditions",
  "tier_cap",
  "template_applicability",
  "substitution_applicability",
  "source_slice_id",
  "candidate_status",
  "runtime_status",
  "activation_ready",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "engine_runtime_mutation",
  "complete_registry_claim",
  "programme_assignment_mutation",
  "substitution_runtime_mutation",
  "marker_evaluator_mutation",
  "threshold_marker_mutation",
  "applicability_scope",
  "copy_legal_boundary_notes"
]);

const S_REG_18_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const S_REG_18_FORBIDDEN_KEYS = Object.freeze([
  "active_registry_activation",
  "canonical_registry_activation",
  "programme_assignment",
  "programme_template_formula",
  "progression_formula",
  "substitution_rank",
  "substitution_score",
  "substitution_runtime_change",
  "fallback_logic",
  "recommendation_score",
  "recommended_rank",
  "ranking_score",
  "rank",
  "optimisation_score",
  "optimization_score",
  "capability_inference",
  "capability_score",
  "inferred_applicability",
  "preferred_exercise",
  "readiness_score",
  "readiness_status",
  "safety_rating",
  "safety_status",
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
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg18ExerciseActivityApplicabilityCandidateExpansionError";
  error.code = S_REG_18_FAILURE_TOKEN;
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

function requireStringArray(value, field, context, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail("required_string_array_invalid", `${field} must be an explicit string array.`, context);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      fail("required_string_array_invalid", `${field} must contain non-empty strings only.`, context);
    }

    if (seen.has(item)) {
      fail("duplicate_string_array_value", `${field} must not contain duplicate values.`, {
        ...context,
        value: item
      });
    }

    seen.add(item);
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
  for (const key of S_REG_18_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_applicability_semantic_key", "Candidate applicability records must not contain activation, programme, substitution, fallback, recommendation, ranking, optimisation, capability, readiness, safety, suitability, tactical, return-to-play, effectiveness, outcome, coach interpretation, marketplace, facility, organisation, marker, or evaluator fields.", {
        ...context,
        field: key
      });
    }
  }
}

function expectedApplicabilityId(exerciseId, activityId) {
  return `${exerciseId}__${activityId}__${S_REG_18_ACTIVITY_CONTEXT}`;
}

function assertDocumentBoundary(document) {
  if (!isPlainRecord(document)) {
    fail("candidate_applicability_document_invalid", "S-REG-18 applicability document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_18_SLICE_ID,
    registry_id: S_REG_18_REGISTRY_ID,
    batch_id: S_REG_18_BATCH_ID,
    registry_target: S_REG_18_REGISTRY_ID,
    source_queue_slice_id: "S-REG-14",
    source_queue_order: 4,
    candidate_status: S_REG_18_CANDIDATE_STATUS,
    runtime_status: S_REG_18_RUNTIME_STATUS,
    content_batch_status: S_REG_18_CONTENT_BATCH_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    programme_assignment_mutation: false,
    substitution_runtime_mutation: false,
    marker_evaluator_mutation: false,
    threshold_marker_mutation: false,
    record_count: S_REG_18_EXPECTED_APPLICABILITY_IDS.length
  })) {
    if (document[field] !== expected) {
      fail("candidate_applicability_document_boundary_field_invalid", "S-REG-18 applicability document boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  assertExactArray(document.dependency_inputs, ["S-REG-10", "S-REG-15", "S-REG-17"], "dependency_inputs_invalid");
  assertExactArray(document.foundation_inputs, ["S-REG-06", "S-REG-09"], "foundation_inputs_invalid");

  if (!Array.isArray(document.records)) {
    fail("candidate_applicability_records_invalid", "S-REG-18 records must be an array.");
  }

  assertExactArray(
    document.records.map((record) => record.applicability_id),
    S_REG_18_EXPECTED_APPLICABILITY_IDS,
    "candidate_applicability_record_order_invalid"
  );
}

function assertQueueBoundary() {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();
  const queueItem = manifest.candidate_build_queue.find((entry) => entry.slice_id === S_REG_18_SLICE_ID);
  const constantQueueItem = S_REG_14_BUILD_QUEUE.find((entry) => entry.slice_id === S_REG_18_SLICE_ID);

  if (!queueItem || !constantQueueItem) {
    fail("s_reg_18_queue_item_missing", "S-REG-14 must declare S-REG-18 in the build queue.");
  }

  for (const [field, expected] of Object.entries({
    order: 4,
    slice_id: S_REG_18_SLICE_ID,
    batch_id: S_REG_18_BATCH_ID,
    registry_target: S_REG_18_REGISTRY_ID,
    proof_command: "npm.cmd run proof:s-reg-18",
    content_status_after_slice: S_REG_18_CONTENT_BATCH_STATUS
  })) {
    if (queueItem[field] !== expected) {
      fail("s_reg_18_queue_item_invalid", "S-REG-14 queue item field mismatch.", {
        field,
        expected,
        actual: queueItem[field]
      });
    }

    if (constantQueueItem[field] !== expected) {
      fail("s_reg_18_constant_queue_item_invalid", "S-REG-14 exported queue item field mismatch.", {
        field,
        expected,
        actual: constantQueueItem[field]
      });
    }
  }

  assertExactArray(queueItem.dependency_inputs, ["S-REG-10", "S-REG-15", "S-REG-17"], "s_reg_18_queue_dependencies_invalid");
}

function assertActiveRegistrySurface() {
  const registryIndex = readJson(S_REG_18_CANDIDATE_PATHS.active_registry_index);
  const registryBundle = readJson(S_REG_18_CANDIDATE_PATHS.active_registry_bundle);

  assertExactArray(registryIndex.order, S_REG_18_ACTIVE_REGISTRY_ORDER, "active_registry_index_order_changed");
  assertExactArray(Object.keys(registryBundle.registries ?? {}), S_REG_18_ACTIVE_REGISTRY_ORDER, "active_registry_bundle_changed");
}

function assertSReg06Dependency(upstream) {
  const result = sReg06ValidateCandidateSeedSurface(upstream);

  if (!result.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate seed surface did not validate.", { result });
  }
}

function assertSReg09Dependency() {
  const result = sReg09ValidateExerciseActivityApplicabilityCandidateSeeds();

  if (!result.ok || result.registry_id !== S_REG_18_REGISTRY_ID) {
    fail("s_reg_09_dependency_invalid", "S-REG-09 applicability seed dependency did not validate.", { result });
  }
}

function assertSReg15Dependency(document) {
  const result = sReg15ValidateCandidateExerciseRegistryContentBatch1({ document });

  if (!result.ok) {
    fail("s_reg_15_dependency_invalid", "S-REG-15 candidate exercise batch did not validate.", { result });
  }

  assertExactArray(result.exercise_ids, S_REG_15_EXPECTED_RECORD_IDS, "s_reg_15_dependency_exercise_ids_invalid");
}

function assertSReg17Dependency(document, sReg15Document) {
  const result = sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion({
    document,
    sReg15Document
  });

  if (!result.ok) {
    fail("s_reg_17_dependency_invalid", "S-REG-17 candidate FK closure expansion did not validate.", { result });
  }

  assertExactArray(result.closure_ids, S_REG_17_EXPECTED_CLOSURE_IDS, "s_reg_17_dependency_closure_ids_invalid");
}

function assertRecordBoundary(record, context) {
  if (!isPlainRecord(record)) {
    fail("candidate_applicability_record_invalid", "Candidate applicability record must be a plain object.", context);
  }

  for (const field of S_REG_18_REQUIRED_RECORD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      fail("candidate_applicability_required_field_missing", "Candidate applicability record required field missing.", {
        ...context,
        field
      });
    }
  }

  assertNoForbiddenKeys(record, context);

  requireString(record.applicability_id, "applicability_id", context);
  requireString(record.exercise_id, "exercise_id", context);
  requireString(record.activity_id, "activity_id", context);
  requireString(record.activity_context, "activity_context", context);
  requireString(record.registry_id, "registry_id", context);
  requireString(record.batch_id, "batch_id", context);
  requireString(record.exercise_batch_id, "exercise_batch_id", context);
  requireString(record.exercise_source_slice_id, "exercise_source_slice_id", context);
  requireString(record.fk_closure_source_slice_id, "fk_closure_source_slice_id", context);
  requireStringArray(record.fk_closure_evidence_ids, "fk_closure_evidence_ids", context);
  requireString(record.movement_id, "movement_id", context);
  requireString(record.relationship_basis, "relationship_basis", context);
  requireString(record.applicability_state, "applicability_state", context);
  requireStringArray(record.conditions, "conditions", context, { allowEmpty: true });
  requireString(record.tier_cap, "tier_cap", context);
  requireString(record.template_applicability, "template_applicability", context);
  requireString(record.substitution_applicability, "substitution_applicability", context);
  requireString(record.source_slice_id, "source_slice_id", context);
  requireString(record.candidate_status, "candidate_status", context);
  requireString(record.runtime_status, "runtime_status", context);
  requireBoolean(record.activation_ready, "activation_ready", context);
  requireBoolean(record.active_registry_mutation, "active_registry_mutation", context);
  requireBoolean(record.active_bundle_mutation, "active_bundle_mutation", context);
  requireBoolean(record.registry_law_mutation, "registry_law_mutation", context);
  requireBoolean(record.engine_runtime_mutation, "engine_runtime_mutation", context);
  requireBoolean(record.complete_registry_claim, "complete_registry_claim", context);
  requireBoolean(record.programme_assignment_mutation, "programme_assignment_mutation", context);
  requireBoolean(record.substitution_runtime_mutation, "substitution_runtime_mutation", context);
  requireBoolean(record.marker_evaluator_mutation, "marker_evaluator_mutation", context);
  requireBoolean(record.threshold_marker_mutation, "threshold_marker_mutation", context);
  requireString(record.applicability_scope, "applicability_scope", context);
  requireString(record.copy_legal_boundary_notes, "copy_legal_boundary_notes", context);

  for (const [field, expected] of Object.entries({
    activity_context: S_REG_18_ACTIVITY_CONTEXT,
    registry_id: S_REG_18_REGISTRY_ID,
    batch_id: S_REG_18_BATCH_ID,
    exercise_source_slice_id: "S-REG-15",
    fk_closure_source_slice_id: "S-REG-17",
    relationship_basis: "declared_exercise_activity_and_fk_closure_evidence",
    applicability_state: S_REG_18_APPLICABILITY_STATE,
    tier_cap: S_REG_18_TIER_CAP,
    template_applicability: "eligible",
    substitution_applicability: "eligible",
    source_slice_id: S_REG_18_SLICE_ID,
    candidate_status: S_REG_18_CANDIDATE_STATUS,
    runtime_status: S_REG_18_RUNTIME_STATUS,
    activation_ready: false,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    complete_registry_claim: false,
    programme_assignment_mutation: false,
    substitution_runtime_mutation: false,
    marker_evaluator_mutation: false,
    threshold_marker_mutation: false,
    applicability_scope: "candidate_exercise_activity_relationship",
    copy_legal_boundary_notes: "factual candidate applicability link only"
  })) {
    if (record[field] !== expected) {
      fail("candidate_applicability_boundary_field_invalid", "Candidate applicability boundary field mismatch.", {
        ...context,
        field,
        expected,
        actual: record[field]
      });
    }
  }

  if (record.applicability_id !== expectedApplicabilityId(record.exercise_id, record.activity_id)) {
    fail("applicability_id_invalid", "Candidate applicability id must be exercise_id plus activity_id plus training context.", context);
  }
}

function assertApplicabilityRelationship(record, activityIds, exerciseById, fkClosureByExercise, context) {
  const exercise = exerciseById.get(record.exercise_id);

  if (!exercise) {
    fail("exercise_fk_unknown", "Candidate applicability references unknown S-REG-15 exercise_id.", context);
  }

  if (!activityIds.has(record.activity_id)) {
    fail("activity_fk_unknown", "Candidate applicability references unknown S-REG-06 activity_id.", context);
  }

  if (!exercise.activity_ids.includes(record.activity_id)) {
    fail("exercise_activity_not_declared", "Candidate applicability activity_id is not declared by the S-REG-15 exercise.", context);
  }

  if (record.exercise_batch_id !== exercise.batch_id) {
    fail("exercise_batch_id_invalid", "Candidate applicability exercise_batch_id must match S-REG-15 source record.", context);
  }

  if (record.movement_id !== exercise.movement_id) {
    fail("movement_id_invalid", "Candidate applicability movement_id must match S-REG-15 source record.", context);
  }

  const closureRecords = fkClosureByExercise.get(record.exercise_id) ?? [];
  const evidenceSet = new Set(closureRecords.map((closure) => closure.closure_id));

  for (const evidenceId of record.fk_closure_evidence_ids) {
    if (!evidenceSet.has(evidenceId)) {
      fail("fk_closure_evidence_unknown", "Candidate applicability references unknown S-REG-17 FK closure evidence.", {
        ...context,
        evidence_id: evidenceId
      });
    }

    const closure = closureRecords.find((item) => item.closure_id === evidenceId);

    if (!closure.activity_ids_intersection.includes(record.activity_id)) {
      fail("fk_closure_activity_evidence_invalid", "Candidate applicability evidence does not include the activity_id.", {
        ...context,
        evidence_id: evidenceId
      });
    }
  }
}

export function sReg18CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_18_CANDIDATE_PATHS));
}

export function sReg18LoadExerciseActivityApplicabilityCandidateExpansion() {
  return deepFreeze(readJson(S_REG_18_CANDIDATE_PATHS.applicability_batch_1));
}

export function sReg18ValidateExerciseActivityApplicabilityCandidateExpansion({
  document,
  sReg15Document,
  sReg17Document,
  upstream
} = {}) {
  assertActiveRegistrySurface();
  sReg14ValidateRegistryBuildReadinessStartGate();
  assertQueueBoundary();

  const loadedUpstream = upstream ?? sReg06LoadCandidateSeedFiles();
  const loadedSReg15Document = sReg15Document ?? sReg15LoadCandidateExerciseContentBatch1();
  const loadedSReg17Document = sReg17Document ?? sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();
  const loadedDocument = document ?? sReg18LoadExerciseActivityApplicabilityCandidateExpansion();

  assertDocumentBoundary(loadedDocument);
  requireUnique(loadedDocument.records, "applicability_id", S_REG_18_REGISTRY_ID);

  assertSReg06Dependency(loadedUpstream);
  assertSReg09Dependency();
  assertSReg15Dependency(loadedSReg15Document);
  assertSReg17Dependency(loadedSReg17Document, loadedSReg15Document);

  const activityIds = new Set(loadedUpstream.activity_registry_1.records.map((record) => record.activity_id));
  const exerciseById = new Map(loadedSReg15Document.records.map((record) => [record.exercise_id, record]));
  const fkClosureByExercise = new Map();

  for (const closure of loadedSReg17Document.records) {
    const current = fkClosureByExercise.get(closure.exercise_id) ?? [];
    current.push(closure);
    fkClosureByExercise.set(closure.exercise_id, current);
  }

  for (const record of loadedDocument.records) {
    const context = {
      applicability_id: record.applicability_id ?? null,
      exercise_id: record.exercise_id ?? null,
      activity_id: record.activity_id ?? null,
      batch_id: S_REG_18_BATCH_ID
    };

    assertRecordBoundary(record, context);
    assertApplicabilityRelationship(record, activityIds, exerciseById, fkClosureByExercise, context);
  }

  return deepFreeze({
    ok: true,
    token: S_REG_18_FAILURE_TOKEN,
    slice_id: S_REG_18_SLICE_ID,
    batch_id: S_REG_18_BATCH_ID,
    registry_id: S_REG_18_REGISTRY_ID,
    record_count: loadedDocument.records.length,
    applicability_ids: loadedDocument.records.map((record) => record.applicability_id),
    exercise_ids: [...new Set(loadedDocument.records.map((record) => record.exercise_id))],
    activity_ids: [...new Set(loadedDocument.records.map((record) => record.activity_id))],
    activity_context: S_REG_18_ACTIVITY_CONTEXT,
    applicability_state: S_REG_18_APPLICABILITY_STATE,
    dependency_inputs: loadedDocument.dependency_inputs,
    foundation_inputs: loadedDocument.foundation_inputs,
    activation_ready: false,
    runtime_status: S_REG_18_RUNTIME_STATUS,
    candidate_status: S_REG_18_CANDIDATE_STATUS,
    content_batch_status: S_REG_18_CONTENT_BATCH_STATUS
  });
}