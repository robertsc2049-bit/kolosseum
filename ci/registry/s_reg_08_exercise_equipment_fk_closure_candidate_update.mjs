/**
 * DEV NOTE: S-REG-08 exercise-equipment candidate FK closure boundary.
 * Purpose: validates that the inert exercise candidate seed records reference
 * the inert equipment candidate seed records added by S-REG-07.
 * Boundary: this module reads candidate files only. It must not read active
 * registries, write generated bundles, alter registry law, activate canonical
 * registries, or affect deterministic engine runtime behaviour.
 * Determinism: validation is closed over the fixed S-REG-06 exercise seed set,
 * the fixed S-REG-07 equipment seed set, and exact expected equipment IDs.
 * Failure: invalid candidate FK closure fails closed with
 * CI_S_REG_08_EXERCISE_EQUIPMENT_FK_CLOSURE_CANDIDATE_UPDATE.
 */
import fs from "node:fs";

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  sReg07LoadEquipmentCandidateSeedFile,
  sReg07ValidateEquipmentCandidateSeedSurface
} from "./s_reg_07_equipment_candidate_seed_records.mjs";

const S_REG_08_SLICE_ID = "S-REG-08";
const S_REG_08_FAILURE_TOKEN = "CI_S_REG_08_EXERCISE_EQUIPMENT_FK_CLOSURE_CANDIDATE_UPDATE";
const S_REG_08_RUNTIME_STATUS = "non_runtime";
const S_REG_08_EQUIPMENT_DEPENDENCY_STATUS = "candidate_equipment_fk_closed";

const S_REG_08_EXERCISE_CANDIDATE_PATH =
  "ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json";

const S_REG_08_EXPECTED_EXERCISE_EQUIPMENT_IDS = Object.freeze({
  back_squat: Object.freeze(["barbell", "rack", "plate"]),
  deadlift: Object.freeze(["barbell", "plate"]),
  bench_press: Object.freeze(["barbell", "bench", "rack", "plate"]),
  front_plank: Object.freeze(["bodyweight", "open_floor_space"])
});

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg08ExerciseEquipmentFkClosureCandidateUpdateError";
  error.code = S_REG_08_FAILURE_TOKEN;
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

function arrayEquals(actual, expected) {
  return Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
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

function sReg08CandidatePaths() {
  return deepFreeze({
    exercise_registry_3a: S_REG_08_EXERCISE_CANDIDATE_PATH
  });
}

function sReg08LoadCandidateSurfaces() {
  return deepFreeze({
    upstream: sReg06LoadCandidateSeedFiles(),
    equipmentDocument: sReg07LoadEquipmentCandidateSeedFile(),
    exerciseDocument: readJson(S_REG_08_EXERCISE_CANDIDATE_PATH)
  });
}

function collectEquipmentById(equipmentDocument) {
  const equipmentById = new Map();

  for (const record of equipmentDocument.records) {
    equipmentById.set(record.equipment_id, record);
  }

  return equipmentById;
}

function assertExerciseDocumentBoundary(exerciseDocument) {
  if (!isPlainRecord(exerciseDocument)) {
    fail("exercise_document_invalid", "Exercise candidate document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: "S-REG-06",
    registry_id: "exercise_registry_3a",
    candidate_status: "candidate_content_draft",
    runtime_status: S_REG_08_RUNTIME_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    equipment_dependency_status: S_REG_08_EQUIPMENT_DEPENDENCY_STATUS
  })) {
    if (exerciseDocument[field] !== expected) {
      fail("exercise_document_boundary_field_invalid", "Exercise candidate document boundary field mismatch.", {
        field,
        expected,
        actual: exerciseDocument[field]
      });
    }
  }

  if (exerciseDocument.equipment_fk_closed_by_slice_id !== S_REG_08_SLICE_ID) {
    fail("exercise_document_fk_closure_slice_invalid", "Exercise candidate document must declare S-REG-08 as the FK closure slice.", {
      actual: exerciseDocument.equipment_fk_closed_by_slice_id
    });
  }

  if (!Array.isArray(exerciseDocument.records)) {
    fail("exercise_records_invalid", "Exercise candidate records must be an array.");
  }
}

