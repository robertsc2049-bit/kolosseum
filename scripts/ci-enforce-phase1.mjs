import fs from "node:fs";
import crypto from "node:crypto";

function fail(code, msg) {
  console.error(`CI_FAIL::${code}::${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`CI_OK::${msg}`);
}

const inputPath = "test/fixtures/phase1.json";

if (!fs.existsSync(inputPath)) {
  fail("missing_phase1", "Phase 1 input not found");
}

const raw = fs.readFileSync(inputPath, "utf8");

let data;
try {
  data = JSON.parse(raw);
} catch {
  fail("invalid_json", "Phase 1 not valid JSON");
}

if (data === null || typeof data !== "object" || Array.isArray(data)) {
  fail("invalid_shape", "Phase 1 root must be an object");
}

if (data.consent_granted !== true) {
  fail("consent_missing", "Consent not granted");
}

if (typeof data.age_declaration !== "string" || data.age_declaration.length === 0) {
  fail("age_missing", "Age declaration missing");
}

if (data.jurisdiction_acknowledged !== true) {
  fail("jurisdiction_missing", "Jurisdiction not acknowledged");
}

if (typeof data.activity_id !== "string" || data.activity_id.length === 0) {
  fail("activity_missing", "activity_id missing");
}

if ("baseline_metrics" in data) {
  if (!Array.isArray(data.baseline_metrics)) {
    fail("metrics_not_array", "baseline_metrics must be array");
  }

  const allowedMetricFields = new Set([
    "metric_id",
    "activity_id",
    "value",
    "recorded_at",
    "linked_exercise_token_id",
    "source",
    "notes"
  ]);

  for (let i = 0; i < data.baseline_metrics.length; i += 1) {
    const m = data.baseline_metrics[i];

    if (m === null || typeof m !== "object" || Array.isArray(m)) {
      fail("metric_invalid_shape", `baseline_metrics[${i}] must be object`);
    }

    for (const key of Object.keys(m)) {
      if (!allowedMetricFields.has(key)) {
        fail("unknown_metric_field", `baseline_metrics[${i}].${key}`);
      }
    }

    if (typeof m.metric_id !== "string" || m.metric_id.length === 0) {
      fail("metric_missing_id", `baseline_metrics[${i}].metric_id missing`);
    }

    if (typeof m.activity_id !== "string" || m.activity_id.length === 0) {
      fail("metric_missing_activity", `baseline_metrics[${i}].activity_id missing`);
    }

    if (!("value" in m) || m.value === null || typeof m.value !== "object" || Array.isArray(m.value)) {
      fail("metric_missing_value", `baseline_metrics[${i}].value missing`);
    }

    if ("recorded_at" in m && typeof m.recorded_at !== "string") {
      fail("metric_invalid_recorded_at", `baseline_metrics[${i}].recorded_at must be string`);
    }

    if ("linked_exercise_token_id" in m && typeof m.linked_exercise_token_id !== "string") {
      fail("metric_invalid_linked_exercise", `baseline_metrics[${i}].linked_exercise_token_id must be string`);
    }

    if ("source" in m && typeof m.source !== "string") {
      fail("metric_invalid_source", `baseline_metrics[${i}].source must be string`);
    }

    if ("notes" in m && typeof m.notes !== "string") {
      fail("metric_invalid_notes", `baseline_metrics[${i}].notes must be string`);
    }
  }
}

const hash = crypto
  .createHash("sha256")
  .update(JSON.stringify(data))
  .digest("hex");

if (typeof hash !== "string" || hash.length !== 64) {
  fail("hash_failure", "hash not generated");
}

ok(`phase1_valid::sha256=${hash}`);
