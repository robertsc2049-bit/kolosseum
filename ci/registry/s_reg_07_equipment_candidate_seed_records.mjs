/**
 * DEV NOTE: S-REG-07 equipment candidate seed validation boundary.
 * Purpose: validates the first canonical equipment candidate seed records and
 * their FK references to S-REG-06 activity and movement candidates.
 * Boundary: this module reads candidate files only. It must not read active
 * registries, write generated bundles, alter registry law, mutate S-REG-06
 * exercise candidates, or affect deterministic engine runtime behaviour.
 * Determinism: validation is closed over one target candidate file, fixed
 * upstream S-REG-06 candidate files, fixed maximum record count, and explicit
 * FK checks.
 * Failure: invalid equipment candidates fail closed with
 * CI_S_REG_07_CANONICAL_EQUIPMENT_CANDIDATE_SEEDS.
 */
import fs from "node:fs";

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

const S_REG_07_SLICE_ID = "S-REG-07";
const S_REG_07_FAILURE_TOKEN = "CI_S_REG_07_CANONICAL_EQUIPMENT_CANDIDATE_SEEDS";
const S_REG_07_RUNTIME_STATUS = "non_runtime";
const S_REG_07_CANDIDATE_STATUS = "candidate_content_draft";
const S_REG_07_REGISTRY_ID = "equipment_registry";
const S_REG_07_MAX_RECORD_COUNT = 6;

const S_REG_07_CANDIDATE_PATHS = Object.freeze({
  equipment_registry: "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json"
});

const S_REG_07_REQUIRED_EQUIPMENT_FIELDS = Object.freeze([
  "equipment_id",
  "display_label",
  "equipment_class",
  "activity_applicability",
  "movement_pattern_applicability",
  "substitution_relevance",
  "template_relevance",
  "low_equipment_alternative_relevance",
  "copy_legal_boundary_notes"
]);

const S_REG_07_REQUIRED_SEED_EQUIPMENT_IDS = Object.freeze([
  "barbell",
  "rack",
  "bench",
  "plate",
  "bodyweight",
  "open_floor_space"
]);

const S_REG_07_EXERCISE_SEED_MOVEMENT_REQUIREMENTS = Object.freeze({
  back_squat: "squat",
  deadlift: "hinge",
  bench_press: "horizontal_push",
  front_plank: "brace"
});

const S_REG_07_FORBIDDEN_OPERATIONAL_TERMS = Object.freeze([
  ["gym", "inventory"].join("_"),
  "epos",
  ["access", "control"].join("_"),
  ["door", "access"].join("_"),
  "scanner",
  "turnstile",
  ["stock", "count"].join("_"),
  ["purchase", "price"].join("_"),
  ["sale", "price"].join("_")
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg07EquipmentCandidateSeedError";
  error.code = S_REG_07_FAILURE_TOKEN;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  throw error;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function sReg07CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_07_CANDIDATE_PATHS));
}

function sReg07LoadEquipmentCandidateSeedFile() {
  return deepFreeze(readJson(S_REG_07_CANDIDATE_PATHS.equipment_registry));
}

