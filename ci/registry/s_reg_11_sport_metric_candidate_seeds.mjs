/**
 * DEV NOTE: S-REG-11 sport metric candidate boundary.
 * Purpose: validates inert sport metric candidate definitions against locked
 * S-REG-06 activity candidates and S-REG-10 sport subdivision candidates.
 * Boundary: reads candidate files only. It must not read or write active
 * registries, alter registry law, add metric-exercise links, add threshold
 * marker behaviour, or affect deterministic engine runtime behaviour.
 * Determinism: validation is closed over fixed candidate paths, fixed record
 * order, fixed locked activities, and explicit activity/subdivision FK checks.
 * Failure: invalid sport metric candidate records fail closed with
 * CI_S_REG_11_SPORT_METRIC_CANDIDATE_SEEDS.
 */
import fs from "node:fs";

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  sReg10LoadSportContextCandidateSeedFiles,
  sReg10ValidateSportContextCandidateSeeds
} from "./s_reg_10_sport_context_candidate_seeds.mjs";

const S_REG_11_SLICE_ID = "S-REG-11";
const S_REG_11_FAILURE_TOKEN = "CI_S_REG_11_SPORT_METRIC_CANDIDATE_SEEDS";
const S_REG_11_REGISTRY_ID = "sport_metric_registry_1c";
const S_REG_11_RUNTIME_STATUS = "non_runtime";
const S_REG_11_CANDIDATE_STATUS = "candidate_content_draft";
const S_REG_11_SEED_STATUS = "candidate_fk_ready";
const S_REG_11_CONTEXT_SCOPE = "candidate_seed_only";
const S_REG_11_METRIC_KIND = "factual_metric_definition";

const S_REG_11_CANDIDATE_PATHS = Object.freeze({
  sport_metric_registry_1c:
    "ci/registry/candidates/sport_metric_registry_1c/sport_metric_registry_1c.candidate.registry.json"
});

const S_REG_11_EXPECTED_METRICS = Object.freeze([
  Object.freeze(["powerlifting__load_kg", "powerlifting", "powerlifting__competition_lift", "Load", "kg", "number"]),
  Object.freeze(["powerlifting__repetition_count", "powerlifting", "powerlifting__competition_lift", "Repetition count", "count", "integer"]),
  Object.freeze(["general_strength__load_kg", "general_strength", "general_strength__training", "Load", "kg", "number"]),
  Object.freeze(["general_strength__repetition_count", "general_strength", "general_strength__training", "Repetition count", "count", "integer"]),
  Object.freeze(["rugby_union__body_mass_kg", "rugby_union", "rugby_union__general_preparation", "Body mass", "kg", "number"]),
  Object.freeze(["rugby_union__sprint_time_seconds", "rugby_union", "rugby_union__general_preparation", "Sprint time", "seconds", "number"])
]);

const S_REG_11_FORBIDDEN_KEYS = Object.freeze([
  "exercise_id",
  "exercise_ids",
  "exercise_token_id",
  "metric_exercise_link_id",
  "threshold_id",
  "threshold_marker_id",
  "marker_status",
  "marker_evaluator",
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
  "suitability_rating",
  "return_to_play_status",
  "tactical_status",
  "outcome_score"
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg11SportMetricCandidateSeedError";
  error.code = S_REG_11_FAILURE_TOKEN;
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

function sReg11CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_11_CANDIDATE_PATHS));
}

function sReg11LoadSportMetricCandidateSeedFile() {
  return deepFreeze(readJson(S_REG_11_CANDIDATE_PATHS.sport_metric_registry_1c));
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

function assertNoForbiddenKeys(record) {
  for (const key of S_REG_11_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_sport_metric_semantic_key", "Sport metric candidate records must not contain exercise-link, threshold, marker, selection, ranking, recommendation, optimisation, capability, readiness, safety, suitability, return-to-play, tactical, or outcome fields.", {
        sport_metric_id: record.sport_metric_id ?? null,
        field: key
      });
    }
  }
}

function assertDocumentBoundary(doc) {
  if (!isPlainRecord(doc)) {
    fail("candidate_document_invalid", "Sport metric candidate document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_11_SLICE_ID,
    registry_id: S_REG_11_REGISTRY_ID,
    candidate_status: S_REG_11_CANDIDATE_STATUS,
    runtime_status: S_REG_11_RUNTIME_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    sport_metric_seed_status: S_REG_11_SEED_STATUS
  })) {
    if (doc[field] !== expected) {
      fail("candidate_document_boundary_field_invalid", "Sport metric candidate document boundary field mismatch.", {
        field,
        expected,
        actual: doc[field]
      });
    }
  }

  if (JSON.stringify(doc.depends_on) !== JSON.stringify(["activity_registry_1", "sport_subdivision_registry_1a"])) {
    fail("dependency_order_invalid", "Sport metric candidate dependency order mismatch.", {
      actual: doc.depends_on
    });
  }

  if (!Array.isArray(doc.records)) {
    fail("records_invalid", "Sport metric candidate records must be an array.");
  }

  if (doc.records.length !== S_REG_11_EXPECTED_METRICS.length) {
    fail("record_count_invalid", "Sport metric candidate record count mismatch.", {
      actual: doc.records.length,
      expected: S_REG_11_EXPECTED_METRICS.length
    });
  }
}

