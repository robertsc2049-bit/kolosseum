import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_INPUT_PATH = "test/fixtures/phase1.valid.json";
const TRUTH_SURFACE_PATH = "ci/contracts/phase1_v0_truth_surface.json";

function fail(code, msg) {
  console.error(`CI_FAIL::${code}::${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`CI_OK::${msg}`);
}

function readJson(filePath, missingCode, invalidCode) {
  if (!fs.existsSync(filePath)) {
    fail(missingCode, filePath);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(invalidCode, filePath);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(invalidCode, filePath);
  }

  return parsed;
}

function readTruthSurface() {
  const truthPath = path.resolve(process.cwd(), TRUTH_SURFACE_PATH);
  const truth = readJson(truthPath, "missing_truth_surface", "invalid_truth_surface");

  const requiredArrayFields = [
    "top_level_allowed_fields",
    "baseline_metric_allowed_fields",
    "allowed_actor_types",
    "allowed_execution_scopes",
    "allowed_activities",
    "allowed_age_declarations",
    "allowed_location_types",
    "allowed_instruction_density",
    "allowed_exposure_prompt_density",
    "allowed_bias_mode",
    "allowed_metric_sources"
  ];

  for (const key of requiredArrayFields) {
    if (!Array.isArray(truth[key]) || truth[key].some((v) => typeof v !== "string" || v.length === 0)) {
      fail("invalid_truth_surface", `invalid array field: ${key}`);
    }
  }

  return {
    truthPath,
    topLevelAllowedFields: new Set(truth.top_level_allowed_fields),
    baselineMetricAllowedFields: new Set(truth.baseline_metric_allowed_fields),
    allowedActorTypes: new Set(truth.allowed_actor_types),
    allowedExecutionScopes: new Set(truth.allowed_execution_scopes),
    allowedActivities: new Set(truth.allowed_activities),
    allowedAgeDeclarations: new Set(truth.allowed_age_declarations),
    allowedLocationTypes: new Set(truth.allowed_location_types),
    allowedInstructionDensity: new Set(truth.allowed_instruction_density),
    allowedExposurePromptDensity: new Set(truth.allowed_exposure_prompt_density),
    allowedBiasMode: new Set(truth.allowed_bias_mode),
    allowedMetricSources: new Set(truth.allowed_metric_sources)
  };
}

function ensureStringEnum(name, value, allowedSet, failureCode) {
  if (typeof value !== "string" || !allowedSet.has(value)) {
    fail(failureCode, `${name}=${String(value)}`);
  }
}

function ensureBooleanTrue(name, value, failureCode) {
  if (value !== true) {
    fail(failureCode, `${name} must be true`);
  }
}

function validateBaselineMetrics(rootActivityId, baselineMetrics, truth) {
  if (!Array.isArray(baselineMetrics)) {
    fail("metrics_not_array", "baseline_metrics must be an array");
  }

  for (let i = 0; i < baselineMetrics.length; i += 1) {
    const metric = baselineMetrics[i];
    const prefix = `baseline_metrics[${i}]`;

    if (metric === null || typeof metric !== "object" || Array.isArray(metric)) {
      fail("metric_invalid_shape", `${prefix} must be an object`);
    }

    for (const key of Object.keys(metric)) {
      if (!truth.baselineMetricAllowedFields.has(key)) {
        fail("unknown_metric_field", `${prefix}.${key}`);
      }
    }

    if (typeof metric.metric_id !== "string" || metric.metric_id.length === 0) {
      fail("metric_missing_id", `${prefix}.metric_id missing`);
    }

    if (typeof metric.activity_id !== "string" || metric.activity_id.length === 0) {
      fail("metric_missing_activity", `${prefix}.activity_id missing`);
    }

    if (metric.activity_id !== rootActivityId) {
      fail("metric_activity_mismatch", `${prefix}.activity_id=${metric.activity_id} root=${rootActivityId}`);
    }

    if (!("value" in metric) || metric.value === null || typeof metric.value !== "object" || Array.isArray(metric.value)) {
      fail("metric_missing_value", `${prefix}.value missing`);
    }

    if ("recorded_at" in metric && typeof metric.recorded_at !== "string") {
      fail("metric_invalid_recorded_at", `${prefix}.recorded_at must be string`);
    }

    if ("linked_exercise_token_id" in metric && typeof metric.linked_exercise_token_id !== "string") {
      fail("metric_invalid_linked_exercise", `${prefix}.linked_exercise_token_id must be string`);
    }

    if ("source" in metric && !truth.allowedMetricSources.has(metric.source)) {
      fail("metric_invalid_source", `${prefix}.source=${String(metric.source)}`);
    }

    if ("notes" in metric && typeof metric.notes !== "string") {
      fail("metric_invalid_notes", `${prefix}.notes must be string`);
    }
  }
}

function main() {
  const truth = readTruthSurface();
  const inputPath = path.resolve(process.cwd(), process.env.PHASE1_INPUT_PATH || DEFAULT_INPUT_PATH);
  const data = readJson(inputPath, "missing_phase1", "invalid_json");

  for (const key of Object.keys(data)) {
    if (!truth.topLevelAllowedFields.has(key)) {
      fail("unknown_field", key);
    }
  }

  ensureBooleanTrue("consent_granted", data.consent_granted, "consent_not_granted");
  ensureBooleanTrue("jurisdiction_acknowledged", data.jurisdiction_acknowledged, "jurisdiction_not_acknowledged");

  ensureStringEnum("age_declaration", data.age_declaration, truth.allowedAgeDeclarations, "invalid_age_declaration");
  ensureStringEnum("actor_type", data.actor_type, truth.allowedActorTypes, "invalid_actor_type");
  ensureStringEnum("execution_scope", data.execution_scope, truth.allowedExecutionScopes, "invalid_execution_scope");
  ensureStringEnum("activity_id", data.activity_id, truth.allowedActivities, "invalid_activity_id");
  ensureStringEnum("location_type", data.location_type, truth.allowedLocationTypes, "invalid_location_type");
  ensureStringEnum("instruction_density", data.instruction_density, truth.allowedInstructionDensity, "invalid_instruction_density");
  ensureStringEnum("exposure_prompt_density", data.exposure_prompt_density, truth.allowedExposurePromptDensity, "invalid_exposure_prompt_density");
  ensureStringEnum("bias_mode", data.bias_mode, truth.allowedBiasMode, "invalid_bias_mode");

  if (typeof data.nd_mode !== "boolean") {
    fail("invalid_nd_mode", "nd_mode must be boolean");
  }

  if (data.execution_scope === "coach_managed") {
    if (typeof data.governing_authority_id !== "string" || data.governing_authority_id.length === 0) {
      fail("missing_governing_authority", "governing_authority_id required for coach_managed scope");
    }
  } else if ("governing_authority_id" in data && typeof data.governing_authority_id !== "string") {
    fail("invalid_governing_authority", "governing_authority_id must be string when present");
  }

  if ("baseline_metrics" in data) {
    validateBaselineMetrics(data.activity_id, data.baseline_metrics, truth);
  }

  const canonicalHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");

  if (typeof canonicalHash !== "string" || canonicalHash.length !== 64) {
    fail("hashing_failed", "canonical hash not generated");
  }

  ok(`phase1_valid::sha256=${canonicalHash}::truth=${TRUTH_SURFACE_PATH}`);
}

main();
