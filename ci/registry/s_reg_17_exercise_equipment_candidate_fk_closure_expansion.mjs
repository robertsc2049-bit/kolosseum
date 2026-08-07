import fs from "node:fs";

/**
 * DEV NOTE: S-REG-17 exercise-equipment candidate FK closure expansion.
 * Purpose: validates the first inert candidate FK closure expansion between
 * S-REG-15 candidate exercises and S-REG-16 candidate equipment.
 * Boundary: candidate FK relationship records only. This module must not
 * activate registries, alter the active registry bundle, alter registry law,
 * change engine runtime behaviour, create programme assignment logic, create
 * substitution behaviour, create marker evaluator behaviour, create threshold
 * marker records, or mutate the S-REG-15/S-REG-16 source batch files.
 * Determinism: validation is closed over fixed S-REG-15 and S-REG-16 batch
 * records, exact queue order, exact dependency inputs, and exact movement plus
 * activity FK relationship generation.
 * Failure: invalid closure fails closed with
 * CI_S_REG_17_EXERCISE_EQUIPMENT_CANDIDATE_FK_CLOSURE_EXPANSION.
 */

import {
  S_REG_15_EXPECTED_RECORD_IDS,
  sReg15LoadCandidateExerciseContentBatch1,
  sReg15ValidateCandidateExerciseRegistryContentBatch1
} from "./s_reg_15_candidate_exercise_registry_content_batch_1.mjs";

import {
  S_REG_16_EXPECTED_RECORD_IDS,
  sReg16LoadCandidateEquipmentContentBatch1,
  sReg16ValidateCandidateEquipmentRegistryContentBatch1
} from "./s_reg_16_candidate_equipment_registry_content_batch_1.mjs";