function requireString(value, field, context) {
  if (typeof value !== "string" || value.length === 0) {
    fail("required_string_invalid", `${field} must be a non-empty string.`, context);
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

function assertSubset(values, allowed, field, context) {
  for (const value of values) {
    if (!allowed.has(value)) {
      fail("fk_reference_unknown", `${field} references an unknown upstream id.`, {
        ...context,
        field,
        value
      });
    }
  }
}

function assertNoOperationalEquipmentScope(record) {
  const text = JSON.stringify(record).toLowerCase();

  for (const term of S_REG_07_FORBIDDEN_OPERATIONAL_TERMS) {
    if (text.includes(term.toLowerCase())) {
      fail("forbidden_operational_equipment_scope", "Equipment candidate must not contain operational inventory or access-control scope.", {
        equipment_id: record.equipment_id ?? null,
        term
      });
    }
  }
}

function assertEquipmentDocumentShape(doc) {
  if (!isPlainRecord(doc)) {
    fail("candidate_document_invalid", "Equipment candidate document must be a plain object.", {
      registry_id: S_REG_07_REGISTRY_ID
    });
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_07_SLICE_ID,
    registry_id: S_REG_07_REGISTRY_ID,
    candidate_status: S_REG_07_CANDIDATE_STATUS,
    runtime_status: S_REG_07_RUNTIME_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false
  })) {
    if (doc[field] !== expected) {
      fail("candidate_boundary_field_invalid", "Equipment candidate boundary field mismatch.", {
        registry_id: S_REG_07_REGISTRY_ID,
        field,
        expected,
        actual: doc[field]
      });
    }
  }

  if (JSON.stringify(doc.depends_on) !== JSON.stringify(["activity_registry_1", "movement_registry_3"])) {
    fail("dependency_order_invalid", "Equipment candidate dependency order mismatch.", {
      registry_id: S_REG_07_REGISTRY_ID,
      actual: doc.depends_on
    });
  }

  if (!Array.isArray(doc.records)) {
    fail("records_invalid", "Equipment candidate records must be an array.", {
      registry_id: S_REG_07_REGISTRY_ID
    });
  }

  if (doc.records.length === 0) {
    fail("records_empty", "Equipment candidate records must contain a small explicit seed set.", {
      registry_id: S_REG_07_REGISTRY_ID
    });
  }

  if (doc.records.length > S_REG_07_MAX_RECORD_COUNT) {
    fail("record_count_too_high", "Equipment candidate seed set is larger than the S-REG-07 boundary permits.", {
      registry_id: S_REG_07_REGISTRY_ID,
      actual: doc.records.length,
      maximum: S_REG_07_MAX_RECORD_COUNT
    });
  }
}

function assertEquipmentRecordShape(record) {
  if (!isPlainRecord(record)) {
    fail("equipment_record_invalid", "Equipment candidate record must be a plain object.");
  }

  for (const field of S_REG_07_REQUIRED_EQUIPMENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      fail("required_equipment_field_missing", "Equipment candidate record is missing a required field.", {
        equipment_id: record.equipment_id ?? null,
        field
      });
    }
  }

  for (const field of [
    "equipment_id",
    "display_label",
    "equipment_class",
    "substitution_relevance",
    "template_relevance",
    "low_equipment_alternative_relevance",
    "copy_legal_boundary_notes"
  ]) {
    requireString(record[field], field, {
      registry_id: S_REG_07_REGISTRY_ID,
      equipment_id: record.equipment_id ?? null
    });
  }

  requireStringArray(record.activity_applicability, "activity_applicability", {
    registry_id: S_REG_07_REGISTRY_ID,
    equipment_id: record.equipment_id
  });

  requireStringArray(record.movement_pattern_applicability, "movement_pattern_applicability", {
    registry_id: S_REG_07_REGISTRY_ID,
    equipment_id: record.equipment_id
  });

  assertNoOperationalEquipmentScope(record);
}

