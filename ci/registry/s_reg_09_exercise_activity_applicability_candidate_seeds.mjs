/**
 * DEV NOTE: S-REG-09 exercise-activity applicability candidate boundary.
 * Purpose: validates inert candidate exercise-to-activity applicability records
 * for the small S-REG-06 exercise seed set and locked v1 activities.
 * Boundary: reads candidate files only. It must not read or write active
 * registries, alter registry law, activate canonical registries, or affect
 * deterministic engine runtime behaviour.
 * Determinism: validation is closed over fixed candidate paths, fixed record
 * order, fixed locked activities, and explicit exercise/activity FK checks.
 * Failure: invalid candidate applicability records fail closed with
 * CI_S_REG_09_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_SEEDS.
 */
import fs from "node:fs";

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate
} from "./s_reg_08_exercise_equipment_fk_closure_candidate_update.mjs";

const S_REG_09_SLICE_ID = "S-REG-09";
const S_REG_09_FAILURE_TOKEN = "CI_S_REG_09_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_SEEDS";
const S_REG_09_REGISTRY_ID = "exercise_activity_applicability_registry";
const S_REG_09_RUNTIME_STATUS = "non_runtime";
const S_REG_09_CANDIDATE_STATUS = "candidate_content_draft";
const S_REG_09_ACTIVITY_CONTEXT = "training";
const S_REG_09_APPLICABILITY_STATE = "allowed";
const S_REG_09_TIER_CAP = "candidate_seed_only";

const S_REG_09_CANDIDATE_PATHS = Object.freeze({
  exercise_activity_applicability_registry:
    "ci/registry/candidates/exercise_activity_applicability_registry/exercise_activity_applicability_registry.candidate.registry.json"
});

const S_REG_09_REQUIRED_FIELDS = Object.freeze([
  "applicability_id",
  "exercise_id",
  "activity_id",
  "activity_context",
  "applicability_state",
  "conditions",
  "tier_cap",
  "template_applicability",
  "substitution_applicability",
  "source_slice_id",
  "candidate_status",
  "runtime_status",
  "activation_ready",
  "copy_legal_boundary_notes"
]);

const S_REG_09_EXPECTED_LINKS = Object.freeze([
  Object.freeze(["back_squat", "powerlifting"]),
  Object.freeze(["back_squat", "general_strength"]),
  Object.freeze(["back_squat", "rugby_union"]),
  Object.freeze(["deadlift", "powerlifting"]),
  Object.freeze(["deadlift", "general_strength"]),
  Object.freeze(["deadlift", "rugby_union"]),
  Object.freeze(["bench_press", "powerlifting"]),
  Object.freeze(["bench_press", "general_strength"]),
  Object.freeze(["bench_press", "rugby_union"]),
  Object.freeze(["front_plank", "powerlifting"]),
  Object.freeze(["front_plank", "general_strength"]),
  Object.freeze(["front_plank", "rugby_union"])
]);

const S_REG_09_FORBIDDEN_KEYS = Object.freeze([
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
  "safety_rating",
  "readiness_score",
  "effectiveness_score"
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg09ExerciseActivityApplicabilityCandidateSeedError";
  error.code = S_REG_09_FAILURE_TOKEN;
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

function sReg09CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_09_CANDIDATE_PATHS));
}

function sReg09LoadApplicabilityCandidateSeedFile() {
  return deepFreeze(readJson(S_REG_09_CANDIDATE_PATHS.exercise_activity_applicability_registry));
}

function expectedApplicabilityId(exerciseId, activityId) {
  return `${exerciseId}__${activityId}__training`;
}

function requireString(value, field, context) {
  if (typeof value !== "string" || value.length === 0) {
    fail("required_string_invalid", `${field} must be a non-empty string.`, context);
  }

  return value;
}

function requireStringArray(value, field, context) {
  if (!Array.isArray(value)) {
    fail("string_array_invalid", `${field} must be an explicit array.`, context);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      fail("string_array_invalid", `${field} must contain non-empty strings only.`, context);
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

function assertNoForbiddenKeys(record) {
  for (const key of S_REG_09_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_applicability_semantic_key", "Candidate applicability records must not contain recommendation, ranking, optimisation, capability, readiness, safety, or effectiveness fields.", {
        applicability_id: record.applicability_id ?? null,
        field: key
      });
    }
  }
}