import {
  S_REG_14_BUILD_QUEUE,
  sReg14LoadRegistryBuildReadinessManifest,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "./s_reg_14_registry_build_readiness_start_gate.mjs";

export const S_REG_17_SLICE_ID = "S-REG-17";
export const S_REG_17_FAILURE_TOKEN = "CI_S_REG_17_EXERCISE_EQUIPMENT_CANDIDATE_FK_CLOSURE_EXPANSION";
export const S_REG_17_RUNTIME_STATUS = "non_runtime";
export const S_REG_17_CANDIDATE_STATUS = "candidate_content_draft";
export const S_REG_17_BATCH_ID = "candidate_exercise_equipment_fk_closure_expansion_batch_1";
export const S_REG_17_REGISTRY_ID = "exercise_equipment_fk_closure";
export const S_REG_17_CONTENT_BATCH_STATUS = "candidate_fk_closure_expanded_inert";

export const S_REG_17_CANDIDATE_PATHS = Object.freeze({
  fk_closure_batch_1: "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.json",
  s_reg_15_exercise_batch_1: "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json",
  s_reg_16_equipment_batch_1: "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.json",
  active_registry_index: "registries/registry_index.json",
  active_registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_17_EXPECTED_CLOSURE_IDS = Object.freeze([
  "paused_back_squat__dumbbell",
  "paused_back_squat__kettlebell",
  "paused_back_squat__resistance_band",
  "tempo_back_squat__dumbbell",
  "tempo_back_squat__kettlebell",
  "tempo_back_squat__resistance_band",
  "paused_deadlift__dumbbell",
  "paused_deadlift__kettlebell",
  "paused_deadlift__resistance_band",
  "romanian_deadlift__dumbbell",
  "romanian_deadlift__kettlebell",
  "romanian_deadlift__resistance_band",
  "paused_bench_press__dumbbell",
  "paused_bench_press__adjustable_bench",
  "paused_bench_press__cable_machine",
  "paused_bench_press__resistance_band",
  "close_grip_bench_press__dumbbell",
  "close_grip_bench_press__adjustable_bench",
  "close_grip_bench_press__cable_machine",
  "close_grip_bench_press__resistance_band"
]);

export const S_REG_17_REQUIRED_RECORD_FIELDS = Object.freeze([
  "closure_id",
  "exercise_id",
  "equipment_id",
  "registry_id",
  "batch_id",
  "exercise_batch_id",
  "equipment_batch_id",
  "exercise_source_slice_id",
  "equipment_source_slice_id",
  "movement_id",
  "activity_ids_intersection",
  "relationship_basis",
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
  "closure_scope",
  "copy_legal_boundary_notes"
]);

const S_REG_17_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const S_REG_17_FORBIDDEN_KEYS = Object.freeze([
  "active_registry_activation",
  "canonical_registry_activation",
  "programme_assignment",
  "programme_template_formula",
  "progression_formula",
  "substitution_rank",
  "substitution_score",
  "substitution_runtime_change",
  "fallback_logic",
  "equipment_advice",
  "recommendation_score",
  "recommended_rank",
  "ranking_score",
  "rank",
  "optimisation_score",
  "optimization_score",
  "capability_inference",
  "capability_score",
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
  error.name = "SReg17ExerciseEquipmentCandidateFkClosureExpansionError";
  error.code = S_REG_17_FAILURE_TOKEN;
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

function requireStringArray(value, field, context) {
  if (!Array.isArray(value) || value.length === 0) {
    fail("required_string_array_invalid", `${field} must be a non-empty string array.`, context);
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

function arrayIntersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
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
  for (const key of S_REG_17_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_candidate_fk_closure_semantic_key", "Candidate FK closure records must not contain activation, programme, substitution, fallback, advice, recommendation, ranking, optimisation, capability, readiness, safety, suitability, tactical, return-to-play, effectiveness, outcome, coach interpretation, marketplace, facility, organisation, marker, or evaluator fields.", {
        ...context,
        field: key
      });
    }
  }
}

function assertDocumentBoundary(document) {
  if (!isPlainRecord(document)) {
    fail("candidate_fk_closure_document_invalid", "S-REG-17 FK closure document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_17_SLICE_ID,
    registry_id: S_REG_17_REGISTRY_ID,
    batch_id: S_REG_17_BATCH_ID,
    registry_target: S_REG_17_REGISTRY_ID,
    source_queue_slice_id: "S-REG-14",
    source_queue_order: 3,
    candidate_status: S_REG_17_CANDIDATE_STATUS,
    runtime_status: S_REG_17_RUNTIME_STATUS,
    content_batch_status: S_REG_17_CONTENT_BATCH_STATUS,
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
    record_count: S_REG_17_EXPECTED_CLOSURE_IDS.length
  })) {
    if (document[field] !== expected) {
      fail("candidate_fk_closure_document_boundary_field_invalid", "S-REG-17 FK closure document boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  assertExactArray(document.dependency_inputs, ["S-REG-15", "S-REG-16"], "dependency_inputs_invalid");

  if (!Array.isArray(document.records)) {
    fail("candidate_fk_closure_records_invalid", "S-REG-17 records must be an array.");
  }

  assertExactArray(
    document.records.map((record) => record.closure_id),
    S_REG_17_EXPECTED_CLOSURE_IDS,
    "candidate_fk_closure_record_order_invalid"
  );
}

function assertQueueBoundary() {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();
  const queueItem = manifest.candidate_build_queue.find((entry) => entry.slice_id === S_REG_17_SLICE_ID);
  const constantQueueItem = S_REG_14_BUILD_QUEUE.find((entry) => entry.slice_id === S_REG_17_SLICE_ID);

  if (!queueItem || !constantQueueItem) {
    fail("s_reg_17_queue_item_missing", "S-REG-14 must declare S-REG-17 in the build queue.");
  }

  for (const [field, expected] of Object.entries({
    order: 3,
    slice_id: S_REG_17_SLICE_ID,
    batch_id: S_REG_17_BATCH_ID,
    registry_target: S_REG_17_REGISTRY_ID,
    proof_command: "npm.cmd run proof:s-reg-17",
    content_status_after_slice: S_REG_17_CONTENT_BATCH_STATUS
  })) {
    if (queueItem[field] !== expected) {
      fail("s_reg_17_queue_item_invalid", "S-REG-14 queue item field mismatch.", {
        field,
        expected,
        actual: queueItem[field]
      });
    }

    if (constantQueueItem[field] !== expected) {
      fail("s_reg_17_constant_queue_item_invalid", "S-REG-14 exported queue item field mismatch.", {
        field,
        expected,
        actual: constantQueueItem[field]
      });
    }
  }

  assertExactArray(queueItem.dependency_inputs, ["S-REG-15", "S-REG-16"], "s_reg_17_queue_dependencies_invalid");
}

function assertActiveRegistrySurface() {
  const registryIndex = readJson(S_REG_17_CANDIDATE_PATHS.active_registry_index);
  const registryBundle = readJson(S_REG_17_CANDIDATE_PATHS.active_registry_bundle);

  assertExactArray(
    registryIndex.order.slice(0, S_REG_17_ACTIVE_REGISTRY_ORDER.length),
    S_REG_17_ACTIVE_REGISTRY_ORDER,
    "active_registry_index_order_changed"
  );
  assertExactArray(
    Object.keys(registryBundle.registries ?? {}).slice(0, S_REG_17_ACTIVE_REGISTRY_ORDER.length),
    S_REG_17_ACTIVE_REGISTRY_ORDER,
    "active_registry_bundle_changed"
  );
}

function assertSReg15Dependency(document) {
  const result = sReg15ValidateCandidateExerciseRegistryContentBatch1({ document });

  if (!result.ok) {
    fail("s_reg_15_dependency_invalid", "S-REG-15 candidate exercise batch did not validate.", { result });
  }

  assertExactArray(result.exercise_ids, S_REG_15_EXPECTED_RECORD_IDS, "s_reg_15_dependency_exercise_ids_invalid");
}

function assertSReg16Dependency(document, sReg15Document) {
  const result = sReg16ValidateCandidateEquipmentRegistryContentBatch1({
    document,
    sReg15Document
  });

  if (!result.ok) {
    fail("s_reg_16_dependency_invalid", "S-REG-16 candidate equipment batch did not validate.", { result });
  }

  assertExactArray(result.equipment_ids, S_REG_16_EXPECTED_RECORD_IDS, "s_reg_16_dependency_equipment_ids_invalid");
}

function assertRecordBoundary(record, context) {
  if (!isPlainRecord(record)) {
    fail("candidate_fk_closure_record_invalid", "Candidate FK closure record must be a plain object.", context);
  }

  for (const field of S_REG_17_REQUIRED_RECORD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      fail("candidate_fk_closure_required_field_missing", "Candidate FK closure record required field missing.", {
        ...context,
        field
      });
    }
  }

  assertNoForbiddenKeys(record, context);

  requireString(record.closure_id, "closure_id", context);
  requireString(record.exercise_id, "exercise_id", context);
  requireString(record.equipment_id, "equipment_id", context);
  requireString(record.registry_id, "registry_id", context);
  requireString(record.batch_id, "batch_id", context);
  requireString(record.exercise_batch_id, "exercise_batch_id", context);
  requireString(record.equipment_batch_id, "equipment_batch_id", context);
  requireString(record.exercise_source_slice_id, "exercise_source_slice_id", context);
  requireString(record.equipment_source_slice_id, "equipment_source_slice_id", context);
  requireString(record.movement_id, "movement_id", context);
  requireStringArray(record.activity_ids_intersection, "activity_ids_intersection", context);
  requireString(record.relationship_basis, "relationship_basis", context);
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
  requireString(record.closure_scope, "closure_scope", context);
  requireString(record.copy_legal_boundary_notes, "copy_legal_boundary_notes", context);

  for (const [field, expected] of Object.entries({
    registry_id: S_REG_17_REGISTRY_ID,
    batch_id: S_REG_17_BATCH_ID,
    exercise_source_slice_id: "S-REG-15",
    equipment_source_slice_id: "S-REG-16",
    relationship_basis: "activity_and_movement_fk_match",
    source_slice_id: S_REG_17_SLICE_ID,
    candidate_status: S_REG_17_CANDIDATE_STATUS,
    runtime_status: S_REG_17_RUNTIME_STATUS,
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
    closure_scope: "candidate_fk_relationship",
    copy_legal_boundary_notes: "factual exercise-equipment FK relationship only"
  })) {
    if (record[field] !== expected) {
      fail("candidate_fk_closure_boundary_field_invalid", "Candidate FK closure boundary field mismatch.", {
        ...context,
        field,
        expected,
        actual: record[field]
      });
    }
  }

  if (record.closure_id !== `${record.exercise_id}__${record.equipment_id}`) {
    fail("closure_id_invalid", "Candidate FK closure id must be exercise_id plus equipment_id.", context);
  }
}

function assertFkRelationship(record, exerciseById, equipmentById, context) {
  const exercise = exerciseById.get(record.exercise_id);
  const equipment = equipmentById.get(record.equipment_id);

  if (!exercise) {
    fail("exercise_fk_unknown", "Candidate FK closure references unknown S-REG-15 exercise_id.", context);
  }

  if (!equipment) {
    fail("equipment_fk_unknown", "Candidate FK closure references unknown S-REG-16 equipment_id.", context);
  }

  if (record.exercise_batch_id !== exercise.batch_id) {
    fail("exercise_batch_id_invalid", "Candidate FK closure exercise_batch_id must match S-REG-15 source record.", context);
  }

  if (record.equipment_batch_id !== equipment.batch_id) {
    fail("equipment_batch_id_invalid", "Candidate FK closure equipment_batch_id must match S-REG-16 source record.", context);
  }

  if (record.movement_id !== exercise.movement_id) {
    fail("movement_id_invalid", "Candidate FK closure movement_id must match the S-REG-15 exercise record.", context);
  }

  if (!equipment.movement_pattern_applicability.includes(exercise.movement_id)) {
    fail("movement_fk_not_closed", "Candidate FK closure equipment record does not declare the exercise movement_id.", context);
  }

  const expectedIntersection = arrayIntersection(exercise.activity_ids, equipment.activity_applicability);

  if (expectedIntersection.length === 0) {
    fail("activity_fk_not_closed", "Candidate FK closure has no activity_id intersection.", context);
  }

  assertExactArray(
    record.activity_ids_intersection,
    expectedIntersection,
    "activity_ids_intersection_invalid",
    context
  );
}

export function sReg17CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_17_CANDIDATE_PATHS));
}

export function sReg17LoadExerciseEquipmentCandidateFkClosureExpansion() {
  return deepFreeze(readJson(S_REG_17_CANDIDATE_PATHS.fk_closure_batch_1));
}

export function sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion({
  document,
  sReg15Document,
  sReg16Document
} = {}) {
  assertActiveRegistrySurface();
  sReg14ValidateRegistryBuildReadinessStartGate();
  assertQueueBoundary();

  const loadedSReg15Document = sReg15Document ?? sReg15LoadCandidateExerciseContentBatch1();
  const loadedSReg16Document = sReg16Document ?? sReg16LoadCandidateEquipmentContentBatch1();
  const loadedDocument = document ?? sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();

  assertDocumentBoundary(loadedDocument);
  requireUnique(loadedDocument.records, "closure_id", S_REG_17_REGISTRY_ID);

  assertSReg15Dependency(loadedSReg15Document);
  assertSReg16Dependency(loadedSReg16Document, loadedSReg15Document);

  const exerciseById = new Map(loadedSReg15Document.records.map((record) => [record.exercise_id, record]));
  const equipmentById = new Map(loadedSReg16Document.records.map((record) => [record.equipment_id, record]));

  for (const record of loadedDocument.records) {
    const context = {
      closure_id: record.closure_id ?? null,
      exercise_id: record.exercise_id ?? null,
      equipment_id: record.equipment_id ?? null,
      batch_id: S_REG_17_BATCH_ID
    };

    assertRecordBoundary(record, context);
    assertFkRelationship(record, exerciseById, equipmentById, context);
  }

  return deepFreeze({
    ok: true,
    token: S_REG_17_FAILURE_TOKEN,
    slice_id: S_REG_17_SLICE_ID,
    batch_id: S_REG_17_BATCH_ID,
    registry_id: S_REG_17_REGISTRY_ID,
    record_count: loadedDocument.records.length,
    closure_ids: loadedDocument.records.map((record) => record.closure_id),
    exercise_ids: [...new Set(loadedDocument.records.map((record) => record.exercise_id))],
    equipment_ids: [...new Set(loadedDocument.records.map((record) => record.equipment_id))],
    dependency_inputs: loadedDocument.dependency_inputs,
    activation_ready: false,
    runtime_status: S_REG_17_RUNTIME_STATUS,
    candidate_status: S_REG_17_CANDIDATE_STATUS,
    content_batch_status: S_REG_17_CONTENT_BATCH_STATUS
  });
}