function validateExerciseRecordEquipmentClosure(record, equipmentById) {
  if (!isPlainRecord(record)) {
    fail("exercise_record_invalid", "Exercise candidate record must be a plain object.");
  }

  const expectedEquipmentIds = S_REG_08_EXPECTED_EXERCISE_EQUIPMENT_IDS[record.exercise_id];

  if (!expectedEquipmentIds) {
    fail("unexpected_exercise_id", "S-REG-08 only covers the small S-REG-06 exercise seed set.", {
      exercise_id: record.exercise_id
    });
  }

  if (!arrayEquals(record.equipment_ids, expectedEquipmentIds)) {
    fail("exercise_equipment_ids_mismatch", "Exercise candidate equipment_ids do not match the S-REG-08 expected closure set.", {
      exercise_id: record.exercise_id,
      actual: record.equipment_ids,
      expected: expectedEquipmentIds
    });
  }

  requireStringArray(record.equipment_ids, "equipment_ids", {
    exercise_id: record.exercise_id
  });

  if (record.equipment_dependency_status !== S_REG_08_EQUIPMENT_DEPENDENCY_STATUS) {
    fail("exercise_equipment_dependency_status_invalid", "Exercise candidate equipment dependency status must be candidate_equipment_fk_closed.", {
      exercise_id: record.exercise_id,
      actual: record.equipment_dependency_status
    });
  }

  if (record.equipment_fk_closed_by_slice_id !== S_REG_08_SLICE_ID) {
    fail("exercise_equipment_fk_closure_slice_invalid", "Exercise candidate record must declare S-REG-08 as the FK closure slice.", {
      exercise_id: record.exercise_id,
      actual: record.equipment_fk_closed_by_slice_id
    });
  }

  if (record.activation_ready !== false) {
    fail("exercise_activation_ready_invalid", "Exercise candidate must remain activation_ready false.", {
      exercise_id: record.exercise_id
    });
  }

  if (record.runtime_status !== S_REG_08_RUNTIME_STATUS) {
    fail("exercise_runtime_status_invalid", "Exercise candidate must remain non_runtime.", {
      exercise_id: record.exercise_id,
      actual: record.runtime_status
    });
  }

  for (const equipmentId of record.equipment_ids) {
    const equipmentRecord = equipmentById.get(equipmentId);

    if (!equipmentRecord) {
      fail("equipment_fk_unknown", "Exercise candidate references an unknown equipment candidate id.", {
        exercise_id: record.exercise_id,
        equipment_id: equipmentId
      });
    }

    if (!equipmentRecord.movement_pattern_applicability.includes(record.movement_id)) {
      fail("equipment_movement_fk_incompatible", "Exercise candidate equipment does not declare the exercise movement id.", {
        exercise_id: record.exercise_id,
        equipment_id: equipmentId,
        movement_id: record.movement_id
      });
    }

    for (const activityId of record.activity_ids) {
      if (!equipmentRecord.activity_applicability.includes(activityId)) {
        fail("equipment_activity_fk_incompatible", "Exercise candidate equipment does not declare the exercise activity id.", {
          exercise_id: record.exercise_id,
          equipment_id: equipmentId,
          activity_id: activityId
        });
      }
    }
  }
}

function sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate({ upstream, equipmentDocument, exerciseDocument } = {}) {
  const loaded = {
    upstream: upstream ?? sReg06LoadCandidateSeedFiles(),
    equipmentDocument: equipmentDocument ?? sReg07LoadEquipmentCandidateSeedFile(),
    exerciseDocument: exerciseDocument ?? readJson(S_REG_08_EXERCISE_CANDIDATE_PATH)
  };

  const sReg06Result = sReg06ValidateCandidateSeedSurface(loaded.upstream);
  const sReg07Result = sReg07ValidateEquipmentCandidateSeedSurface({
    equipmentDocument: loaded.equipmentDocument,
    upstreamSurface: loaded.upstream
  });

  if (!sReg06Result.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate surface did not validate.", { s_reg_06_result: sReg06Result });
  }

  if (!sReg07Result.ok) {
    fail("s_reg_07_surface_invalid", "S-REG-07 equipment candidate surface did not validate.", { s_reg_07_result: sReg07Result });
  }

  if (sReg06Result.equipment_dependency_status !== S_REG_08_EQUIPMENT_DEPENDENCY_STATUS) {
    fail("s_reg_06_equipment_dependency_not_closed", "S-REG-08 expects S-REG-06 exercise candidates to report candidate equipment FK closure.", {
      actual: sReg06Result.equipment_dependency_status
    });
  }

  if (sReg07Result.s_reg_06_exercise_dependency_status !== S_REG_08_EQUIPMENT_DEPENDENCY_STATUS) {
    fail("s_reg_07_observed_dependency_not_closed", "S-REG-07 compatibility validation must observe S-REG-08 candidate FK closure.", {
      actual: sReg07Result.s_reg_06_exercise_dependency_status
    });
  }

  assertExerciseDocumentBoundary(loaded.exerciseDocument);

  const equipmentById = collectEquipmentById(loaded.equipmentDocument);
  const seenExercises = new Set();

  for (const record of loaded.exerciseDocument.records) {
    validateExerciseRecordEquipmentClosure(record, equipmentById);
    seenExercises.add(record.exercise_id);
  }

  const expectedExerciseIds = Object.keys(S_REG_08_EXPECTED_EXERCISE_EQUIPMENT_IDS);

  if (JSON.stringify([...seenExercises]) !== JSON.stringify(expectedExerciseIds)) {
    fail("exercise_seed_set_mismatch", "S-REG-08 exercise seed set must remain the small S-REG-06 set in exact order.", {
      actual: [...seenExercises],
      expected: expectedExerciseIds
    });
  }

  return deepFreeze({
    ok: true,
    slice_id: S_REG_08_SLICE_ID,
    exercise_count: seenExercises.size,
    equipment_count: equipmentById.size,
    equipment_dependency_status: S_REG_08_EQUIPMENT_DEPENDENCY_STATUS,
    activation_ready: false,
    runtime_status: S_REG_08_RUNTIME_STATUS
  });
}

export {
  S_REG_08_EQUIPMENT_DEPENDENCY_STATUS,
  S_REG_08_EXERCISE_CANDIDATE_PATH,
  S_REG_08_EXPECTED_EXERCISE_EQUIPMENT_IDS,
  S_REG_08_FAILURE_TOKEN,
  S_REG_08_RUNTIME_STATUS,
  S_REG_08_SLICE_ID,
  sReg08CandidatePaths,
  sReg08LoadCandidateSurfaces,
  sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate
};