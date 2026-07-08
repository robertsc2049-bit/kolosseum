/**
 * DEV NOTE: S-REG-06 candidate seed validation boundary.
 * Purpose: validates the first canonical candidate seed records for activity,
 * movement, exercise token, and exercise registry planning.
 * Boundary: this module reads only S-REG-06 candidate files under
 * ci/registry/candidates. It must not read active registries, write bundles,
 * alter registry law, or affect deterministic engine runtime behaviour.
 * Determinism: validation is closed over fixed target registry IDs, fixed file
 * paths, fixed maximum record counts, and explicit FK checks.
 * Failure: invalid candidate seeds fail closed with
 * CI_S_REG_06_CANONICAL_ACTIVITY_MOVEMENT_EXERCISE_CANDIDATE_SEEDS.
 */
import fs from "node:fs";

const S_REG_06_SLICE_ID = "S-REG-06";
const S_REG_06_FAILURE_TOKEN = "CI_S_REG_06_CANONICAL_ACTIVITY_MOVEMENT_EXERCISE_CANDIDATE_SEEDS";
const S_REG_06_RUNTIME_STATUS = "non_runtime";
const S_REG_06_CANDIDATE_STATUS = "candidate_content_draft";
const S_REG_06_ALLOWED_EQUIPMENT_DEPENDENCY_STATUSES = Object.freeze([
  "deferred_to_s_reg_07",
  "candidate_equipment_fk_closed"
]);

const S_REG_06_TARGET_REGISTRY_IDS = Object.freeze([
  "activity_registry_1",
  "movement_registry_3",
  "exercise_token_registry_3b",
  "exercise_registry_3a"
]);

const S_REG_06_CANDIDATE_PATHS = Object.freeze({
  activity_registry_1: "ci/registry/candidates/activity_registry_1/activity_registry_1.candidate.registry.json",
  movement_registry_3: "ci/registry/candidates/movement_registry_3/movement_registry_3.candidate.registry.json",
  exercise_token_registry_3b: "ci/registry/candidates/exercise_token_registry_3b/exercise_token_registry_3b.candidate.registry.json",
  exercise_registry_3a: "ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json"
});

const S_REG_06_MAX_RECORD_COUNTS = Object.freeze({
  activity_registry_1: 3,
  movement_registry_3: 4,
  exercise_token_registry_3b: 4,
  exercise_registry_3a: 4
});

const S_REG_06_LOCKED_ACTIVITY_IDS = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg06CandidateSeedError";
  error.code = S_REG_06_FAILURE_TOKEN;
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

function sReg06CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_06_CANDIDATE_PATHS));
}

