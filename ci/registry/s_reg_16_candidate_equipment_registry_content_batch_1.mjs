import fs from "node:fs";

/**
 * DEV NOTE: S-REG-16 candidate equipment registry content batch 1.
 * Purpose: validates the first inert candidate content expansion batch for
 * equipment_registry after S-REG-15.
 * Boundary: candidate equipment identity records only. This module must not
 * activate registries, alter the active registry bundle, alter registry law,
 * change engine runtime behaviour, create programme template logic, create
 * substitution behaviour, create exercise-equipment closure expansion, or
 * create marker evaluator behaviour.
 * Determinism: validation is closed over fixed candidate paths, exact batch
 * order, exact dependency inputs, fixed expected equipment ids, and upstream
 * activity/movement/equipment seed sets from S-REG-06, S-REG-07, and S-REG-15.
 * Failure: invalid content fails closed with
 * CI_S_REG_16_CANDIDATE_EQUIPMENT_REGISTRY_CONTENT_BATCH_1.
 */

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  S_REG_15_EXPECTED_RECORD_IDS,
  sReg15LoadCandidateExerciseContentBatch1,
  sReg15ValidateCandidateExerciseRegistryContentBatch1
} from "./s_reg_15_candidate_exercise_registry_content_batch_1.mjs";

import {
  S_REG_14_BUILD_QUEUE,
  sReg14LoadRegistryBuildReadinessManifest,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "./s_reg_14_registry_build_readiness_start_gate.mjs";

export const S_REG_16_SLICE_ID = "S-REG-16";
export const S_REG_16_FAILURE_TOKEN = "CI_S_REG_16_CANDIDATE_EQUIPMENT_REGISTRY_CONTENT_BATCH_1";
export const S_REG_16_RUNTIME_STATUS = "non_runtime";
export const S_REG_16_CANDIDATE_STATUS = "candidate_content_draft";
export const S_REG_16_BATCH_ID = "candidate_equipment_registry_content_expansion_batch_1";
export const S_REG_16_REGISTRY_ID = "equipment_registry";
export const S_REG_16_CONTENT_BATCH_STATUS = "candidate_content_expanded_inert";

export const S_REG_16_CANDIDATE_PATHS = Object.freeze({
  equipment_registry_batch_1: "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.json",
  s_reg_07_equipment_registry: "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json",
  active_registry_index: "registries/registry_index.json",
  active_registry_bundle: "registries/registry_bundle.json"
});

export const S_REG_16_EXPECTED_RECORD_IDS = Object.freeze([
  "dumbbell",
  "kettlebell",
  "adjustable_bench",
  "pull_up_bar",
  "cable_machine",
  "resistance_band"
]);

export const S_REG_16_SEED_EQUIPMENT_IDS = Object.freeze([
  "barbell",
  "rack",
  "bench",
  "plate",
  "bodyweight",
  "open_floor_space"
]);

export const S_REG_16_REQUIRED_RECORD_FIELDS = Object.freeze([
  "equipment_id",
  "display_label",
  "equipment_class",
  "equipment_type",
  "registry_id",
  "batch_id",
  "activity_applicability",
  "movement_pattern_applicability",
  "substitution_relevance",
  "template_relevance",
  "low_equipment_alternative_relevance",
  "source_slice_id",
  "candidate_status",
  "runtime_status",
  "activation_ready",
  "active_registry_mutation",
  "active_bundle_mutation",
  "registry_law_mutation",
  "engine_runtime_mutation",
  "complete_registry_claim",
  "exercise_equipment_fk_closure_mutation",
  "equipment_scope",
  "copy_legal_boundary_notes"
]);

const S_REG_16_ACTIVE_REGISTRY_ORDER = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const S_REG_16_FORBIDDEN_KEYS = Object.freeze([
  "active_registry_activation",
  "canonical_registry_activation",
  "exercise_ids",
  "assigned_exercise_ids",
  "exercise_equipment_fk_closure",
  "exercise_equipment_fk_closure_batch",
  "equipment_assignment",
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
  "outcome_inference",
  "marketplace_equipment_logic",
  "facility_runtime_logic",
  "organisation_runtime_logic"
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg16CandidateEquipmentRegistryContentBatch1Error";
  error.code = S_REG_16_FAILURE_TOKEN;
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

function assertNoForbiddenKeys(record, context) {
  for (const key of S_REG_16_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_candidate_equipment_semantic_key", "Candidate equipment records must not contain activation, exercise-assignment, FK-closure, evaluator, template, substitution, recommendation, ranking, optimisation, capability, readiness, safety, suitability, tactical, return-to-play, effectiveness, outcome, marketplace, facility, or organisation fields.", {
        ...context,
        field: key
      });
    }
  }
}

