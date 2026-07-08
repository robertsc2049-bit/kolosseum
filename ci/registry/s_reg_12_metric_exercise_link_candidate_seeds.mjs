/**
 * DEV NOTE: S-REG-12 metric-exercise link candidate boundary.
 * Purpose: validates inert candidate links between S-REG-11 sport metric
 * definitions and S-REG-06 exercise candidates.
 * Boundary: reads candidate files only. It must not read or write active
 * registries, alter registry law, add threshold marker behaviour, add marker
 * evaluator behaviour, or affect deterministic engine runtime behaviour.
 * Determinism: validation is closed over fixed candidate paths, fixed record
 * order, fixed sport metric ids, fixed exercise ids, and explicit FK checks.
 * Failure: invalid metric-exercise link candidate records fail closed with
 * CI_S_REG_12_METRIC_EXERCISE_LINK_CANDIDATE_SEEDS.
 */
import fs from "node:fs";

import {
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
} from "./s_reg_06_candidate_seed_records.mjs";

import {
  sReg09LoadApplicabilityCandidateSeedFile,
  sReg09ValidateExerciseActivityApplicabilityCandidateSeeds
} from "./s_reg_09_exercise_activity_applicability_candidate_seeds.mjs";

import {
  sReg11LoadSportMetricCandidateSeedFile,
  sReg11ValidateSportMetricCandidateSeeds
} from "./s_reg_11_sport_metric_candidate_seeds.mjs";

const S_REG_12_SLICE_ID = "S-REG-12";
const S_REG_12_FAILURE_TOKEN = "CI_S_REG_12_METRIC_EXERCISE_LINK_CANDIDATE_SEEDS";
const S_REG_12_REGISTRY_ID = "metric_exercise_link_registry_1c_a";
const S_REG_12_RUNTIME_STATUS = "non_runtime";
const S_REG_12_CANDIDATE_STATUS = "candidate_content_draft";
const S_REG_12_SEED_STATUS = "candidate_fk_ready";
const S_REG_12_CONTEXT_SCOPE = "candidate_seed_only";
const S_REG_12_LINK_KIND = "factual_metric_exercise_link";
const S_REG_12_VALUE_CONTEXT = "recorded_value_context_only";

const S_REG_12_CANDIDATE_PATHS = Object.freeze({
  metric_exercise_link_registry_1c_a:
    "ci/registry/candidates/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.candidate.registry.json"
});

const S_REG_12_EXPECTED_LINKS = Object.freeze([
  Object.freeze(["powerlifting__load_kg__back_squat", "powerlifting__load_kg", "back_squat", "powerlifting"]),
  Object.freeze(["powerlifting__load_kg__deadlift", "powerlifting__load_kg", "deadlift", "powerlifting"]),
  Object.freeze(["powerlifting__load_kg__bench_press", "powerlifting__load_kg", "bench_press", "powerlifting"]),
  Object.freeze(["powerlifting__repetition_count__back_squat", "powerlifting__repetition_count", "back_squat", "powerlifting"]),
  Object.freeze(["powerlifting__repetition_count__deadlift", "powerlifting__repetition_count", "deadlift", "powerlifting"]),
  Object.freeze(["powerlifting__repetition_count__bench_press", "powerlifting__repetition_count", "bench_press", "powerlifting"]),
  Object.freeze(["general_strength__load_kg__back_squat", "general_strength__load_kg", "back_squat", "general_strength"]),
  Object.freeze(["general_strength__load_kg__deadlift", "general_strength__load_kg", "deadlift", "general_strength"]),
  Object.freeze(["general_strength__load_kg__bench_press", "general_strength__load_kg", "bench_press", "general_strength"]),
  Object.freeze(["general_strength__repetition_count__back_squat", "general_strength__repetition_count", "back_squat", "general_strength"]),
  Object.freeze(["general_strength__repetition_count__deadlift", "general_strength__repetition_count", "deadlift", "general_strength"]),
  Object.freeze(["general_strength__repetition_count__bench_press", "general_strength__repetition_count", "bench_press", "general_strength"]),
  Object.freeze(["rugby_union__body_mass_kg__front_plank", "rugby_union__body_mass_kg", "front_plank", "rugby_union"])
]);

const S_REG_12_FORBIDDEN_KEYS = Object.freeze([
  "threshold_id",
  "threshold_marker_id",
  "threshold_value",
  "marker_status",
  "marker_evaluator",
  "evaluator_id",
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
  "outcome_score",
  "performance_score"
]);

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg12MetricExerciseLinkCandidateSeedError";
  error.code = S_REG_12_FAILURE_TOKEN;
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

function sReg12CandidatePaths() {
  return deepFreeze(cloneJson(S_REG_12_CANDIDATE_PATHS));
}

