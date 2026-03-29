import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_DIFFICULTY_TIERS = new Set([
  "beginner",
  "intermediate",
  "advanced",
]);

function fail(message) {
  const err = new Error(message);
  err.name = "ExerciseDifficultyTierVerifierError";
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

export function verifyExerciseDifficultyTierLayer({
  registryPath,
} = {}) {
  if (typeof registryPath !== "string" || registryPath.trim() === "") {
    fail("registryPath is required.");
  }

  const resolvedRegistryPath = path.resolve(registryPath);

  if (!fs.existsSync(resolvedRegistryPath)) {
    fail(`Missing registry file: ${resolvedRegistryPath}`);
  }

  const payload = readJson(resolvedRegistryPath);
  const entries = getEntriesObject(payload);
  const entryKeys = Object.keys(entries);

  if (entryKeys.length === 0) {
    fail("Exercise registry contains zero entries.");
  }

  const seenExerciseIds = new Set();

  for (const entryKey of entryKeys) {
    const entry = entries[entryKey];

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

    if (!Object.prototype.hasOwnProperty.call(entry, "difficulty_tier")) {
      fail(`Exercise '${exerciseId}' is missing required field 'difficulty_tier'.`);
    }

    const difficultyTier = entry.difficulty_tier;

    if (typeof difficultyTier !== "string" || difficultyTier.trim() === "") {
      fail(`Exercise '${exerciseId}' field 'difficulty_tier' must be a non-empty string.`);
    }

    if (!ALLOWED_DIFFICULTY_TIERS.has(difficultyTier)) {
      fail(
        `Exercise '${exerciseId}' has illegal difficulty tier '${difficultyTier}'. Allowed: ${[
          ...ALLOWED_DIFFICULTY_TIERS,
        ].join(", ")}.`
      );
    }
  }

  return {
    ok: true,
    registry_path: resolvedRegistryPath,
    entry_count: entryKeys.length,
    allowed_difficulty_tiers: [...ALLOWED_DIFFICULTY_TIERS],
  };
}

function main() {
  const registryPathArg = process.argv[2];
  if (!registryPathArg) {
    fail("Usage: node .\\ci\\scripts\\run_exercise_difficulty_tier_verifier.mjs <registry-path>");
  }

  const result = verifyExerciseDifficultyTierLayer({ registryPath: registryPathArg });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath && invokedPath === path.resolve(modulePath)) {
  main();
}