import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_INPUT_PATH = "test/fixtures/phase1.valid.json";

const TOP_LEVEL_ALLOWED_FIELDS = new Set([
  "consent_granted",
  "age_declaration",
  "jurisdiction_acknowledged",
  "actor_type",
  "execution_scope",
  "governing_authority_id",
  "activity_id",
  "location_type",
  "nd_mode",
  "instruction_density",
  "exposure_prompt_density",
  "bias_mode",
  "baseline_metrics"
]);

const METRIC_ALLOWED_FIELDS = new Set([
  "metric_id",
  "activity_id",
  "value",
  "recorded_at",
  "linked_exercise_token_id",
  "source",
  "notes"
]);

const ALLOWED_ACTOR_TYPES = new Set(["individual_user", "coach"]);
const ALLOWED_EXECUTION_SCOPES = new Set(["individual", "coach_managed"]);
const ALLOWED_ACTIVITIES = new Set(["powerlifting", "rugby_union", "general_strength"]);
const ALLOWED_AGE_DECLARATIONS = new Set(["adult", "minor"]);
const ALLOWED_LOCATION_TYPES = new Set(["home", "gym", "field", "track", "facility"]);
const ALLOWED_INSTRUCTION_DENSITY = new Set(["minimal", "standard", "detailed"]);
const ALLOWED_EXPOSURE_PROMPT_DENSITY = new Set(["minimal", "standard", "detailed"]);
const ALLOWED_BIAS_MODE = new Set(["consistency", "variety", "neutral"]);
const ALLOWED_METRIC_SOURCES = new Set(["user_manual", "coach_entered", "imported"]);

function fail(code, msg) {
  console.error(`CI_FAIL::${code}::${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`CI_OK::${msg}`);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    fail("missing_phase1", `Input not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("invalid_json", `Input is not valid JSON: ${filePath}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("invalid_shape", "Phase 1 root must be an object");
  }

  return parsed;
}

function ensureNoUnknownTopLevelFields(data) {
  for (const key of Object.keys(data)) {
    if (!TOP_LEVEL_ALLOWED_FIELDS.has(key)) {
      fail("unknown_field", key);
    }
  }
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

function validateBaselineMetrics(rootActivityId, baselineMetrics) {
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
      if (!METRIC_ALLOWED_FIELDS.has(key)) {
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

    if ("source" in metric && !ALLOWED_METRIC_SOURCES.has(metric.source)) {
      fail("metric_invalid_source", `${prefix}.source=${String(metric.source)}`);
    }

    if ("notes" in metric && typeof metric.notes !== "string") {
      fail("metric_invalid_notes", `${prefix}.notes must be string`);
    }
  }
}

function main() {
  const inputPath = path.resolve(process.cwd(), process.env.PHASE1_INPUT_PATH || DEFAULT_INPUT_PATH);
  const data = readJson(inputPath);

  ensureNoUnknownTopLevelFields(data);

  ensureBooleanTrue("consent_granted", data.consent_granted, "consent_not_granted");
  ensureBooleanTrue("jurisdiction_acknowledged", data.jurisdiction_acknowledged, "jurisdiction_not_acknowledged");

  ensureStringEnum("age_declaration", data.age_declaration, ALLOWED_AGE_DECLARATIONS, "invalid_age_declaration");
  ensureStringEnum("actor_type", data.actor_type, ALLOWED_ACTOR_TYPES, "invalid_actor_type");
  ensureStringEnum("execution_scope", data.execution_scope, ALLOWED_EXECUTION_SCOPES, "invalid_execution_scope");
  ensureStringEnum("activity_id", data.activity_id, ALLOWED_ACTIVITIES, "invalid_activity_id");
  ensureStringEnum("location_type", data.location_type, ALLOWED_LOCATION_TYPES, "invalid_location_type");
  ensureStringEnum("instruction_density", data.instruction_density, ALLOWED_INSTRUCTION_DENSITY, "invalid_instruction_density");
  ensureStringEnum("exposure_prompt_density", data.exposure_prompt_density, ALLOWED_EXPOSURE_PROMPT_DENSITY, "invalid_exposure_prompt_density");
  ensureStringEnum("bias_mode", data.bias_mode, ALLOWED_BIAS_MODE, "invalid_bias_mode");

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
    validateBaselineMetrics(data.activity_id, data.baseline_metrics);
  }

  const canonicalHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");

  if (typeof canonicalHash !== "string" || canonicalHash.length !== 64) {
    fail("hashing_failed", "canonical hash not generated");
  }

  ok(`phase1_valid::sha256=${canonicalHash}`);
}

main();
