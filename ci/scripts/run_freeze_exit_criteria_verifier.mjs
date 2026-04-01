import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_FREEZE_EXIT_CRITERIA_INVALID";
const DEFAULT_CRITERIA_PATH = "docs/releases/V1_FREEZE_EXIT_CRITERIA.json";
const DEFAULT_FREEZE_STATE_PATH = "docs/releases/V1_FREEZE_STATE.json";

const REQUIRED_KEYS = [
  "schema_version",
  "freeze_exit_permitted",
  "freeze_exit_declared_by",
  "required_exit_checks",
  "required_exit_artefacts",
  "allowed_exit_transition",
  "notes",
];

const REQUIRED_EXIT_CHECKS = [
  "freeze_state_bound_to_lifecycle",
  "promotion_readiness_bound_to_freeze_state",
  "freeze_drift_evidence_present",
  "freeze_packaging_composition_closed_world",
];

const REQUIRED_EXIT_ARTEFACTS = [
  "docs/releases/V1_FREEZE_STATE.json",
  "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json",
  "docs/releases/V1_FREEZE_PACKAGING_ARTEFACT_SET.json",
  "docs/releases/V1_PROMOTION_READINESS.json",
];

function fail(details, extra = {}) {
  return {
    ok: false,
    failures: [
      {
        token: TOKEN,
        details,
        ...extra,
      },
    ],
  };
}

function ok(meta = {}) {
  return { ok: true, ...meta };
}

function normalizePath(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function uniqueSortedStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))].sort();
}

function uniqueSortedPaths(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => normalizePath(value)).filter(Boolean))].sort();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { __read_error__: `Failed to read JSON at ${filePath}: ${message}` };
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function verifyFreezeExitCriteria({
  criteriaPath,
  freezeStatePath,
}) {
  const criteria = readJson(criteriaPath);
  if (criteria.__read_error__) {
    return fail(criteria.__read_error__, { path: normalizePath(criteriaPath) });
  }

  if (!isPlainObject(criteria)) {
    return fail(
      "Freeze exit criteria artefact must be a JSON object.",
      { path: normalizePath(criteriaPath) }
    );
  }

  const freezeState = readJson(freezeStatePath);
  if (freezeState.__read_error__) {
    return fail(freezeState.__read_error__, { path: normalizePath(freezeStatePath) });
  }

  if (!isPlainObject(freezeState)) {
    return fail(
      "Freeze state artefact must be a JSON object.",
      { path: normalizePath(freezeStatePath) }
    );
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in criteria)) {
      return fail(
        `Freeze exit criteria is missing required field '${key}'.`,
        {
          path: normalizePath(criteriaPath),
          field: key,
        }
      );
    }
  }

  const allowedKeys = new Set(REQUIRED_KEYS);
  for (const key of Object.keys(criteria)) {
    if (!allowedKeys.has(key)) {
      return fail(
        `Freeze exit criteria contains unknown field '${key}'.`,
        {
          path: normalizePath(criteriaPath),
          field: key,
        }
      );
    }
  }

  if (criteria.schema_version !== "kolosseum.freeze_exit_criteria.v1") {
    return fail(
      "Freeze exit criteria schema_version must equal 'kolosseum.freeze_exit_criteria.v1'.",
      {
        path: normalizePath(criteriaPath),
        field: "schema_version",
      }
    );
  }

  if (criteria.freeze_exit_permitted !== false) {
    return fail(
      "Freeze exit criteria freeze_exit_permitted must be false until a lawful exit artefact explicitly changes it.",
      {
        path: normalizePath(criteriaPath),
        field: "freeze_exit_permitted",
      }
    );
  }

  const declaredBy = String(criteria.freeze_exit_declared_by ?? "").trim();
  if (!declaredBy) {
    return fail(
      "Freeze exit criteria freeze_exit_declared_by must be a non-empty string.",
      {
        path: normalizePath(criteriaPath),
        field: "freeze_exit_declared_by",
      }
    );
  }

  const requiredExitChecks = uniqueSortedStrings(criteria.required_exit_checks);
  const missingChecks = REQUIRED_EXIT_CHECKS.filter((item) => !requiredExitChecks.includes(item));
  if (requiredExitChecks.length === 0 || missingChecks.length > 0) {
    return fail(
      `Freeze exit criteria required_exit_checks is incomplete. Missing: ${missingChecks.join(", ")}`,
      {
        path: normalizePath(criteriaPath),
        field: "required_exit_checks",
        missing_required_exit_checks: missingChecks,
      }
    );
  }

  const requiredExitArtefacts = uniqueSortedPaths(criteria.required_exit_artefacts);
  const missingArtefacts = REQUIRED_EXIT_ARTEFACTS.filter((item) => !requiredExitArtefacts.includes(item));
  if (requiredExitArtefacts.length === 0 || missingArtefacts.length > 0) {
    return fail(
      `Freeze exit criteria required_exit_artefacts is incomplete. Missing: ${missingArtefacts.join(", ")}`,
      {
        path: normalizePath(criteriaPath),
        field: "required_exit_artefacts",
        missing_required_exit_artefacts: missingArtefacts,
      }
    );
  }

  const allowedExitTransition = String(criteria.allowed_exit_transition ?? "").trim();
  if (allowedExitTransition !== "sealed -> released") {
    return fail(
      "Freeze exit criteria allowed_exit_transition must equal 'sealed -> released'.",
      {
        path: normalizePath(criteriaPath),
        field: "allowed_exit_transition",
      }
    );
  }

  if (typeof criteria.notes !== "string" || !criteria.notes.trim()) {
    return fail(
      "Freeze exit criteria notes must be a non-empty string.",
      {
        path: normalizePath(criteriaPath),
        field: "notes",
      }
    );
  }

  const freezeStateValue = String(freezeState.freeze_state ?? "").trim().toLowerCase();
  if (freezeStateValue !== "sealed") {
    return fail(
      `Freeze exit criteria can only be evaluated from freeze_state 'sealed'. Received '${freezeStateValue}'.`,
      {
        path: normalizePath(freezeStatePath),
        field: "freeze_state",
      }
    );
  }

  return ok({
    criteria_path: normalizePath(criteriaPath),
    freeze_state_path: normalizePath(freezeStatePath),
    freeze_state: freezeStateValue,
    allowed_exit_transition: allowedExitTransition,
    freeze_exit_permitted: false,
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length > 2) {
    process.stderr.write(
      JSON.stringify(
        fail(
          "Usage: node ci/scripts/run_freeze_exit_criteria_verifier.mjs [criteriaPath] [freezeStatePath]"
        ),
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  }

  const criteriaPath = path.resolve(args[0] ?? DEFAULT_CRITERIA_PATH);
  const freezeStatePath = path.resolve(args[1] ?? DEFAULT_FREEZE_STATE_PATH);

  const result = verifyFreezeExitCriteria({
    criteriaPath,
    freezeStatePath,
  });

  const target = result.ok ? process.stdout : process.stderr;
  target.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  DEFAULT_CRITERIA_PATH,
  DEFAULT_FREEZE_STATE_PATH,
  verifyFreezeExitCriteria,
};