import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LOCKED_CORE_COMPOUND_SET = Object.freeze({
  squat: Object.freeze(["back_squat"]),
  hinge: Object.freeze(["deadlift"]),
  horizontal_push: Object.freeze(["bench_press"]),
  vertical_push: Object.freeze(["overhead_press"]),
});

function fail(message) {
  const err = new Error(message);
  err.name = "CanonicalCompoundSetLockVerifierError";
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

export function verifyCanonicalCompoundSetLock({
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

  const lockedPatterns = Object.keys(LOCKED_CORE_COMPOUND_SET);
  const lockedExerciseIds = [];
  const verified = [];

  for (const pattern of lockedPatterns) {
    const requiredIds = LOCKED_CORE_COMPOUND_SET[pattern];

    if (!Array.isArray(requiredIds) || requiredIds.length === 0) {
      fail(`Locked compound pattern '${pattern}' must declare at least one exercise.`);
    }

    for (const requiredExerciseId of requiredIds) {
      lockedExerciseIds.push(requiredExerciseId);

      const entry = entries[requiredExerciseId];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        fail(
          `Locked core lift '${requiredExerciseId}' is missing from exercise registry. Pattern '${pattern}' must not be removable.`
        );
      }

      const actualExerciseId =
        typeof entry.exercise_id === "string" && entry.exercise_id.trim() !== ""
          ? entry.exercise_id
          : null;

      if (!actualExerciseId) {
        fail(`Locked core lift '${requiredExerciseId}' is missing a valid exercise_id.`);
      }

      if (actualExerciseId !== requiredExerciseId) {
        fail(
          `Locked core lift '${requiredExerciseId}' has mismatched exercise_id '${actualExerciseId}'.`
        );
      }

      const actualPattern =
        typeof entry.pattern === "string" && entry.pattern.trim() !== ""
          ? entry.pattern
          : null;

      if (!actualPattern) {
        fail(`Locked core lift '${requiredExerciseId}' is missing required field 'pattern'.`);
      }

      if (actualPattern !== pattern) {
        fail(
          `Locked core lift '${requiredExerciseId}' must remain in pattern '${pattern}', got '${actualPattern}'.`
        );
      }

      verified.push({
        pattern,
        exercise_id: requiredExerciseId,
      });
    }
  }

  return {
    ok: true,
    exercise_registry_path: resolvedExerciseRegistryPath,
    locked_pattern_count: lockedPatterns.length,
    locked_exercise_count: lockedExerciseIds.length,
    locked_core_compound_set: LOCKED_CORE_COMPOUND_SET,
    verified,
  };
}

function main() {
  const exerciseRegistryPathArg = process.argv[2];

  if (!exerciseRegistryPathArg) {
    fail(
      "Usage: node .\\ci\\scripts\\run_canonical_compound_set_lock_verifier.mjs <exercise-registry-path>"
    );
  }

  const result = verifyCanonicalCompoundSetLock({
    exerciseRegistryPath: exerciseRegistryPathArg,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath && invokedPath === path.resolve(modulePath)) {
  main();
}