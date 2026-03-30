import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function repoRootFromHere() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "..", "..");
}

function collectExercises(payload) {
  if (!isPlainObject(payload)) {
    return {};
  }

  if (isPlainObject(payload.entries)) {
    return payload.entries;
  }

  if (Array.isArray(payload.entries)) {
    const mapped = {};
    for (const entry of payload.entries) {
      if (!isPlainObject(entry)) {
        continue;
      }
      const exerciseId =
        typeof entry.exercise_id === "string" && entry.exercise_id.trim().length > 0
          ? entry.exercise_id.trim()
          : null;
      if (exerciseId) {
        mapped[exerciseId] = entry;
      }
    }
    return mapped;
  }

  return {};
}

function normalizeFailure(scope, code, message, details = {}) {
  return {
    scope,
    code,
    message,
    ...details
  };
}

export function verifyTimeBoxCoverage(registryPath) {
  const resolvedPath = path.resolve(registryPath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const payload = JSON.parse(raw);

  const exercises = collectExercises(payload);
  const failures = [];
  const laneCoverage = new Map();

  for (const [registryKey, exercise] of Object.entries(exercises)) {
    const exerciseId =
      typeof exercise?.exercise_id === "string" && exercise.exercise_id.trim().length > 0
        ? exercise.exercise_id.trim()
        : registryKey;

    if (!isPlainObject(exercise)) {
      failures.push(
        normalizeFailure(
          exerciseId,
          "exercise_not_object",
          "Exercise entry must be an object."
        )
      );
      continue;
    }

    const lane =
      typeof exercise.pattern === "string" && exercise.pattern.trim().length > 0
        ? exercise.pattern.trim()
        : null;

    if (!lane) {
      failures.push(
        normalizeFailure(
          exerciseId,
          "lane_missing",
          "Exercise must declare a non-empty pattern lane.",
          { exercise_id: exerciseId }
        )
      );
      continue;
    }

    const fastExecution = exercise.fast_execution;
    if (typeof fastExecution !== "boolean") {
      failures.push(
        normalizeFailure(
          exerciseId,
          "fast_execution_invalid",
          "Exercise must declare fast_execution as boolean.",
          { exercise_id: exerciseId, lane }
        )
      );
      continue;
    }

    if (!laneCoverage.has(lane)) {
      laneCoverage.set(lane, {
        lane,
        exercise_ids: [],
        fast_exercise_ids: []
      });
    }

    const laneRecord = laneCoverage.get(lane);
    laneRecord.exercise_ids.push(exerciseId);

    if (fastExecution) {
      laneRecord.fast_exercise_ids.push(exerciseId);
    }
  }

  for (const laneRecord of laneCoverage.values()) {
    if (laneRecord.fast_exercise_ids.length === 0) {
      failures.push(
        normalizeFailure(
          laneRecord.lane,
          "lane_missing_fast_option",
          "Lane must contain at least one fast_execution=true exercise.",
          {
            lane: laneRecord.lane,
            exercise_ids: laneRecord.exercise_ids
          }
        )
      );
    }
  }

  const coverage = Array.from(laneCoverage.values()).sort((a, b) =>
    a.lane.localeCompare(b.lane)
  );

  return {
    ok: failures.length === 0,
    verifier: "time_box_coverage",
    registry_path: resolvedPath,
    checked_exercise_count: Object.keys(exercises).length,
    lane_count: coverage.length,
    coverage,
    failures
  };
}

function main() {
  const registryPath =
    process.argv[2] ??
    path.join(repoRootFromHere(), "registries", "exercise", "exercise.registry.json");

  const result = verifyTimeBoxCoverage(registryPath);
  const output = JSON.stringify(result, null, 2);

  if (!result.ok) {
    process.stderr.write(`${output}\n`);
    process.exit(1);
  }

  process.stdout.write(`${output}\n`);
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return path.resolve(entry) === fileURLToPath(import.meta.url);
})();

if (isDirectRun) {
  main();
}