/**
 * DEV NOTE: S-REG-10 sport context candidate boundary.
 * Purpose: validates inert sport subdivision and sport role candidate seed
 * records against the locked S-REG-06 activity candidates.
 * Boundary: reads candidate files only. It must not read or write active
 * registries, alter registry law, add sport metrics, alter threshold marker
 * surfaces, or affect deterministic engine runtime behaviour.
 * Determinism: validation is closed over fixed candidate paths, fixed record
 * order, fixed locked activities, and explicit activity/subdivision FK checks.
 * Failure: invalid sport context candidate records fail closed with
 * CI_S_REG_10_SPORT_CONTEXT_CANDIDATE_SEEDS.
 */
import fs from "node:fs";

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  sReg09ValidateExerciseActivityApplicabilityCandidateSeeds
} from "./s_reg_09_exercise_activity_applicability_candidate_seeds.mjs";

const S_REG_10_SLICE_ID = "S-REG-10";
const S_REG_10_FAILURE_TOKEN = "CI_S_REG_10_SPORT_CONTEXT_CANDIDATE_SEEDS";
const S_REG_10_RUNTIME_STATUS = "non_runtime";
const S_REG_10_CANDIDATE_STATUS = "candidate_content_draft";
const S_REG_10_SEED_STATUS = "candidate_fk_ready";
const S_REG_10_CONTEXT_TYPE = "declared_context";
const S_REG_10_CONTEXT_SCOPE = "candidate_seed_only";

const S_REG_10_REGISTRY_IDS = Object.freeze([
  "sport_subdivision_registry_1a",
  "sport_role_registry_2"
]);

const S_REG_10_CANDIDATE_PATHS = Object.freeze({
  sport_subdivision_registry_1a:
    "ci/registry/candidates/sport_subdivision_registry_1a/sport_subdivision_registry_1a.candidate.registry.json",
  sport_role_registry_2:
    "ci/registry/candidates/sport_role_registry_2/sport_role_registry_2.candidate.registry.json"
});

const S_REG_10_EXPECTED_SUBDIVISIONS = Object.freeze([
  Object.freeze(["powerlifting__competition_lift", "powerlifting", "Competition lift"]),
  Object.freeze(["powerlifting__general_preparation", "powerlifting", "General preparation"]),
  Object.freeze(["general_strength__training", "general_strength", "Training"]),
  Object.freeze(["rugby_union__general_preparation", "rugby_union", "General preparation"])
]);

const S_REG_10_EXPECTED_ROLES = Object.freeze([
  Object.freeze(["powerlifting__athlete", "powerlifting", "powerlifting__competition_lift", "Athlete"]),
  Object.freeze(["general_strength__participant", "general_strength", "general_strength__training", "Participant"]),
  Object.freeze(["rugby_union__field_player", "rugby_union", "rugby_union__general_preparation", "Field player"])
]);

const S_REG_10_FORBIDDEN_KEYS = Object.freeze([
  "selection_rule",
  "selection_score",
  "ranking_score",
  "rank",
  "recommendation_score",
  "recommended_rank",
  "optimisation_score",
  "optimization_score",
  "capability_score",
  "capability_inference",
  "readiness_score",
  "safety_rating",
  "performance_score",
  "return_to_play_status",
  "tactical_status",
  "metric_id",
  "threshold_id"
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg10SportContextCandidateSeedError";
  error.code = S_REG_10_FAILURE_TOKEN;
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

function sReg10CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_10_CANDIDATE_PATHS));
}

function sReg10LoadSportContextCandidateSeedFiles() {
  return deepFreeze({
    sport_subdivision_registry_1a: readJson(S_REG_10_CANDIDATE_PATHS.sport_subdivision_registry_1a),
    sport_role_registry_2: readJson(S_REG_10_CANDIDATE_PATHS.sport_role_registry_2)
  });
}

function requireString(value, field, context) {
  if (typeof value !== "string" || value.length === 0) {
    fail("required_string_invalid", `${field} must be a non-empty string.`, context);
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

function assertDocumentBoundary(doc, registryId, expectedDependsOn) {
  if (!isPlainRecord(doc)) {
    fail("candidate_document_invalid", "Sport context candidate document must be a plain object.", { registry_id: registryId });
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_10_SLICE_ID,
    registry_id: registryId,
    candidate_status: S_REG_10_CANDIDATE_STATUS,
    runtime_status: S_REG_10_RUNTIME_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    sport_context_seed_status: S_REG_10_SEED_STATUS
  })) {
    if (doc[field] !== expected) {
      fail("candidate_document_boundary_field_invalid", "Sport context candidate document boundary field mismatch.", {
        registry_id: registryId,
        field,
        expected,
        actual: doc[field]
      });
    }
  }

  if (JSON.stringify(doc.depends_on) !== JSON.stringify(expectedDependsOn)) {
    fail("dependency_order_invalid", "Sport context candidate dependency order mismatch.", {
      registry_id: registryId,
      actual: doc.depends_on,
      expected: expectedDependsOn
    });
  }

  if (!Array.isArray(doc.records)) {
    fail("records_invalid", "Sport context candidate records must be an array.", { registry_id: registryId });
  }
}

