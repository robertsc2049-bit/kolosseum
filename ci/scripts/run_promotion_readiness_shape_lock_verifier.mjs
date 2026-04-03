#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_PROMOTION_READINESS_PATH = "docs/releases/V1_PROMOTION_READINESS.json";

const ALLOWED_TOP_LEVEL_KEYS = [
  "checked_at_utc",
  "closure_gate",
  "failures",
  "invariant",
  "ok",
  "required_reports",
  "verifier_id"
].sort((a, b) => a.localeCompare(b));

const ALLOWED_CLOSURE_GATE_KEYS = [
  "closure_count",
  "failures",
  "invoked",
  "ok",
  "promotion_payload_kind",
  "verifier_id"
].sort((a, b) => a.localeCompare(b));

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeRel(input) {
  return String(input).replace(/\\/g, "/").trim();
}

function fail(token, file, details, extra = {}) {
  return {
    ok: false,
    failures: [
      {
        token,
        file,
        details,
        ...extra
      }
    ]
  };
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    inputPath: DEFAULT_PROMOTION_READINESS_PATH
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--input") {
      args.inputPath = argv[i + 1];
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function validateRequiredReports(value, normalizedInputPath) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const entry = value[i];
      if (!isPlainObject(entry)) {
        return fail(
          "CI_MANIFEST_MISMATCH",
          normalizedInputPath,
          "required_reports array entries must be objects.",
          { path: `required_reports[${i}]` }
        );
      }

      const requiredKeys = ["checked_at_utc", "failure_count", "ok", "path", "verifier_id"];
      for (const key of requiredKeys) {
        if (!(key in entry)) {
          return fail(
            "CI_MANIFEST_MISMATCH",
            normalizedInputPath,
            `required_reports array entry is missing required key '${key}'.`,
            { path: `required_reports[${i}].${key}` }
          );
        }
      }

      if (typeof entry.path !== "string" || entry.path.trim().length === 0) {
        return fail(
          "CI_MANIFEST_MISMATCH",
          normalizedInputPath,
          "required_reports array entry path must be a non-empty string.",
          { path: `required_reports[${i}].path` }
        );
      }

      if (typeof entry.ok !== "boolean") {
        return fail(
          "CI_MANIFEST_MISMATCH",
          normalizedInputPath,
          "required_reports array entry ok must be boolean.",
          { path: `required_reports[${i}].ok` }
        );
      }
    }

    return { ok: true, kind: "array" };
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return fail(
        "CI_MANIFEST_MISMATCH",
        normalizedInputPath,
        "required_reports object must not be empty.",
        { path: "required_reports" }
      );
    }

    for (const key of keys) {
      const entry = value[key];
      if (typeof entry !== "string" || entry.trim().length === 0) {
        return fail(
          "CI_MANIFEST_MISMATCH",
          normalizedInputPath,
          "required_reports object values must be non-empty strings.",
          { path: `required_reports.${key}` }
        );
      }
    }

    return { ok: true, kind: "object" };
  }

  return fail(
    "CI_MANIFEST_MISMATCH",
    normalizedInputPath,
    "required_reports must be either an array of report summary objects or a non-empty object map.",
    { path: "required_reports" }
  );
}

export function verifyPromotionReadinessShapeLock({
  root = process.cwd(),
  inputPath = DEFAULT_PROMOTION_READINESS_PATH
} = {}) {
  const normalizedInputPath = normalizeRel(inputPath);
  const absoluteInputPath = path.resolve(root, inputPath);

  if (!fs.existsSync(absoluteInputPath)) {
    return fail(
      "CI_SPINE_MISSING_DOC",
      normalizedInputPath,
      "Promotion readiness report is missing."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absoluteInputPath, "utf8"));
  } catch (error) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      `Promotion readiness report contains invalid JSON: ${error.message}`
    );
  }

  if (!isPlainObject(parsed)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "Promotion readiness report must be a JSON object."
    );
  }

  const actualTopLevelKeys = Object.keys(parsed).sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(actualTopLevelKeys) !== JSON.stringify(ALLOWED_TOP_LEVEL_KEYS)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "Promotion readiness report top-level keys do not match the frozen contract.",
      {
        expected_keys: ALLOWED_TOP_LEVEL_KEYS,
        actual_keys: actualTopLevelKeys
      }
    );
  }

  if (typeof parsed.ok !== "boolean") {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "Top-level ok must be boolean.",
      { path: "ok" }
    );
  }

  if (typeof parsed.verifier_id !== "string" || parsed.verifier_id !== "postv1_promotion_readiness_runner") {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "verifier_id must be the frozen promotion readiness runner id.",
      { path: "verifier_id" }
    );
  }

  if (!Array.isArray(parsed.failures)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "failures must be an array.",
      { path: "failures" }
    );
  }

  const requiredReportsValidation = validateRequiredReports(parsed.required_reports, normalizedInputPath);
  if (!requiredReportsValidation.ok) {
    return requiredReportsValidation;
  }

  if (!isPlainObject(parsed.closure_gate)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "closure_gate must be an object.",
      { path: "closure_gate" }
    );
  }

  const actualClosureGateKeys = Object.keys(parsed.closure_gate).sort((a, b) => a.localeCompare(b));
  for (const key of actualClosureGateKeys) {
    if (!ALLOWED_CLOSURE_GATE_KEYS.includes(key)) {
      return fail(
        "CI_MANIFEST_MISMATCH",
        normalizedInputPath,
        "closure_gate contains an unknown key outside the frozen contract.",
        {
          path: `closure_gate.${key}`,
          allowed_keys: ALLOWED_CLOSURE_GATE_KEYS
        }
      );
    }
  }

  if (!actualClosureGateKeys.includes("invoked") || !actualClosureGateKeys.includes("ok") || !actualClosureGateKeys.includes("verifier_id")) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "closure_gate must contain invoked, ok, and verifier_id.",
      { path: "closure_gate" }
    );
  }

  if (typeof parsed.closure_gate.invoked !== "boolean") {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "closure_gate.invoked must be boolean.",
      { path: "closure_gate.invoked" }
    );
  }

  if (!(typeof parsed.closure_gate.ok === "boolean" || parsed.closure_gate.ok === null)) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "closure_gate.ok must be boolean or null.",
      { path: "closure_gate.ok" }
    );
  }

  if (typeof parsed.closure_gate.verifier_id !== "string" || parsed.closure_gate.verifier_id !== "freeze_governance_closure_gate") {
    return fail(
      "CI_MANIFEST_MISMATCH",
      normalizedInputPath,
      "closure_gate.verifier_id must be the frozen closure gate verifier id.",
      { path: "closure_gate.verifier_id" }
    );
  }

  return {
    ok: true,
    verifier_id: "promotion_readiness_shape_lock_verifier",
    checked_at_utc: new Date().toISOString(),
    input_path: normalizedInputPath,
    required_reports_kind: requiredReportsValidation.kind,
    allowed_top_level_keys: ALLOWED_TOP_LEVEL_KEYS,
    allowed_closure_gate_keys: ALLOWED_CLOSURE_GATE_KEYS
  };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const report = fail("CI_MANIFEST_MISMATCH", "cli", error.message);
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  const result = verifyPromotionReadinessShapeLock(args);
  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main();
}
