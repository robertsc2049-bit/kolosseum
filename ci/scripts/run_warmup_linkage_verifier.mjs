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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

export function verifyWarmupLinkage(exerciseRegistryPath, warmupRegistryPath) {
  const exercisePayload = readJson(exerciseRegistryPath);
  const warmupPayload = readJson(warmupRegistryPath);

  const exercises = collectExercises(exercisePayload);
  const exerciseEntries = Object.entries(exercises);

  const failures = [];
  const laneToExerciseIds = new Map();

  for (const [registryKey, exercise] of exerciseEntries) {
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

    if (!laneToExerciseIds.has(lane)) {
      laneToExerciseIds.set(lane, []);
    }

    laneToExerciseIds.get(lane).push(exerciseId);
  }

  const warmupEntries = isPlainObject(warmupPayload?.entries)
    ? warmupPayload.entries
    : {};

  const coverage = [];

  for (const [lane, exerciseIds] of Array.from(laneToExerciseIds.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const mapping = warmupEntries[lane];

    if (!isPlainObject(mapping)) {
      failures.push(
        normalizeFailure(
          lane,
          "warmup_mapping_missing",
          "Lane must have a warm-up mapping entry.",
          { lane, exercise_ids: exerciseIds }
        )
      );
      continue;
    }

    const declaredLane =
      typeof mapping.lane === "string" && mapping.lane.trim().length > 0
        ? mapping.lane.trim()
        : null;

    if (declaredLane !== lane) {
      failures.push(
        normalizeFailure(
          lane,
          "warmup_lane_mismatch",
          "Warm-up mapping lane must match entry key.",
          { lane, declared_lane: declaredLane }
        )
      );
    }

    const warmUpIds = Array.isArray(mapping.warm_up_ids)
      ? mapping.warm_up_ids
      : null;

    if (!warmUpIds || warmUpIds.length === 0) {
      failures.push(
        normalizeFailure(
          lane,
          "warmup_mapping_empty",
          "Lane must contain at least one warm-up id.",
          { lane }
        )
      );
      continue;
    }

    const seen = new Set();
    const invalidWarmUpIds = [];
    const duplicateWarmUpIds = [];
    const validWarmUpIds = [];

    for (const rawWarmUpId of warmUpIds) {
      const warmUpId =
        typeof rawWarmUpId === "string" && rawWarmUpId.trim().length > 0
          ? rawWarmUpId.trim()
          : null;

      if (!warmUpId) {
        invalidWarmUpIds.push(rawWarmUpId);
        continue;
      }

      if (seen.has(warmUpId)) {
        duplicateWarmUpIds.push(warmUpId);
        continue;
      }

      seen.add(warmUpId);

      if (!Object.prototype.hasOwnProperty.call(exercises, warmUpId)) {
        invalidWarmUpIds.push(warmUpId);
        continue;
      }

      validWarmUpIds.push(warmUpId);
    }

    if (duplicateWarmUpIds.length > 0) {
      failures.push(
        normalizeFailure(
          lane,
          "warmup_duplicate_ids",
          "Lane must not contain duplicate warm-up ids.",
          { lane, duplicate_warm_up_ids: duplicateWarmUpIds }
        )
      );
    }

    if (invalidWarmUpIds.length > 0) {
      failures.push(
        normalizeFailure(
          lane,
          "warmup_invalid_ids",
          "Lane contains invalid warm-up ids.",
          { lane, invalid_warm_up_ids: invalidWarmUpIds }
        )
      );
    }

    coverage.push({
      lane,
      exercise_ids: exerciseIds,
      warm_up_ids: validWarmUpIds
    });
  }

  return {
    ok: failures.length === 0,
    verifier: "warmup_linkage",
    exercise_registry_path: path.resolve(exerciseRegistryPath),
    warmup_registry_path: path.resolve(warmupRegistryPath),
    checked_exercise_count: exerciseEntries.length,
    lane_count: coverage.length,
    coverage,
    failures
  };
}

function main() {
  const repoRoot = repoRootFromHere();
  const exerciseRegistryPath =
    process.argv[2] ??
    path.join(repoRoot, "registries", "exercise", "exercise.registry.json");
  const warmupRegistryPath =
    process.argv[3] ??
    path.join(repoRoot, "registries", "exercise", "exercise_warmup_mapping.registry.json");

  const result = verifyWarmupLinkage(exerciseRegistryPath, warmupRegistryPath);
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