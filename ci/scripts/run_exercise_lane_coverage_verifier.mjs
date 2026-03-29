import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  const err = new Error(message);
  err.name = "ExerciseLaneCoverageVerifierError";
  throw err;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getEntriesObject(payload, label) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail(`${label} payload must be an object.`);
  }

  if (!payload.entries || typeof payload.entries !== "object" || Array.isArray(payload.entries)) {
    fail(`${label} payload must contain an object-shaped 'entries' map.`);
  }

  return payload.entries;
}

export function verifyExerciseLaneCoverage({
  movementRegistryPath,
  exerciseRegistryPath,
} = {}) {
  if (typeof movementRegistryPath !== "string" || movementRegistryPath.trim() === "") {
    fail("movementRegistryPath is required.");
  }

  if (typeof exerciseRegistryPath !== "string" || exerciseRegistryPath.trim() === "") {
    fail("exerciseRegistryPath is required.");
  }

  const resolvedMovementRegistryPath = path.resolve(movementRegistryPath);
  const resolvedExerciseRegistryPath = path.resolve(exerciseRegistryPath);

  if (!fs.existsSync(resolvedMovementRegistryPath)) {
    fail(`Missing movement registry file: ${resolvedMovementRegistryPath}`);
  }

  if (!fs.existsSync(resolvedExerciseRegistryPath)) {
    fail(`Missing exercise registry file: ${resolvedExerciseRegistryPath}`);
  }

  const movementPayload = readJson(resolvedMovementRegistryPath);
  const exercisePayload = readJson(resolvedExerciseRegistryPath);

  const movementEntries = getEntriesObject(movementPayload, "Movement registry");
  const exerciseEntries = getEntriesObject(exercisePayload, "Exercise registry");

  const movementEntryKeys = Object.keys(movementEntries);
  const exerciseEntryKeys = Object.keys(exerciseEntries);

  if (movementEntryKeys.length === 0) {
    fail("Movement registry contains zero entries.");
  }

  if (exerciseEntryKeys.length === 0) {
    fail("Exercise registry contains zero entries.");
  }

  const requiredMovementIds = [];
  const seenMovementIds = new Set();
  const coverageByMovement = Object.create(null);

  for (const entryKey of movementEntryKeys) {
    const entry = movementEntries[entryKey];

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`Movement entry '${entryKey}' must be an object.`);
    }

    const movementId =
      typeof entry.movement_id === "string" && entry.movement_id.trim() !== ""
        ? entry.movement_id
        : null;

    if (!movementId) {
      fail(`Movement entry '${entryKey}' is missing a valid movement_id.`);
    }

    if (seenMovementIds.has(movementId)) {
      fail(`Duplicate movement_id detected: ${movementId}`);
    }

    seenMovementIds.add(movementId);
    requiredMovementIds.push(movementId);
    coverageByMovement[movementId] = 0;
  }

  const seenExerciseIds = new Set();

  for (const entryKey of exerciseEntryKeys) {
    const entry = exerciseEntries[entryKey];

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`Exercise entry '${entryKey}' must be an object.`);
    }

    const exerciseId =
      typeof entry.exercise_id === "string" && entry.exercise_id.trim() !== ""
        ? entry.exercise_id
        : null;

    if (!exerciseId) {
      fail(`Exercise entry '${entryKey}' is missing a valid exercise_id.`);
    }

    if (seenExerciseIds.has(exerciseId)) {
      fail(`Duplicate exercise_id detected: ${exerciseId}`);
    }
    seenExerciseIds.add(exerciseId);

    const pattern =
      typeof entry.pattern === "string" && entry.pattern.trim() !== ""
        ? entry.pattern
        : null;

    if (!pattern) {
      fail(`Exercise '${exerciseId}' is missing required field 'pattern'.`);
    }

    if (!seenMovementIds.has(pattern)) {
      fail(`Exercise '${exerciseId}' references unknown movement lane '${pattern}'.`);
    }

    coverageByMovement[pattern] += 1;
  }

  for (const movementId of requiredMovementIds) {
    if (coverageByMovement[movementId] < 1) {
      fail(`Movement lane '${movementId}' must have at least one exercise.`);
    }
  }

  return {
    ok: true,
    movement_registry_path: resolvedMovementRegistryPath,
    exercise_registry_path: resolvedExerciseRegistryPath,
    movement_entry_count: requiredMovementIds.length,
    exercise_entry_count: exerciseEntryKeys.length,
    required_movement_ids: requiredMovementIds,
    coverage_by_movement: coverageByMovement,
  };
}

function main() {
  const movementRegistryPathArg = process.argv[2];
  const exerciseRegistryPathArg = process.argv[3];

  if (!movementRegistryPathArg || !exerciseRegistryPathArg) {
    fail(
      "Usage: node .\\ci\\scripts\\run_exercise_lane_coverage_verifier.mjs <movement-registry-path> <exercise-registry-path>"
    );
  }

  const result = verifyExerciseLaneCoverage({
    movementRegistryPath: movementRegistryPathArg,
    exerciseRegistryPath: exerciseRegistryPathArg,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath && invokedPath === path.resolve(modulePath)) {
  main();
}