function assertNoForbiddenKeys(record, registryId) {
  for (const key of S_REG_10_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_sport_context_semantic_key", "Sport context candidate records must not contain selection, ranking, metric, threshold, or operational decision fields.", {
        registry_id: registryId,
        record_id: record.sport_subdivision_id ?? record.sport_role_id ?? null,
        field: key
      });
    }
  }
}

function assertCommonRecordBoundary(record, registryId) {
  assertNoForbiddenKeys(record, registryId);

  for (const [field, expected] of Object.entries({
    context_type: S_REG_10_CONTEXT_TYPE,
    context_scope: S_REG_10_CONTEXT_SCOPE,
    source_slice_id: S_REG_10_SLICE_ID,
    candidate_status: S_REG_10_CANDIDATE_STATUS,
    runtime_status: S_REG_10_RUNTIME_STATUS,
    activation_ready: false
  })) {
    if (record[field] !== expected) {
      fail("sport_context_record_field_invalid", "Sport context candidate record field mismatch.", {
        registry_id: registryId,
        record_id: record.sport_subdivision_id ?? record.sport_role_id ?? null,
        field,
        expected,
        actual: record[field]
      });
    }
  }

  requireString(record.display_label, "display_label", { registry_id: registryId });
  requireString(record.copy_boundary_notes, "copy_boundary_notes", { registry_id: registryId });
}

function validateSubdivisionRecord(record, expected, activityIds) {
  const [expectedSubdivisionId, expectedActivityId, expectedLabel] = expected;

  if (!isPlainRecord(record)) {
    fail("subdivision_record_invalid", "Sport subdivision candidate record must be a plain object.");
  }

  assertCommonRecordBoundary(record, "sport_subdivision_registry_1a");

  for (const [field, expectedValue] of Object.entries({
    sport_subdivision_id: expectedSubdivisionId,
    activity_id: expectedActivityId,
    display_label: expectedLabel,
    copy_boundary_notes: "factual sport subdivision label only"
  })) {
    if (record[field] !== expectedValue) {
      fail("subdivision_record_field_invalid", "Sport subdivision candidate record field mismatch.", {
        sport_subdivision_id: record.sport_subdivision_id ?? null,
        field,
        expected: expectedValue,
        actual: record[field]
      });
    }
  }

  if (!activityIds.has(record.activity_id)) {
    fail("activity_fk_unknown", "Sport subdivision candidate references an unknown activity candidate id.", {
      sport_subdivision_id: record.sport_subdivision_id,
      activity_id: record.activity_id
    });
  }
}

function validateRoleRecord(record, expected, activityIds, subdivisionById) {
  const [expectedRoleId, expectedActivityId, expectedSubdivisionId, expectedLabel] = expected;

  if (!isPlainRecord(record)) {
    fail("role_record_invalid", "Sport role candidate record must be a plain object.");
  }

  assertCommonRecordBoundary(record, "sport_role_registry_2");

  for (const [field, expectedValue] of Object.entries({
    sport_role_id: expectedRoleId,
    activity_id: expectedActivityId,
    sport_subdivision_id: expectedSubdivisionId,
    display_label: expectedLabel,
    copy_boundary_notes: "factual sport role label only"
  })) {
    if (record[field] !== expectedValue) {
      fail("role_record_field_invalid", "Sport role candidate record field mismatch.", {
        sport_role_id: record.sport_role_id ?? null,
        field,
        expected: expectedValue,
        actual: record[field]
      });
    }
  }

  if (!activityIds.has(record.activity_id)) {
    fail("activity_fk_unknown", "Sport role candidate references an unknown activity candidate id.", {
      sport_role_id: record.sport_role_id,
      activity_id: record.activity_id
    });
  }

  const subdivision = subdivisionById.get(record.sport_subdivision_id);

  if (!subdivision) {
    fail("subdivision_fk_unknown", "Sport role candidate references an unknown sport subdivision candidate id.", {
      sport_role_id: record.sport_role_id,
      sport_subdivision_id: record.sport_subdivision_id
    });
  }

  if (subdivision.activity_id !== record.activity_id) {
    fail("role_subdivision_activity_mismatch", "Sport role activity_id must match the referenced subdivision activity_id.", {
      sport_role_id: record.sport_role_id,
      activity_id: record.activity_id,
      subdivision_activity_id: subdivision.activity_id
    });
  }
}