function assertDocumentBoundary(document) {
  if (!isPlainRecord(document)) {
    fail("candidate_batch_document_invalid", "S-REG-16 candidate batch document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_16_SLICE_ID,
    registry_id: S_REG_16_REGISTRY_ID,
    batch_id: S_REG_16_BATCH_ID,
    registry_target: S_REG_16_REGISTRY_ID,
    source_queue_slice_id: "S-REG-14",
    source_queue_order: 2,
    candidate_status: S_REG_16_CANDIDATE_STATUS,
    runtime_status: S_REG_16_RUNTIME_STATUS,
    content_batch_status: S_REG_16_CONTENT_BATCH_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    exercise_equipment_fk_closure_mutation: false,
    record_count: S_REG_16_EXPECTED_RECORD_IDS.length
  })) {
    if (document[field] !== expected) {
      fail("candidate_batch_document_boundary_field_invalid", "S-REG-16 candidate batch document boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  assertExactArray(document.dependency_inputs, ["S-REG-07", "S-REG-15"], "dependency_inputs_invalid");

  if (!Array.isArray(document.records)) {
    fail("candidate_batch_records_invalid", "S-REG-16 records must be an array.");
  }

  assertExactArray(
    document.records.map((record) => record.equipment_id),
    S_REG_16_EXPECTED_RECORD_IDS,
    "candidate_batch_record_order_invalid"
  );
}

function assertQueueBoundary() {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();
  const queueItem = manifest.candidate_build_queue.find((entry) => entry.slice_id === S_REG_16_SLICE_ID);
  const constantQueueItem = S_REG_14_BUILD_QUEUE.find((entry) => entry.slice_id === S_REG_16_SLICE_ID);

  if (!queueItem || !constantQueueItem) {
    fail("s_reg_16_queue_item_missing", "S-REG-14 must declare S-REG-16 in the build queue.");
  }

  for (const [field, expected] of Object.entries({
    order: 2,
    slice_id: S_REG_16_SLICE_ID,
    batch_id: S_REG_16_BATCH_ID,
    registry_target: S_REG_16_REGISTRY_ID,
    proof_command: "npm.cmd run proof:s-reg-16",
    content_status_after_slice: S_REG_16_CONTENT_BATCH_STATUS
  })) {
    if (queueItem[field] !== expected) {
      fail("s_reg_16_queue_item_invalid", "S-REG-14 queue item field mismatch.", {
        field,
        expected,
        actual: queueItem[field]
      });
    }

    if (constantQueueItem[field] !== expected) {
      fail("s_reg_16_constant_queue_item_invalid", "S-REG-14 exported queue item field mismatch.", {
        field,
        expected,
        actual: constantQueueItem[field]
      });
    }
  }

  assertExactArray(queueItem.dependency_inputs, ["S-REG-07", "S-REG-15"], "s_reg_16_queue_dependencies_invalid");
}

function assertActiveRegistrySurface() {
  const registryIndex = readJson(S_REG_16_CANDIDATE_PATHS.active_registry_index);
  const registryBundle = readJson(S_REG_16_CANDIDATE_PATHS.active_registry_bundle);

  assertExactArray(
    registryIndex.order.slice(0, S_REG_16_ACTIVE_REGISTRY_ORDER.length),
    S_REG_16_ACTIVE_REGISTRY_ORDER,
    "active_registry_index_order_changed"
  );
  assertExactArray(
    Object.keys(registryBundle.registries ?? {}).slice(0, S_REG_16_ACTIVE_REGISTRY_ORDER.length),
    S_REG_16_ACTIVE_REGISTRY_ORDER,
    "active_registry_bundle_changed"
  );
}

function assertSReg07SeedEquipmentDocument(document) {
  if (!isPlainRecord(document)) {
    fail("s_reg_07_equipment_document_invalid", "S-REG-07 equipment document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: "S-REG-07",
    registry_id: S_REG_16_REGISTRY_ID,
    candidate_status: S_REG_16_CANDIDATE_STATUS,
    runtime_status: S_REG_16_RUNTIME_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false
  })) {
    if (document[field] !== expected) {
      fail("s_reg_07_equipment_boundary_field_invalid", "S-REG-07 equipment seed document boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  assertExactArray(document.depends_on, ["activity_registry_1", "movement_registry_3"], "s_reg_07_depends_on_invalid");
  assertExactArray(document.records.map((record) => record.equipment_id), S_REG_16_SEED_EQUIPMENT_IDS, "s_reg_07_seed_equipment_order_invalid");
}

function assertSReg15Dependency(document) {
  const result = sReg15ValidateCandidateExerciseRegistryContentBatch1({ document });

  if (!result.ok) {
    fail("s_reg_15_dependency_invalid", "S-REG-15 candidate exercise batch did not validate.", { result });
  }

  assertExactArray(result.exercise_ids, S_REG_15_EXPECTED_RECORD_IDS, "s_reg_15_dependency_exercise_ids_invalid");
}

function assertRecordBoundary(record, context) {
  if (!isPlainRecord(record)) {
    fail("candidate_equipment_record_invalid", "Candidate equipment record must be a plain object.", context);
  }

  for (const field of S_REG_16_REQUIRED_RECORD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      fail("candidate_equipment_required_field_missing", "Candidate equipment record required field missing.", {
        ...context,
        field
      });
    }
  }

  assertNoForbiddenKeys(record, context);

  requireString(record.equipment_id, "equipment_id", context);
  requireString(record.display_label, "display_label", context);
  requireString(record.equipment_class, "equipment_class", context);
  requireString(record.equipment_type, "equipment_type", context);
  requireString(record.registry_id, "registry_id", context);
  requireString(record.batch_id, "batch_id", context);
  requireStringArray(record.activity_applicability, "activity_applicability", context);
  requireStringArray(record.movement_pattern_applicability, "movement_pattern_applicability", context);
  requireString(record.substitution_relevance, "substitution_relevance", context);
  requireString(record.template_relevance, "template_relevance", context);
  requireString(record.low_equipment_alternative_relevance, "low_equipment_alternative_relevance", context);
  requireString(record.source_slice_id, "source_slice_id", context);
  requireString(record.candidate_status, "candidate_status", context);
  requireString(record.runtime_status, "runtime_status", context);
  requireBoolean(record.activation_ready, "activation_ready", context);
  requireBoolean(record.active_registry_mutation, "active_registry_mutation", context);
  requireBoolean(record.active_bundle_mutation, "active_bundle_mutation", context);
  requireBoolean(record.registry_law_mutation, "registry_law_mutation", context);
  requireBoolean(record.engine_runtime_mutation, "engine_runtime_mutation", context);
  requireBoolean(record.complete_registry_claim, "complete_registry_claim", context);
  requireBoolean(record.exercise_equipment_fk_closure_mutation, "exercise_equipment_fk_closure_mutation", context);
  requireString(record.equipment_scope, "equipment_scope", context);
  requireString(record.copy_legal_boundary_notes, "copy_legal_boundary_notes", context);

  for (const [field, expected] of Object.entries({
    registry_id: S_REG_16_REGISTRY_ID,
    batch_id: S_REG_16_BATCH_ID,
    substitution_relevance: "candidate_equipment_class_only",
    template_relevance: "candidate_equipment_class_only",
    low_equipment_alternative_relevance: "candidate_low_equipment_relation_only",
    source_slice_id: S_REG_16_SLICE_ID,
    candidate_status: S_REG_16_CANDIDATE_STATUS,
    runtime_status: S_REG_16_RUNTIME_STATUS,
    activation_ready: false,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    complete_registry_claim: false,
    exercise_equipment_fk_closure_mutation: false,
    equipment_scope: "candidate_equipment_identity",
    copy_legal_boundary_notes: "factual equipment label only"
  })) {
    if (record[field] !== expected) {
      fail("candidate_equipment_boundary_field_invalid", "Candidate equipment boundary field mismatch.", {
        ...context,
        field,
        expected,
        actual: record[field]
      });
    }
  }
}

function assertFkClosure(record, upstream, seedEquipmentDocument, context) {
  const activityIds = new Set(upstream.activity_registry_1.records.map((item) => item.activity_id));
  const movementIds = new Set(upstream.movement_registry_3.records.map((item) => item.movement_id));
  const seedEquipmentIds = new Set(seedEquipmentDocument.records.map((item) => item.equipment_id));

  if (seedEquipmentIds.has(record.equipment_id)) {
    fail("candidate_equipment_id_already_seeded", "S-REG-16 candidate equipment_id must expand beyond the S-REG-07 seed set.", context);
  }

  for (const activityId of record.activity_applicability) {
    if (!activityIds.has(activityId)) {
      fail("activity_fk_unknown", "Candidate equipment references unknown activity_id.", {
        ...context,
        activity_id: activityId
      });
    }
  }

  for (const movementId of record.movement_pattern_applicability) {
    if (!movementIds.has(movementId)) {
      fail("movement_fk_unknown", "Candidate equipment references unknown movement_id.", {
        ...context,
        movement_id: movementId
      });
    }
  }
}

export function sReg16CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_16_CANDIDATE_PATHS));
}