function sReg12LoadMetricExerciseLinkCandidateSeedFile() {
  return deepFreeze(readJson(S_REG_12_CANDIDATE_PATHS.metric_exercise_link_registry_1c_a));
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
  for (const key of S_REG_12_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      fail("forbidden_metric_exercise_link_semantic_key", "Metric-exercise link candidate records must not contain threshold, marker, evaluator, selection, ranking, recommendation, optimisation, capability, readiness, safety, suitability, return-to-play, tactical, outcome, or performance fields.", {
        metric_exercise_link_id: record.metric_exercise_link_id ?? null,
        field: key
      });
    }
  }
}

function assertDocumentBoundary(doc) {
  if (!isPlainRecord(doc)) {
    fail("candidate_document_invalid", "Metric-exercise link candidate document must be a plain object.");
  }

  for (const [field, expected] of Object.entries({
    slice_id: S_REG_12_SLICE_ID,
    registry_id: S_REG_12_REGISTRY_ID,
    candidate_status: S_REG_12_CANDIDATE_STATUS,
    runtime_status: S_REG_12_RUNTIME_STATUS,
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    metric_exercise_link_seed_status: S_REG_12_SEED_STATUS
  })) {
    if (doc[field] !== expected) {
      fail("candidate_document_boundary_field_invalid", "Metric-exercise link candidate document boundary field mismatch.", {
        field,
        expected,
        actual: doc[field]
      });
    }
  }

  if (JSON.stringify(doc.depends_on) !== JSON.stringify(["activity_registry_1", "sport_metric_registry_1c", "exercise_registry_3a"])) {
    fail("dependency_order_invalid", "Metric-exercise link candidate dependency order mismatch.", {
      actual: doc.depends_on
    });
  }

  if (!Array.isArray(doc.records)) {
    fail("records_invalid", "Metric-exercise link candidate records must be an array.");
  }

  if (doc.records.length !== S_REG_12_EXPECTED_LINKS.length) {
    fail("record_count_invalid", "Metric-exercise link candidate record count mismatch.", {
      actual: doc.records.length,
      expected: S_REG_12_EXPECTED_LINKS.length
    });
  }
}

function buildExerciseActivityApplicabilitySet(applicabilityDocument) {
  const allowed = new Set();

  for (const record of applicabilityDocument.records) {
    if (record.applicability_state === "allowed") {
      allowed.add(`${record.exercise_id}::${record.activity_id}`);
    }
  }

  return allowed;
}

function assertLinkRecord(record, expected, activityIds, exerciseById, metricById, applicabilitySet) {
  const [
    expectedLinkId,
    expectedSportMetricId,
    expectedExerciseId,
    expectedActivityId
  ] = expected;

  if (!isPlainRecord(record)) {
    fail("metric_exercise_link_record_invalid", "Metric-exercise link candidate record must be a plain object.");
  }

  assertNoForbiddenKeys(record);

  for (const [field, expectedValue] of Object.entries({
    metric_exercise_link_id: expectedLinkId,
    sport_metric_id: expectedSportMetricId,
    exercise_id: expectedExerciseId,
    activity_id: expectedActivityId,
    link_kind: S_REG_12_LINK_KIND,
    context_scope: S_REG_12_CONTEXT_SCOPE,
    value_context: S_REG_12_VALUE_CONTEXT,
    source_slice_id: S_REG_12_SLICE_ID,
    candidate_status: S_REG_12_CANDIDATE_STATUS,
    runtime_status: S_REG_12_RUNTIME_STATUS,
    activation_ready: false,
    copy_boundary_notes: "factual metric-exercise relationship only"
  })) {
    if (record[field] !== expectedValue) {
      fail("metric_exercise_link_record_field_invalid", "Metric-exercise link candidate record field mismatch.", {
        metric_exercise_link_id: record.metric_exercise_link_id ?? null,
        field,
        expected: expectedValue,
        actual: record[field]
      });
    }
  }

  if (!activityIds.has(record.activity_id)) {
    fail("activity_fk_unknown", "Metric-exercise link candidate references an unknown activity candidate id.", {
      metric_exercise_link_id: record.metric_exercise_link_id,
      activity_id: record.activity_id
    });
  }

  const metric = metricById.get(record.sport_metric_id);

  if (!metric) {
    fail("sport_metric_fk_unknown", "Metric-exercise link candidate references an unknown sport metric candidate id.", {
      metric_exercise_link_id: record.metric_exercise_link_id,
      sport_metric_id: record.sport_metric_id
    });
  }

  const exercise = exerciseById.get(record.exercise_id);

  if (!exercise) {
    fail("exercise_fk_unknown", "Metric-exercise link candidate references an unknown exercise candidate id.", {
      metric_exercise_link_id: record.metric_exercise_link_id,
      exercise_id: record.exercise_id
    });
  }

  if (metric.activity_id !== record.activity_id) {
    fail("metric_activity_mismatch", "Metric-exercise link activity_id must match the referenced sport metric activity_id.", {
      metric_exercise_link_id: record.metric_exercise_link_id,
      activity_id: record.activity_id,
      metric_activity_id: metric.activity_id
    });
  }

  if (!Array.isArray(exercise.activity_ids) || !exercise.activity_ids.includes(record.activity_id)) {
    fail("exercise_activity_mismatch", "Metric-exercise link activity_id must be declared on the referenced exercise candidate.", {
      metric_exercise_link_id: record.metric_exercise_link_id,
      exercise_id: record.exercise_id,
      activity_id: record.activity_id
    });
  }

  if (!applicabilitySet.has(`${record.exercise_id}::${record.activity_id}`)) {
    fail("exercise_activity_applicability_missing", "Metric-exercise link must have a matching S-REG-09 exercise-activity applicability record.", {
      metric_exercise_link_id: record.metric_exercise_link_id,
      exercise_id: record.exercise_id,
      activity_id: record.activity_id
    });
  }

  if (record.sport_metric_id === "rugby_union__sprint_time_seconds") {
    fail("sprint_metric_link_without_sprint_exercise", "Rugby sprint time metric must not be linked until a factual sprint exercise candidate exists.", {
      metric_exercise_link_id: record.metric_exercise_link_id,
      sport_metric_id: record.sport_metric_id
    });
  }
}