function assertMetricRecord(record, expected, activityIds, subdivisionById) {
  const [
    expectedSportMetricId,
    expectedActivityId,
    expectedSubdivisionId,
    expectedLabel,
    expectedUnit,
    expectedValueType
  ] = expected;

  if (!isPlainRecord(record)) {
    fail("sport_metric_record_invalid", "Sport metric candidate record must be a plain object.");
  }

  assertNoForbiddenKeys(record);

  for (const [field, expectedValue] of Object.entries({
    sport_metric_id: expectedSportMetricId,
    activity_id: expectedActivityId,
    sport_subdivision_id: expectedSubdivisionId,
    display_label: expectedLabel,
    metric_kind: S_REG_11_METRIC_KIND,
    unit: expectedUnit,
    value_type: expectedValueType,
    context_scope: S_REG_11_CONTEXT_SCOPE,
    source_slice_id: S_REG_11_SLICE_ID,
    candidate_status: S_REG_11_CANDIDATE_STATUS,
    runtime_status: S_REG_11_RUNTIME_STATUS,
    activation_ready: false,
    copy_boundary_notes: "factual sport metric definition only"
  })) {
    if (record[field] !== expectedValue) {
      fail("sport_metric_record_field_invalid", "Sport metric candidate record field mismatch.", {
        sport_metric_id: record.sport_metric_id ?? null,
        field,
        expected: expectedValue,
        actual: record[field]
      });
    }
  }

  if (!activityIds.has(record.activity_id)) {
    fail("activity_fk_unknown", "Sport metric candidate references an unknown activity candidate id.", {
      sport_metric_id: record.sport_metric_id,
      activity_id: record.activity_id
    });
  }

  const subdivision = subdivisionById.get(record.sport_subdivision_id);

  if (!subdivision) {
    fail("subdivision_fk_unknown", "Sport metric candidate references an unknown sport subdivision candidate id.", {
      sport_metric_id: record.sport_metric_id,
      sport_subdivision_id: record.sport_subdivision_id
    });
  }

  if (subdivision.activity_id !== record.activity_id) {
    fail("metric_subdivision_activity_mismatch", "Sport metric activity_id must match the referenced subdivision activity_id.", {
      sport_metric_id: record.sport_metric_id,
      activity_id: record.activity_id,
      subdivision_activity_id: subdivision.activity_id
    });
  }
}

function sReg11ValidateSportMetricCandidateSeeds({ sportMetricDocument, upstreamSurface, sportContextSurface } = {}) {
  const upstream = upstreamSurface ?? sReg06LoadCandidateSeedFiles();
  const upstreamResult = sReg06ValidateCandidateSeedSurface(upstream);

  if (!upstreamResult.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate surface did not validate.", { upstream_result: upstreamResult });
  }

  const contextSurface = sportContextSurface ?? sReg10LoadSportContextCandidateSeedFiles();
  const contextResult = sReg10ValidateSportContextCandidateSeeds({
    sportContextSurface: contextSurface,
    upstreamSurface: upstream
  });

  if (!contextResult.ok) {
    fail("s_reg_10_surface_invalid", "S-REG-10 sport context candidate surface did not validate.", { context_result: contextResult });
  }

  const doc = sportMetricDocument ?? sReg11LoadSportMetricCandidateSeedFile();
  assertDocumentBoundary(doc);

  const activityIds = requireUnique(upstream.activity_registry_1.records, "activity_id", "activity_registry_1");
  requireUnique(doc.records, "sport_metric_id", S_REG_11_REGISTRY_ID);

  const subdivisionById = new Map();

  for (const subdivision of contextSurface.sport_subdivision_registry_1a.records) {
    requireString(subdivision.sport_subdivision_id, "sport_subdivision_id", {
      registry_id: "sport_subdivision_registry_1a"
    });
    subdivisionById.set(subdivision.sport_subdivision_id, subdivision);
  }

  for (let index = 0; index < S_REG_11_EXPECTED_METRICS.length; index += 1) {
    assertMetricRecord(doc.records[index], S_REG_11_EXPECTED_METRICS[index], activityIds, subdivisionById);
  }

  return deepFreeze({
    ok: true,
    slice_id: S_REG_11_SLICE_ID,
    registry_id: S_REG_11_REGISTRY_ID,
    sport_metric_count: doc.records.length,
    activity_count: activityIds.size,
    subdivision_count: subdivisionById.size,
    sport_metric_seed_status: S_REG_11_SEED_STATUS,
    activation_ready: false,
    runtime_status: S_REG_11_RUNTIME_STATUS
  });
}

export {
  S_REG_11_CANDIDATE_PATHS,
  S_REG_11_CONTEXT_SCOPE,
  S_REG_11_FAILURE_TOKEN,
  S_REG_11_METRIC_KIND,
  S_REG_11_REGISTRY_ID,
  S_REG_11_RUNTIME_STATUS,
  S_REG_11_SEED_STATUS,
  S_REG_11_SLICE_ID,
  sReg11CandidatePaths,
  sReg11LoadSportMetricCandidateSeedFile,
  sReg11ValidateSportMetricCandidateSeeds
};