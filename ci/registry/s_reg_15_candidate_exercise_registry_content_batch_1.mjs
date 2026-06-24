import fs from "node:fs";

/**
 * DEV NOTE: S-REG-15 candidate exercise registry content batch 1.
 * Purpose: validates the first inert candidate content expansion batch for
 * exercise_registry_3a, using only the dependency inputs declared by S-REG-14.
 * Boundary: candidate exercise identity records only. This module must not
 * activate registries, alter the active registry bundle, alter registry law,
 * change engine runtime behaviour, create programme template logic, create
 * substitution behaviour, or create marker evaluator behaviour.
 * Determinism: validation is closed over fixed candidate paths, exact batch
 * order, exact dependency inputs, fixed expected exercise ids, and upstream FK
 * sets from S-REG-06, S-REG-08, and S-REG-09.
 * Failure: invalid content fails closed with
 * CI_S_REG_15_CANDIDATE_EXERCISE_REGISTRY_CONTENT_BATCH_1.
 */

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate
} from "./s_reg_08_exercise_equipment_fk_closure_candidate_update.mjs";

import {
  sReg09ValidateExerciseActivityApplicabilityCandidateSeeds
} from "./s_reg_09_exercise_activity_applicability_candidate_seeds.mjs";

import {
  S_REG_14_BUILD_QUEUE,
  sReg14LoadRegistryBuildReadinessManifest,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "./s_reg_14_registry_build_readiness_start_gate.mjs";

export const S_REG_15_SLICE_ID = "S-REG-15";
export const S_REG_15_FAILURE_TOKEN = "CI_S_REG_15_CANDIDATE_EXERCISE_REGISTRY_CONTENT_BATCH_1";
export const S_REG_15_RUNTIME_STATUS = "non_runtime";
export const S_REG_15_CANDIDATE_STATUS = "candidate_content_draft";
export const S_REG_15_BATCH_ID = "candidate_exercise_registry_content_expansion_batch_1";
export const S_REG_15_REGISTRY_ID = "exercise_registry_3a";
export const S_REG_15_CONTENT_BATCH_STATUS = "candidate_content_expanded_inert";
export const S_REG_15_EQUIPMENT_DEPENDENCY_STATUS = "candidate_equipment_fk_closed";
export const S_REG_15_APPLICABILITY_DEPENDENCY_STATUS = "candidate_activity_fk_ready";

export const S_REG_15_CANDIDATE_PATHS = Object.freeze({
  exercise_registry_3a_batch_1: "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json",
  equipment_registry: "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json",
  active_registry_index: "registries/registry_index.json",
  active_registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_15_EXPECTED_RECORD_IDS = Object.freeze([
  "paused_back_squat",
  "tempo_back_squat",
  "paused_deadlift",
  "romanian_deadlift",
  "paused_bench_press",
  "close_grip_bench_press"
]);

export const S_REG_15_REQUIRED_RECORD_FIELDS = Object.freeze([
  "exercise_id",
  "name",
  "registry_id",
  "batch_id",
  "parent_seed_exercise_id",
  "variation_descriptor",
  "activity_ids",
  "movement_id",
  "exercise_token_id",
  "equipment_ids",
  "equipment_dependency_status",
  "equipment_fk_closed_by_slice_id",
  "activity_applicability_dependency_status",
  "activity_applicability_dependency_slice_id",
  "source_slice_id",
  "candidate_status",
  "runtime_status",
  "activation_ready",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "engine_runtime_mutation",
  "complete_registry_claim",
  "content_scope",
  "copy_legal_boundary_notes"
]);

const S_REG_15_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const S_REG_15_FORBIDDEN_KEYS = Object.freeze([
  "active_registry_activation",
  "canonical_registry_activation",
  "marker_evaluator",
  "marker_evaluator_result",
  "programme_template_formula",
  "progression_formula",
  "substitution_runtime_change",
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
  "outcome_inference"
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg15CandidateExerciseRegistryContentBatch1Error";
  error.code = S_REG_15_FAILURE_TOKEN;
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

function collectTokenIds(upstream) {
  const tokenDocument = upstream.exercise_token_registry_3b;
  const ids = new Set();

  for (const record of tokenDocument.records) {
    const id = record.exercise_token_id ?? record.token_id ?? record.exercise_id;

    if (typeof id === "string" && id.length > 0) {
      ids.add(id);
    }
  }

  return ids;
}

function collectEquipmentById(equipmentDocument) {
  const equipmentById = new Map();

  for (const record of equipmentDocument.records) {
    equipmentById.set(record.equipment_id, record);
  }

  return equipmentById;
}

function assertNoForbiddenKeys(record, context) {
  for (const key of S_REG_15_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_candidate_exercise_semantic_key", "Candidate exercise records must not contain activation, evaluator, template, substitution, recommendation, ranking, optimisation, capability, readiness, safety, suitability, tactical, return-to-play, effectiveness, or outcome fields.", {
        ...context,
        field: key
      });
    }
  }
}

function assertDocumentBoundary(document) {
  if (!isPlainRecord(document)) {
    fail("candidate_batch_document_invalid", "S-REG-15 candidate batch document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_15_SLICE_ID,
    registry_id: S_REG_15_REGISTRY_ID,
    batch_id: S_REG_15_BATCH_ID,
    registry_target: S_REG_15_REGISTRY_ID,
    source_queue_slice_id: "S-REG-14",
    source_queue_order: 1,
    candidate_status: S_REG_15_CANDIDATE_STATUS,
    runtime_status: S_REG_15_RUNTIME_STATUS,
    content_batch_status: S_REG_15_CONTENT_BATCH_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    record_count: S_REG_15_EXPECTED_RECORD_IDS.length
  })) {
    if (document[field] !== expected) {
      fail("candidate_batch_document_boundary_field_invalid", "S-REG-15 candidate batch document boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  assertExactArray(document.dependency_inputs, ["S-REG-06", "S-REG-08", "S-REG-09"], "dependency_inputs_invalid");

  if (!Array.isArray(document.records)) {
    fail("candidate_batch_records_invalid", "S-REG-15 records must be an array.");
  }

  assertExactArray(
    document.records.map((record) => record.exercise_id),
    S_REG_15_EXPECTED_RECORD_IDS,
    "candidate_batch_record_order_invalid"
  );
}

function assertQueueBoundary() {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();
  const queueItem = manifest.candidate_build_queue.find((entry) => entry.slice_id === S_REG_15_SLICE_ID);
  const constantQueueItem = S_REG_14_BUILD_QUEUE.find((entry) => entry.slice_id === S_REG_15_SLICE_ID);

  if (!queueItem || !constantQueueItem) {
    fail("s_reg_15_queue_item_missing", "S-REG-14 must declare S-REG-15 in the build queue.");
  }

  for (const [field, expected] of Object.entries({
    order: 1,
    slice_id: S_REG_15_SLICE_ID,
    batch_id: S_REG_15_BATCH_ID,
    registry_target: S_REG_15_REGISTRY_ID,
    proof_command: "npm.cmd run proof:s-reg-15",
    content_status_after_slice: S_REG_15_CONTENT_BATCH_STATUS
  })) {
    if (queueItem[field] !== expected) {
      fail("s_reg_15_queue_item_invalid", "S-REG-14 queue item field mismatch.", {
        field,
        expected,
        actual: queueItem[field]
      });
    }

    if (constantQueueItem[field] !== expected) {
      fail("s_reg_15_constant_queue_item_invalid", "S-REG-14 exported queue item field mismatch.", {
        field,
        expected,
        actual: constantQueueItem[field]
      });
    }
  }

  assertExactArray(queueItem.dependency_inputs, ["S-REG-06", "S-REG-08", "S-REG-09"], "s_reg_15_queue_dependencies_invalid");
}

function assertActiveRegistrySurface() {
  const registryIndex = readJson(S_REG_15_CANDIDATE_PATHS.active_registry_index);
  const registryBundle = readJson(S_REG_15_CANDIDATE_PATHS.active_registry_bundle);

  assertExactArray(registryIndex.order, S_REG_15_ACTIVE_REGISTRY_ORDER, "active_registry_index_order_changed");
  assertExactArray(Object.keys(registryBundle.registries ?? {}), S_REG_15_ACTIVE_REGISTRY_ORDER, "active_registry_bundle_changed");
}

function assertRecordBoundary(record, context) {
  if (!isPlainRecord(record)) {
    fail("candidate_exercise_record_invalid", "Candidate exercise record must be a plain object.", context);
  }

  for (const field of S_REG_15_REQUIRED_RECORD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      fail("candidate_exercise_required_field_missing", "Candidate exercise record required field missing.", {
        ...context,
        field
      });
    }
  }

  assertNoForbiddenKeys(record, context);

  requireString(record.exercise_id, "exercise_id", context);
  requireString(record.name, "name", context);
  requireString(record.registry_id, "registry_id", context);
  requireString(record.batch_id, "batch_id", context);
  requireString(record.parent_seed_exercise_id, "parent_seed_exercise_id", context);
  requireString(record.variation_descriptor, "variation_descriptor", context);
  requireStringArray(record.activity_ids, "activity_ids", context);
  requireString(record.movement_id, "movement_id", context);
  requireString(record.exercise_token_id, "exercise_token_id", context);
  requireStringArray(record.equipment_ids, "equipment_ids", context);
  requireString(record.equipment_dependency_status, "equipment_dependency_status", context);
  requireString(record.equipment_fk_closed_by_slice_id, "equipment_fk_closed_by_slice_id", context);
  requireString(record.activity_applicability_dependency_status, "activity_applicability_dependency_status", context);
  requireString(record.activity_applicability_dependency_slice_id, "activity_applicability_dependency_slice_id", context);
  requireString(record.source_slice_id, "source_slice_id", context);
  requireString(record.candidate_status, "candidate_status", context);
  requireString(record.runtime_status, "runtime_status", context);
  requireBoolean(record.activation_ready, "activation_ready", context);
  requireBoolean(record.active_registry_mutation, "active_registry_mutation", context);
  requireBoolean(record.active_bundle_mutation, "active_bundle_mutation", context);
  requireBoolean(record.registry_law_mutation, "registry_law_mutation", context);
  requireBoolean(record.engine_runtime_mutation, "engine_runtime_mutation", context);
  requireBoolean(record.complete_registry_claim, "complete_registry_claim", context);
  requireString(record.content_scope, "content_scope", context);
  requireString(record.copy_legal_boundary_notes, "copy_legal_boundary_notes", context);

  for (const [field, expected] of Object.entries({
    registry_id: S_REG_15_REGISTRY_ID,
    batch_id: S_REG_15_BATCH_ID,
    source_slice_id: S_REG_15_SLICE_ID,
    candidate_status: S_REG_15_CANDIDATE_STATUS,
    runtime_status: S_REG_15_RUNTIME_STATUS,
    activation_ready: false,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    complete_registry_claim: false,
    equipment_dependency_status: S_REG_15_EQUIPMENT_DEPENDENCY_STATUS,
    equipment_fk_closed_by_slice_id: "S-REG-08",
    activity_applicability_dependency_status: S_REG_15_APPLICABILITY_DEPENDENCY_STATUS,
    activity_applicability_dependency_slice_id: "S-REG-09",
    content_scope: "candidate_exercise_identity"
  })) {
    if (record[field] !== expected) {
      fail("candidate_exercise_boundary_field_invalid", "Candidate exercise boundary field mismatch.", {
        ...context,
        field,
        expected,
        actual: record[field]
      });
    }
  }
}

function assertFkClosure(record, upstream, equipmentById, context) {
  const activityIds = new Set(upstream.activity_registry_1.records.map((item) => item.activity_id));
  const movementIds = new Set(upstream.movement_registry_3.records.map((item) => item.movement_id));
  const exerciseIds = new Set(upstream.exercise_registry_3a.records.map((item) => item.exercise_id));
  const tokenIds = collectTokenIds(upstream);
  const parentRecord = upstream.exercise_registry_3a.records.find((item) => item.exercise_id === record.parent_seed_exercise_id);

  if (!parentRecord) {
    fail("parent_seed_exercise_missing", "Candidate exercise parent seed exercise does not exist.", context);
  }

  if (exerciseIds.has(record.exercise_id)) {
    fail("candidate_exercise_id_already_seeded", "S-REG-15 candidate exercise_id must expand beyond the S-REG-06 seed set.", context);
  }

  for (const activityId of record.activity_ids) {
    if (!activityIds.has(activityId)) {
      fail("activity_fk_unknown", "Candidate exercise references unknown activity_id.", {
        ...context,
        activity_id: activityId
      });
    }

    if (!parentRecord.activity_ids.includes(activityId)) {
      fail("activity_fk_not_in_parent_seed", "Candidate exercise activity_id must stay within parent seed activity_ids.", {
        ...context,
        activity_id: activityId
      });
    }
  }

  if (!movementIds.has(record.movement_id)) {
    fail("movement_fk_unknown", "Candidate exercise references unknown movement_id.", context);
  }

  if (record.movement_id !== parentRecord.movement_id) {
    fail("movement_fk_not_in_parent_seed", "Candidate exercise movement_id must match parent seed movement_id.", {
      ...context,
      parent_movement_id: parentRecord.movement_id
    });
  }

  if (!tokenIds.has(record.exercise_token_id)) {
    fail("exercise_token_fk_unknown", "Candidate exercise references unknown exercise_token_id.", context);
  }

  assertExactArray(record.equipment_ids, parentRecord.equipment_ids, "equipment_ids_must_match_parent_seed", context);

  for (const equipmentId of record.equipment_ids) {
    const equipment = equipmentById.get(equipmentId);

    if (!equipment) {
      fail("equipment_fk_unknown", "Candidate exercise references unknown equipment_id.", {
        ...context,
        equipment_id: equipmentId
      });
    }

    if (Array.isArray(equipment.movement_pattern_applicability) && !equipment.movement_pattern_applicability.includes(record.movement_id)) {
      fail("equipment_movement_fk_incompatible", "Candidate exercise equipment does not declare the movement_id.", {
        ...context,
        equipment_id: equipmentId,
        movement_id: record.movement_id
      });
    }

    for (const activityId of record.activity_ids) {
      if (Array.isArray(equipment.activity_applicability) && !equipment.activity_applicability.includes(activityId)) {
        fail("equipment_activity_fk_incompatible", "Candidate exercise equipment does not declare the activity_id.", {
          ...context,
          equipment_id: equipmentId,
          activity_id: activityId
        });
      }
    }
  }
}

export function sReg15CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_15_CANDIDATE_PATHS));
}