function sReg07ValidateEquipmentCandidateSeedSurface({ equipmentDocument, upstreamSurface } = {}) {
  const upstream = upstreamSurface ?? sReg06LoadCandidateSeedFiles();
  const upstreamResult = sReg06ValidateCandidateSeedSurface(upstream);

  if (!upstreamResult.ok) {
    fail("upstream_s_reg_06_invalid", "S-REG-06 upstream candidate seed surface is invalid.", {
      upstream_result: upstreamResult
    });
  }

  const doc = equipmentDocument ?? sReg07LoadEquipmentCandidateSeedFile();
  assertEquipmentDocumentShape(doc);

  const activityIds = requireUnique(upstream.activity_registry_1.records, "activity_id", "activity_registry_1");
  const movementIds = requireUnique(upstream.movement_registry_3.records, "movement_id", "movement_registry_3");
  const exerciseRecords = upstream.exercise_registry_3a.records;

  const equipmentIds = requireUnique(doc.records, "equipment_id", S_REG_07_REGISTRY_ID);
  const movementCoverage = new Map([...movementIds].map((movementId) => [movementId, new Set()]));

  for (const requiredEquipmentId of S_REG_07_REQUIRED_SEED_EQUIPMENT_IDS) {
    if (!equipmentIds.has(requiredEquipmentId)) {
      fail("required_seed_equipment_missing", "S-REG-07 equipment seed set is missing a required seed equipment id.", {
        equipment_id: requiredEquipmentId
      });
    }
  }

  for (const record of doc.records) {
    assertEquipmentRecordShape(record);

    assertSubset(record.activity_applicability, activityIds, "activity_applicability", {
      registry_id: S_REG_07_REGISTRY_ID,
      equipment_id: record.equipment_id
    });

    assertSubset(record.movement_pattern_applicability, movementIds, "movement_pattern_applicability", {
      registry_id: S_REG_07_REGISTRY_ID,
      equipment_id: record.equipment_id
    });

    for (const movementId of record.movement_pattern_applicability) {
      movementCoverage.get(movementId).add(record.equipment_id);
    }
  }

  for (const [exerciseId, movementId] of Object.entries(S_REG_07_EXERCISE_SEED_MOVEMENT_REQUIREMENTS)) {
    if (!movementCoverage.has(movementId) || movementCoverage.get(movementId).size === 0) {
      fail("exercise_seed_movement_equipment_support_missing", "S-REG-07 equipment seeds must cover S-REG-06 exercise seed movement dependencies for a later FK closure slice.", {
        exercise_id: exerciseId,
        movement_id: movementId
      });
    }
  }

  for (const exercise of exerciseRecords) {
    if (!Array.isArray(exercise.equipment_ids) || exercise.equipment_ids.length !== 0) {
      fail("s_reg_06_exercise_equipment_mutated", "S-REG-07 must not mutate S-REG-06 exercise equipment_ids.", {
        exercise_id: exercise.exercise_id
      });
    }

    if (exercise.equipment_dependency_status !== "deferred_to_s_reg_07") {
      fail("s_reg_06_exercise_dependency_status_mutated", "S-REG-07 must not mutate S-REG-06 exercise equipment dependency status.", {
        exercise_id: exercise.exercise_id,
        actual: exercise.equipment_dependency_status
      });
    }

    if (exercise.activation_ready !== false) {
      fail("s_reg_06_exercise_activation_status_mutated", "S-REG-07 must not mark S-REG-06 exercise candidates activation ready.", {
        exercise_id: exercise.exercise_id
      });
    }
  }

  return deepFreeze({
    ok: true,
    slice_id: S_REG_07_SLICE_ID,
    registry_id: S_REG_07_REGISTRY_ID,
    equipment_count: equipmentIds.size,
    required_seed_equipment_count: S_REG_07_REQUIRED_SEED_EQUIPMENT_IDS.length,
    upstream_activity_count: activityIds.size,
    upstream_movement_count: movementIds.size,
    s_reg_06_exercise_dependency_status: "deferred_to_s_reg_07",
    s_reg_08_dependency: "exercise_equipment_fk_closure",
    runtime_status: S_REG_07_RUNTIME_STATUS
  });
}

export {
  S_REG_07_CANDIDATE_PATHS,
  S_REG_07_CANDIDATE_STATUS,
  S_REG_07_EXERCISE_SEED_MOVEMENT_REQUIREMENTS,
  S_REG_07_FAILURE_TOKEN,
  S_REG_07_MAX_RECORD_COUNT,
  S_REG_07_REGISTRY_ID,
  S_REG_07_REQUIRED_EQUIPMENT_FIELDS,
  S_REG_07_REQUIRED_SEED_EQUIPMENT_IDS,
  S_REG_07_RUNTIME_STATUS,
  S_REG_07_SLICE_ID,
  sReg07CandidatePaths,
  sReg07LoadEquipmentCandidateSeedFile,
  sReg07ValidateEquipmentCandidateSeedSurface
};