function sReg12ValidateMetricExerciseLinkCandidateSeeds({ metricExerciseLinkDocument, upstreamSurface, sportMetricDocument, applicabilityDocument } = {}) {
  const upstream = upstreamSurface ?? sReg06LoadCandidateSeedFiles();
  const upstreamResult = sReg06ValidateCandidateSeedSurface(upstream);

  if (!upstreamResult.ok) {
    fail("s_reg_06_surface_invalid", "S-REG-06 candidate surface did not validate.", { upstream_result: upstreamResult });
  }

  const applicability = applicabilityDocument ?? sReg09LoadApplicabilityCandidateSeedFile();
  const applicabilityResult = sReg09ValidateExerciseActivityApplicabilityCandidateSeeds({
    applicabilityDocument: applicability,
    upstreamSurface: upstream
  });

  if (!applicabilityResult.ok) {
    fail("s_reg_09_surface_invalid", "S-REG-09 exercise-activity applicability surface did not validate.", { applicability_result: applicabilityResult });
  }

  const metricDocument = sportMetricDocument ?? sReg11LoadSportMetricCandidateSeedFile();
  const metricResult = sReg11ValidateSportMetricCandidateSeeds({
    sportMetricDocument: metricDocument,
    upstreamSurface: upstream
  });

  if (!metricResult.ok) {
    fail("s_reg_11_surface_invalid", "S-REG-11 sport metric candidate surface did not validate.", { metric_result: metricResult });
  }

  const doc = metricExerciseLinkDocument ?? sReg12LoadMetricExerciseLinkCandidateSeedFile();
  assertDocumentBoundary(doc);

  const activityIds = requireUnique(upstream.activity_registry_1.records, "activity_id", "activity_registry_1");
  requireUnique(doc.records, "metric_exercise_link_id", S_REG_12_REGISTRY_ID);

  const exerciseById = new Map();

  for (const exercise of upstream.exercise_registry_3a.records) {
    requireString(exercise.exercise_id, "exercise_id", {
      registry_id: "exercise_registry_3a"
    });
    exerciseById.set(exercise.exercise_id, exercise);
  }

  const metricById = new Map();

  for (const metric of metricDocument.records) {
    requireString(metric.sport_metric_id, "sport_metric_id", {
      registry_id: "sport_metric_registry_1c"
    });
    metricById.set(metric.sport_metric_id, metric);
  }

  const applicabilitySet = buildExerciseActivityApplicabilitySet(applicability);

  for (let index = 0; index < S_REG_12_EXPECTED_LINKS.length; index += 1) {
    assertLinkRecord(doc.records[index], S_REG_12_EXPECTED_LINKS[index], activityIds, exerciseById, metricById, applicabilitySet);
  }

  return deepFreeze({
    ok: true,
    slice_id: S_REG_12_SLICE_ID,
    registry_id: S_REG_12_REGISTRY_ID,
    metric_exercise_link_count: doc.records.length,
    sport_metric_count: metricById.size,
    exercise_count: exerciseById.size,
    activity_count: activityIds.size,
    metric_exercise_link_seed_status: S_REG_12_SEED_STATUS,
    activation_ready: false,
    runtime_status: S_REG_12_RUNTIME_STATUS
  });
}

export {
  S_REG_12_CANDIDATE_PATHS,
  S_REG_12_CONTEXT_SCOPE,
  S_REG_12_FAILURE_TOKEN,
  S_REG_12_LINK_KIND,
  S_REG_12_REGISTRY_ID,
  S_REG_12_RUNTIME_STATUS,
  S_REG_12_SEED_STATUS,
  S_REG_12_SLICE_ID,
  S_REG_12_VALUE_CONTEXT,
  sReg12CandidatePaths,
  sReg12LoadMetricExerciseLinkCandidateSeedFile,
  sReg12ValidateMetricExerciseLinkCandidateSeeds
};