export function sReg16LoadCandidateEquipmentContentBatch1() {
  return deepFreeze(readJson(S_REG_16_CANDIDATE_PATHS.equipment_registry_batch_1));
}

export function sReg16ValidateCandidateEquipmentRegistryContentBatch1({
  document,
  upstream,
  seedEquipmentDocument,
  sReg15Document
} = {}) {
  assertActiveRegistrySurface();
  sReg14ValidateRegistryBuildReadinessStartGate();
  assertQueueBoundary();

  const loadedUpstream = upstream ?? sReg06LoadCandidateSeedFiles();
  const loadedSeedEquipmentDocument = seedEquipmentDocument ?? readJson(S_REG_16_CANDIDATE_PATHS.s_reg_07_equipment_registry);
  const loadedSReg15Document = sReg15Document ?? sReg15LoadCandidateExerciseContentBatch1();
  const loadedDocument = document ?? sReg16LoadCandidateEquipmentContentBatch1();

  assertDocumentBoundary(loadedDocument);
  requireUnique(loadedDocument.records, "equipment_id", S_REG_16_REGISTRY_ID);

  const sReg06Result = sReg06ValidateCandidateSeedSurface(loadedUpstream);

  if (!sReg06Result.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate seed surface did not validate.", { s_reg_06_result: sReg06Result });
  }

  assertSReg07SeedEquipmentDocument(loadedSeedEquipmentDocument);
  assertSReg15Dependency(loadedSReg15Document);

  for (const record of loadedDocument.records) {
    const context = {
      equipment_id: record.equipment_id ?? null,
      batch_id: S_REG_16_BATCH_ID
    };

    assertRecordBoundary(record, context);
    assertFkClosure(record, loadedUpstream, loadedSeedEquipmentDocument, context);
  }

  return deepFreeze({
    ok: true,
    token: S_REG_16_FAILURE_TOKEN,
    slice_id: S_REG_16_SLICE_ID,
    batch_id: S_REG_16_BATCH_ID,
    registry_id: S_REG_16_REGISTRY_ID,
    record_count: loadedDocument.records.length,
    equipment_ids: loadedDocument.records.map((record) => record.equipment_id),
    dependency_inputs: loadedDocument.dependency_inputs,
    activation_ready: false,
    runtime_status: S_REG_16_RUNTIME_STATUS,
    candidate_status: S_REG_16_CANDIDATE_STATUS,
    content_batch_status: S_REG_16_CONTENT_BATCH_STATUS,
    exercise_equipment_fk_closure_mutation: false
  });
}