import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_UNILATERAL_BY_PATTERN = Object.freeze({
  horizontal_push: Object.freeze(["single_arm_dumbbell_press"]),
  vertical_push: Object.freeze(["single_arm_overhead_press"]),
  squat: Object.freeze(["split_squat"]),
  hinge: Object.freeze(["single_leg_rdl"]),
});

function fail(message) {
  const err = new Error(message);
  err.name = "UnilateralCoverageVerifierError";
  throw err;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getEntriesObject(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("Exercise registry payload must be an object.");
  }

  if (!payload.entries || typeof payload.entries !== "object" || Array.isArray(payload.entries)) {
    fail("Exercise registry payload must contain an object-shaped 'entries' map.");
  }

  return payload.entries;
}

export function verifyUnilateralCoverage({
  exerciseRegistryPath,
} = {}) {
  if (typeof exerciseRegistryPath !== "string" || exerciseRegistryPath.trim() === "") {
    fail("exerciseRegistryPath is required.");
  }

  const resolvedExerciseRegistryPath = path.resolve(exerciseRegistryPath);

  if (!fs.existsSync(resolvedExerciseRegistryPath)) {
    fail(`Missing exercise registry file: ${resolvedExerciseRegistryPath}`);
  }

  const payload = readJson(resolvedExerciseRegistryPath);
  const entries = getEntriesObject(payload);
  const entryKeys = Object.keys(entries);

  if (entryKeys.length === 0) {
    fail("Exercise registry contains zero entries.");
  }

  const coverage = [];
  const coverageByPattern = Object.create(null);

  for (const [pattern, requiredIds] of Object.entries(REQUIRED_UNILATERAL_BY_PATTERN)) {
    if (!Array.isArray(requiredIds) || requiredIds.length === 0) {
      fail(`Pattern '${pattern}' must declare at least one unilateral requirement.`);
    }

    coverageByPattern[pattern] = [];

    for (const requiredExerciseId of requiredIds) {
      const entry = entries[requiredExerciseId];

      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        fail(
          `Required unilateral exercise '${requiredExerciseId}' is missing for pattern '${pattern}'.`
        );
      }

      const exerciseId =
        typeof entry.exercise_id === "string" && entry.exercise_id.trim() !== ""
          ? entry.exercise_id
          : null;

      if (!exerciseId) {
        fail(`Required unilateral exercise '${requiredExerciseId}' is missing a valid exercise_id.`);
      }

      if (exerciseId !== requiredExerciseId) {
        fail(
          `Required unilateral exercise '${requiredExerciseId}' has mismatched exercise_id '${exerciseId}'.`
        );
      }

      const actualPattern =
        typeof entry.pattern === "string" && entry.pattern.trim() !== ""
          ? entry.pattern
          : null;

      if (!actualPattern) {
        fail(`Required unilateral exercise '${requiredExerciseId}' is missing required field 'pattern'.`);
      }

      if (actualPattern !== pattern) {
        fail(
          `Required unilateral exercise '${requiredExerciseId}' must remain in pattern '${pattern}', got '${actualPattern}'.`
        );
      }

      coverageByPattern[pattern].push(requiredExerciseId);
      coverage.push({
        pattern,
        exercise_id: requiredExerciseId,
      });
    }

    if (coverageByPattern[pattern].length < 1) {
      fail(`Pattern '${pattern}' must have at least one unilateral option.`);
    }
  }

  return {
    ok: true,
    exercise_registry_path: resolvedExerciseRegistryPath,
    unilateral_pattern_count: Object.keys(REQUIRED_UNILATERAL_BY_PATTERN).length,
    required_unilateral_by_pattern: REQUIRED_UNILATERAL_BY_PATTERN,
    coverage_by_pattern: coverageByPattern,
    verified: coverage,
  };
}

function main() {
  const exerciseRegistryPathArg = process.argv[2];

  if (!exerciseRegistryPathArg) {
    fail(
      "Usage: node .\\ci\\scripts\\run_unilateral_coverage_verifier.mjs <exercise-registry-path>"
    );
  }

  const result = verifyUnilateralCoverage({
    exerciseRegistryPath: exerciseRegistryPathArg,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath && invokedPath === path.resolve(modulePath)) {
  main();
}