function sReg10ValidateSportContextCandidateSeeds({ sportContextSurface, upstreamSurface } = {}) {
  const upstream = upstreamSurface ?? sReg06LoadCandidateSeedFiles();
  const upstreamResult = sReg06ValidateCandidateSeedSurface(upstream);
  const applicabilityResult = sReg09ValidateExerciseActivityApplicabilityCandidateSeeds({ upstreamSurface: upstream });

  if (!upstreamResult.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate surface did not validate.", { upstream_result: upstreamResult });
  }

  if (!applicabilityResult.ok) {
    fail("s_reg_09_surface_invalid", "S-REG-09 candidate applicability surface did not validate.", { applicability_result: applicabilityResult });
  }

  const surface = sportContextSurface ?? sReg10LoadSportContextCandidateSeedFiles();
  const surfaceRegistryIds = Object.keys(surface);

  if (JSON.stringify(surfaceRegistryIds) !== JSON.stringify(S_REG_10_REGISTRY_IDS)) {
    fail("sport_context_surface_registry_order_invalid", "S-REG-10 sport context surface registry order mismatch.", {
      actual: surfaceRegistryIds,
      expected: [...S_REG_10_REGISTRY_IDS]
    });
  }

  const subdivisionDocument = surface.sport_subdivision_registry_1a;
  const roleDocument = surface.sport_role_registry_2;

  assertDocumentBoundary(subdivisionDocument, "sport_subdivision_registry_1a", ["activity_registry_1"]);
  assertDocumentBoundary(roleDocument, "sport_role_registry_2", ["activity_registry_1", "sport_subdivision_registry_1a"]);

  if (subdivisionDocument.records.length !== S_REG_10_EXPECTED_SUBDIVISIONS.length) {
    fail("subdivision_record_count_invalid", "Sport subdivision candidate record count mismatch.", {
      actual: subdivisionDocument.records.length,
      expected: S_REG_10_EXPECTED_SUBDIVISIONS.length
    });
  }

  if (roleDocument.records.length !== S_REG_10_EXPECTED_ROLES.length) {
    fail("role_record_count_invalid", "Sport role candidate record count mismatch.", {
      actual: roleDocument.records.length,
      expected: S_REG_10_EXPECTED_ROLES.length
    });
  }

  const activityIds = requireUnique(upstream.activity_registry_1.records, "activity_id", "activity_registry_1");
  requireUnique(subdivisionDocument.records, "sport_subdivision_id", "sport_subdivision_registry_1a");
  requireUnique(roleDocument.records, "sport_role_id", "sport_role_registry_2");

  const subdivisionById = new Map();

  for (let index = 0; index < S_REG_10_EXPECTED_SUBDIVISIONS.length; index += 1) {
    const record = subdivisionDocument.records[index];
    validateSubdivisionRecord(record, S_REG_10_EXPECTED_SUBDIVISIONS[index], activityIds);
    subdivisionById.set(record.sport_subdivision_id, record);
  }

  for (let index = 0; index < S_REG_10_EXPECTED_ROLES.length; index += 1) {
    validateRoleRecord(roleDocument.records[index], S_REG_10_EXPECTED_ROLES[index], activityIds, subdivisionById);
  }

  return deepFreeze({
    ok: true,
    slice_id: S_REG_10_SLICE_ID,
    registry_ids: [...S_REG_10_REGISTRY_IDS],
    subdivision_count: subdivisionDocument.records.length,
    role_count: roleDocument.records.length,
    activity_count: activityIds.size,
    sport_context_seed_status: S_REG_10_SEED_STATUS,
    activation_ready: false,
    runtime_status: S_REG_10_RUNTIME_STATUS
  });
}

export {
  S_REG_10_CANDIDATE_PATHS,
  S_REG_10_CONTEXT_SCOPE,
  S_REG_10_CONTEXT_TYPE,
  S_REG_10_FAILURE_TOKEN,
  S_REG_10_REGISTRY_IDS,
  S_REG_10_RUNTIME_STATUS,
  S_REG_10_SEED_STATUS,
  S_REG_10_SLICE_ID,
  sReg10CandidatePaths,
  sReg10LoadSportContextCandidateSeedFiles,
  sReg10ValidateSportContextCandidateSeeds
};