export function sReg15LoadCandidateExerciseContentBatch1() {
  return deepFreeze(readJson(S_REG_15_CANDIDATE_PATHS.exercise_registry_3a_batch_1));
}

export function sReg15ValidateCandidateExerciseRegistryContentBatch1({ document, upstream, equipmentDocument } = {}) {
  assertActiveRegistrySurface();
  sReg14ValidateRegistryBuildReadinessStartGate();
  assertQueueBoundary();

  const loadedUpstream = upstream ?? sReg06LoadCandidateSeedFiles();
  const loadedEquipmentDocument = equipmentDocument ?? readJson(S_REG_15_CANDIDATE_PATHS.equipment_registry);
  const loadedDocument = document ?? sReg15LoadCandidateExerciseContentBatch1();

  assertDocumentBoundary(loadedDocument);
  requireUnique(loadedDocument.records, "exercise_id", S_REG_15_REGISTRY_ID);

  const sReg06Result = sReg06ValidateCandidateSeedSurface(loadedUpstream);
  const sReg08Result = sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate({
    upstream: loadedUpstream,
    equipmentDocument: loadedEquipmentDocument
  });
  const sReg09Result = sReg09ValidateExerciseActivityApplicabilityCandidateSeeds({
    upstream: loadedUpstream
  });

  if (!sReg06Result.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate seed surface did not validate.", { s_reg_06_result: sReg06Result });
  }

  if (!sReg08Result.ok) {
    fail("s_reg_08_surface_invalid", "S-REG-08 exercise-equipment FK closure did not validate.", { s_reg_08_result: sReg08Result });
  }

  if (!sReg09Result.ok) {
    fail("s_reg_09_surface_invalid", "S-REG-09 exercise-activity applicability seeds did not validate.", { s_reg_09_result: sReg09Result });
  }

  const equipmentById = collectEquipmentById(loadedEquipmentDocument);

  for (const record of loadedDocument.records) {
    const context = {
      exercise_id: record.exercise_id ?? null,
      batch_id: S_REG_15_BATCH_ID
    };

    assertRecordBoundary(record, context);
    assertFkClosure(record, loadedUpstream, equipmentById, context);
  }

  return deepFreeze({
    ok: true,
    token: S_REG_15_FAILURE_TOKEN,
    slice_id: S_REG_15_SLICE_ID,
    batch_id: S_REG_15_BATCH_ID,
    registry_id: S_REG_15_REGISTRY_ID,
    record_count: loadedDocument.records.length,
    exercise_ids: loadedDocument.records.map((record) => record.exercise_id),
    dependency_inputs: loadedDocument.dependency_inputs,
    activation_ready: false,
    runtime_status: S_REG_15_RUNTIME_STATUS,
    candidate_status: S_REG_15_CANDIDATE_STATUS,
    content_batch_status: S_REG_15_CONTENT_BATCH_STATUS
  });
}