function assertDocumentBoundary(doc) {
  if (!isPlainRecord(doc)) {
    fail("candidate_document_invalid", "Applicability candidate document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_09_SLICE_ID,
    registry_id: S_REG_09_REGISTRY_ID,
    candidate_status: S_REG_09_CANDIDATE_STATUS,
    runtime_status: S_REG_09_RUNTIME_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    applicability_seed_status: "candidate_fk_ready"
  })) {
    if (doc[field] !== expected) {
      fail("candidate_document_boundary_field_invalid", "Applicability candidate document boundary field mismatch.", {
        field,
        expected,
        actual: doc[field]
      });
    }
  }

  if (JSON.stringify(doc.depends_on) !== JSON.stringify(["activity_registry_1", "exercise_registry_3a"])) {
    fail("dependency_order_invalid", "Applicability candidate dependency order mismatch.", {
      actual: doc.depends_on
    });
  }

  if (!Array.isArray(doc.records)) {
    fail("records_invalid", "Applicability candidate records must be an array.");
  }

  if (doc.records.length !== S_REG_09_EXPECTED_LINKS.length) {
    fail("record_count_invalid", "Applicability candidate records must match the fixed S-REG-09 seed count.", {
      actual: doc.records.length,
      expected: S_REG_09_EXPECTED_LINKS.length
    });
  }
}

function assertRecordShape(record, expectedExerciseId, expectedActivityId, activityIds, exerciseById) {
  if (!isPlainRecord(record)) {
    fail("applicability_record_invalid", "Applicability candidate record must be a plain object.");
  }

  for (const field of S_REG_09_REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      fail("required_field_missing", "Applicability candidate record is missing a required field.", {
        applicability_id: record.applicability_id ?? null,
        field
      });
    }
  }

  assertNoForbiddenKeys(record);

  const expectedId = expectedApplicabilityId(expectedExerciseId, expectedActivityId);

  for (const [field, expected] of Object.entries({
    applicability_id: expectedId,
    exercise_id: expectedExerciseId,
    activity_id: expectedActivityId,
    activity_context: S_REG_09_ACTIVITY_CONTEXT,
    applicability_state: S_REG_09_APPLICABILITY_STATE,
    tier_cap: S_REG_09_TIER_CAP,
    template_applicability: "eligible",
    substitution_applicability: "eligible",
    source_slice_id: S_REG_09_SLICE_ID,
    candidate_status: S_REG_09_CANDIDATE_STATUS,
    runtime_status: S_REG_09_RUNTIME_STATUS,
    activation_ready: false,
    copy_legal_boundary_notes: "factual candidate applicability link only"
  })) {
    if (record[field] !== expected) {
      fail("applicability_record_field_invalid", "Applicability candidate record field mismatch.", {
        applicability_id: record.applicability_id ?? null,
        field,
        expected,
        actual: record[field]
      });
    }
  }

  requireStringArray(record.conditions, "conditions", {
    applicability_id: record.applicability_id
  });

  if (record.conditions.length !== 0) {
    fail("conditions_not_empty", "S-REG-09 candidate seed conditions must be explicit empty arrays.", {
      applicability_id: record.applicability_id
    });
  }

  if (!activityIds.has(record.activity_id)) {
    fail("activity_fk_unknown", "Applicability candidate references an unknown activity candidate id.", {
      applicability_id: record.applicability_id,
      activity_id: record.activity_id
    });
  }

  const exercise = exerciseById.get(record.exercise_id);

  if (!exercise) {
    fail("exercise_fk_unknown", "Applicability candidate references an unknown exercise candidate id.", {
      applicability_id: record.applicability_id,
      exercise_id: record.exercise_id
    });
  }

  if (!Array.isArray(exercise.activity_ids) || !exercise.activity_ids.includes(record.activity_id)) {
    fail("exercise_activity_fk_not_declared", "Applicability candidate activity_id must be declared on the exercise candidate record.", {
      applicability_id: record.applicability_id,
      exercise_id: record.exercise_id,
      activity_id: record.activity_id
    });
  }

  if (exercise.activation_ready !== false || exercise.runtime_status !== S_REG_09_RUNTIME_STATUS) {
    fail("exercise_candidate_boundary_invalid", "Upstream exercise candidate must remain non-runtime and not activation-ready.", {
      applicability_id: record.applicability_id,
      exercise_id: record.exercise_id
    });
  }
}