function sReg06LoadCandidateSeedFiles() {
  const loaded = {};

  for (const registryId of S_REG_06_TARGET_REGISTRY_IDS) {
    loaded[registryId] = readJson(S_REG_06_CANDIDATE_PATHS[registryId]);
  }

  return deepFreeze(loaded);
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

function assertSeedDocumentShape(doc, registryId) {
  if (!isPlainRecord(doc)) {
    fail("candidate_document_invalid", "Candidate document must be a plain object.", { registry_id: registryId });
  }

  if (doc.slice_id !== S_REG_06_SLICE_ID) {
    fail("slice_id_invalid", "Candidate document slice_id mismatch.", {
      registry_id: registryId,
      actual: doc.slice_id
    });
  }

  if (doc.registry_id !== registryId) {
    fail("registry_id_invalid", "Candidate document registry_id mismatch.", {
      registry_id: registryId,
      actual: doc.registry_id
    });
  }

  if (doc.candidate_status !== S_REG_06_CANDIDATE_STATUS) {
    fail("candidate_status_invalid", "Candidate document status must remain candidate_content_draft.", {
      registry_id: registryId,
      actual: doc.candidate_status
    });
  }

  if (doc.runtime_status !== S_REG_06_RUNTIME_STATUS) {
    fail("runtime_status_invalid", "Candidate document runtime_status must remain non_runtime.", {
      registry_id: registryId,
      actual: doc.runtime_status
    });
  }

  for (const field of [
    "active_registry_mutation",
    "active_bundle_mutation",
    "registry_law_mutation",
    "engine_runtime_mutation",
    "high_volume_content_added",
    "activation_ready",
    "complete_registry_claim"
  ]) {
    if (doc[field] !== false) {
      fail("false_boundary_field_invalid", `${field} must be false.`, {
        registry_id: registryId,
        field,
        actual: doc[field]
      });
    }
  }

  if (!Array.isArray(doc.records)) {
    fail("records_invalid", "Candidate records must be an array.", { registry_id: registryId });
  }

  if (doc.records.length === 0) {
    fail("records_empty", "Candidate records must contain a small explicit seed set.", { registry_id: registryId });
  }

  if (doc.records.length > S_REG_06_MAX_RECORD_COUNTS[registryId]) {
    fail("record_count_too_high", "Candidate seed set is larger than the S-REG-06 boundary permits.", {
      registry_id: registryId,
      actual: doc.records.length,
      maximum: S_REG_06_MAX_RECORD_COUNTS[registryId]
    });
  }
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

function sReg06ValidateCandidateSeedSurface(surface) {
  if (!isPlainRecord(surface)) {
    fail("candidate_surface_invalid", "Candidate seed surface must be a plain object.");
  }

  const surfaceRegistryIds = Object.keys(surface);

  if (JSON.stringify(surfaceRegistryIds) !== JSON.stringify(S_REG_06_TARGET_REGISTRY_IDS)) {
    fail("candidate_surface_registry_order_invalid", "Candidate seed surface registry order mismatch.", {
      actual: surfaceRegistryIds,
      expected: [...S_REG_06_TARGET_REGISTRY_IDS]
    });
  }

  for (const registryId of S_REG_06_TARGET_REGISTRY_IDS) {
    assertSeedDocumentShape(surface[registryId], registryId);
  }

  const activityRecords = surface.activity_registry_1.records;
  const movementRecords = surface.movement_registry_3.records;
  const tokenRecords = surface.exercise_token_registry_3b.records;
  const exerciseRecords = surface.exercise_registry_3a.records;

  const activityIds = requireUnique(activityRecords, "activity_id", "activity_registry_1");
  const movementIds = requireUnique(movementRecords, "movement_id", "movement_registry_3");
  const tokenIds = requireUnique(tokenRecords, "exercise_token_id", "exercise_token_registry_3b");
  const exerciseIds = requireUnique(exerciseRecords, "exercise_id", "exercise_registry_3a");

  for (const expectedActivityId of S_REG_06_LOCKED_ACTIVITY_IDS) {
    if (!activityIds.has(expectedActivityId)) {
      fail("locked_activity_missing", "S-REG-06 seed must include the locked v1 activity ids.", {
        activity_id: expectedActivityId
      });
    }
  }

  for (const activity of activityRecords) {
    requireString(activity.display_label, "display_label", { registry_id: "activity_registry_1", activity_id: activity.activity_id });
    requireString(activity.activity_kind, "activity_kind", { registry_id: "activity_registry_1", activity_id: activity.activity_id });
    requireStringArray(activity.allowed_movement_ids, "allowed_movement_ids", { registry_id: "activity_registry_1", activity_id: activity.activity_id });
  }

  for (const movement of movementRecords) {
    requireString(movement.display_label, "display_label", { registry_id: "movement_registry_3", movement_id: movement.movement_id });
    requireStringArray(movement.activity_ids, "activity_ids", { registry_id: "movement_registry_3", movement_id: movement.movement_id });
    assertSubset(movement.activity_ids, activityIds, "activity_ids", {
      registry_id: "movement_registry_3",
      movement_id: movement.movement_id
    });
  }

  const tokenMovementById = new Map();

  for (const token of tokenRecords) {
    requireString(token.display_label, "display_label", { registry_id: "exercise_token_registry_3b", exercise_token_id: token.exercise_token_id });
    requireString(token.movement_id, "movement_id", { registry_id: "exercise_token_registry_3b", exercise_token_id: token.exercise_token_id });
    requireStringArray(token.activity_ids, "activity_ids", { registry_id: "exercise_token_registry_3b", exercise_token_id: token.exercise_token_id });
    assertSubset(token.activity_ids, activityIds, "activity_ids", {
      registry_id: "exercise_token_registry_3b",
      exercise_token_id: token.exercise_token_id
    });

    if (!movementIds.has(token.movement_id)) {
      fail("fk_reference_unknown", "exercise token movement_id references an unknown movement.", {
        registry_id: "exercise_token_registry_3b",
        exercise_token_id: token.exercise_token_id,
        movement_id: token.movement_id
      });
    }

    tokenMovementById.set(token.exercise_token_id, token.movement_id);
  }

  const exerciseEquipmentDependencyStatuses = new Set();

  for (const exercise of exerciseRecords) {
    requireString(exercise.display_label, "display_label", { registry_id: "exercise_registry_3a", exercise_id: exercise.exercise_id });
    requireString(exercise.movement_id, "movement_id", { registry_id: "exercise_registry_3a", exercise_id: exercise.exercise_id });
    requireString(exercise.exercise_token_id, "exercise_token_id", { registry_id: "exercise_registry_3a", exercise_id: exercise.exercise_id });
    requireStringArray(exercise.activity_ids, "activity_ids", { registry_id: "exercise_registry_3a", exercise_id: exercise.exercise_id });

    assertSubset(exercise.activity_ids, activityIds, "activity_ids", {
      registry_id: "exercise_registry_3a",
      exercise_id: exercise.exercise_id
    });

    if (!movementIds.has(exercise.movement_id)) {
      fail("fk_reference_unknown", "exercise movement_id references an unknown movement.", {
        registry_id: "exercise_registry_3a",
        exercise_id: exercise.exercise_id,
        movement_id: exercise.movement_id
      });
    }

    if (!tokenIds.has(exercise.exercise_token_id)) {
      fail("fk_reference_unknown", "exercise exercise_token_id references an unknown exercise token.", {
        registry_id: "exercise_registry_3a",
        exercise_id: exercise.exercise_id,
        exercise_token_id: exercise.exercise_token_id
      });
    }

    if (tokenMovementById.get(exercise.exercise_token_id) !== exercise.movement_id) {
      fail("token_movement_mismatch", "exercise token movement must match exercise movement.", {
        registry_id: "exercise_registry_3a",
        exercise_id: exercise.exercise_id,
        exercise_token_id: exercise.exercise_token_id,
        movement_id: exercise.movement_id,
        token_movement_id: tokenMovementById.get(exercise.exercise_token_id)
      });
    }

    if (!Array.isArray(exercise.equipment_ids)) {
      fail("equipment_ids_invalid", "S-REG-06 exercise equipment_ids must be an explicit array.", {
        registry_id: "exercise_registry_3a",
        exercise_id: exercise.exercise_id
      });
    }

    if (!S_REG_06_ALLOWED_EQUIPMENT_DEPENDENCY_STATUSES.includes(exercise.equipment_dependency_status)) {
      fail("equipment_dependency_status_invalid", "S-REG-06 exercise equipment dependency status is outside the allowed candidate states.", {
        registry_id: "exercise_registry_3a",
        exercise_id: exercise.exercise_id,
        actual: exercise.equipment_dependency_status
      });
    }

    if (exercise.equipment_dependency_status === "deferred_to_s_reg_07" && exercise.equipment_ids.length !== 0) {
      fail("equipment_ids_not_deferred", "Deferred S-REG-06 exercise equipment_ids must remain empty.", {
        registry_id: "exercise_registry_3a",
        exercise_id: exercise.exercise_id
      });
    }

    if (exercise.equipment_dependency_status === "candidate_equipment_fk_closed") {
      requireStringArray(exercise.equipment_ids, "equipment_ids", {
        registry_id: "exercise_registry_3a",
        exercise_id: exercise.exercise_id
      });
    }

    exerciseEquipmentDependencyStatuses.add(exercise.equipment_dependency_status);

    if (exercise.activation_ready !== false) {
      fail("exercise_activation_ready_invalid", "S-REG-06 exercise records must not be activation ready.", {
        registry_id: "exercise_registry_3a",
        exercise_id: exercise.exercise_id
      });
    }
  }

  if (exerciseEquipmentDependencyStatuses.size !== 1) {
    fail("mixed_equipment_dependency_status", "S-REG-06 exercise candidate records must share one equipment dependency status.", {
      statuses: [...exerciseEquipmentDependencyStatuses]
    });
  }

  const [exerciseEquipmentDependencyStatus] = [...exerciseEquipmentDependencyStatuses];

  return deepFreeze({
    ok: true,
    slice_id: S_REG_06_SLICE_ID,
    target_registry_count: S_REG_06_TARGET_REGISTRY_IDS.length,
    activity_count: activityIds.size,
    movement_count: movementIds.size,
    exercise_token_count: tokenIds.size,
    exercise_count: exerciseIds.size,
    equipment_dependency_status: exerciseEquipmentDependencyStatus,
    runtime_status: S_REG_06_RUNTIME_STATUS
  });
}

export {
  S_REG_06_CANDIDATE_PATHS,
  S_REG_06_CANDIDATE_STATUS,
  S_REG_06_FAILURE_TOKEN,
  S_REG_06_LOCKED_ACTIVITY_IDS,
  S_REG_06_MAX_RECORD_COUNTS,
  S_REG_06_RUNTIME_STATUS,
  S_REG_06_SLICE_ID,
  S_REG_06_TARGET_REGISTRY_IDS,
  sReg06CandidatePaths,
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
};