function sReg09ValidateExerciseActivityApplicabilityCandidateSeeds({ applicabilityDocument, upstreamSurface } = {}) {
  const upstream = upstreamSurface ?? sReg06LoadCandidateSeedFiles();
  const upstreamResult = sReg06ValidateCandidateSeedSurface(upstream);
  const equipmentClosureResult = sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate({
    upstream,
    exerciseDocument: upstream.exercise_registry_3a
  });

  if (!upstreamResult.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate surface did not validate.", { upstream_result: upstreamResult });
  }

  if (!equipmentClosureResult.ok) {
    fail("s_reg_08_surface_invalid", "S-REG-08 exercise equipment FK closure did not validate.", { equipment_closure_result: equipmentClosureResult });
  }

  const doc = applicabilityDocument ?? sReg09LoadApplicabilityCandidateSeedFile();
  assertDocumentBoundary(doc);

  const activityIds = requireUnique(upstream.activity_registry_1.records, "activity_id", "activity_registry_1");
  const exerciseIds = requireUnique(upstream.exercise_registry_3a.records, "exercise_id", "exercise_registry_3a");
  const exerciseById = new Map(upstream.exercise_registry_3a.records.map((record) => [record.exercise_id, record]));

  const seenApplicabilityIds = requireUnique(doc.records, "applicability_id", S_REG_09_REGISTRY_ID);
  const seenPairs = [];

  for (let index = 0; index < S_REG_09_EXPECTED_LINKS.length; index += 1) {
    const [expectedExerciseId, expectedActivityId] = S_REG_09_EXPECTED_LINKS[index];
    const record = doc.records[index];

    assertRecordShape(record, expectedExerciseId, expectedActivityId, activityIds, exerciseById);
    seenPairs.push(`${record.exercise_id}:${record.activity_id}:${record.activity_context}`);

    if (!exerciseIds.has(record.exercise_id)) {
      fail("exercise_fk_unknown", "Applicability candidate references an unknown exercise candidate id.", {
        applicability_id: record.applicability_id,
        exercise_id: record.exercise_id
      });
    }
  }

  if (seenApplicabilityIds.size !== S_REG_09_EXPECTED_LINKS.length) {
    fail("applicability_id_count_invalid", "Applicability IDs must be unique across the fixed seed set.", {
      actual: seenApplicabilityIds.size,
      expected: S_REG_09_EXPECTED_LINKS.length
    });
  }

  return deepFreeze({
    ok: true,
    slice_id: S_REG_09_SLICE_ID,
    registry_id: S_REG_09_REGISTRY_ID,
    applicability_count: doc.records.length,
    exercise_count: exerciseIds.size,
    activity_count: activityIds.size,
    activity_context: S_REG_09_ACTIVITY_CONTEXT,
    applicability_state: S_REG_09_APPLICABILITY_STATE,
    activation_ready: false,
    runtime_status: S_REG_09_RUNTIME_STATUS
  });
}

export {
  S_REG_09_ACTIVITY_CONTEXT,
  S_REG_09_APPLICABILITY_STATE,
  S_REG_09_CANDIDATE_PATHS,
  S_REG_09_FAILURE_TOKEN,
  S_REG_09_REGISTRY_ID,
  S_REG_09_RUNTIME_STATUS,
  S_REG_09_SLICE_ID,
  S_REG_09_TIER_CAP,
  sReg09CandidatePaths,
  sReg09LoadApplicabilityCandidateSeedFile,
  sReg09ValidateExerciseActivityApplicabilityCandidateSeeds
};