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

function normalizeFailure(exerciseId, pathName, code, message) {
  return {
    exercise_id: exerciseId,
    path: pathName,
    code,
    message,
  };
}

function collectFromObjectMap(objectMap) {
  const exercises = {};

  for (const [key, value] of Object.entries(objectMap)) {
    if (!isPlainObject(value)) {
      continue;
    }

    const exerciseId =
      typeof value.exercise_id === "string" && value.exercise_id.trim().length > 0
        ? value.exercise_id.trim()
        : key;

    exercises[exerciseId] = value;
  }

  return exercises;
}

function collectFromArray(entriesArray) {
  const exercises = {};

  for (const entry of entriesArray) {
    if (!isPlainObject(entry)) {
      continue;
    }

    const exerciseId =
      typeof entry.exercise_id === "string" && entry.exercise_id.trim().length > 0
        ? entry.exercise_id.trim()
        : null;

    if (!exerciseId) {
      continue;
    }

    exercises[exerciseId] = entry;
  }

  return exercises;
}

function extractExercises(payload) {
  if (!isPlainObject(payload)) {
    return {};
  }

  if (Array.isArray(payload.entries)) {
    return collectFromArray(payload.entries);
  }

  if (isPlainObject(payload.entries)) {
    return collectFromObjectMap(payload.entries);
  }

  if (isPlainObject(payload.exercises)) {
    return collectFromObjectMap(payload.exercises);
  }

  const topLevelIgnoredKeys = new Set([
    "registry_header",
    "metadata",
    "entries_schema",
    "schema",
    "version",
  ]);

  const candidateObjectMap = {};
  let foundCandidate = false;

  for (const [key, value] of Object.entries(payload)) {
    if (topLevelIgnoredKeys.has(key)) {
      continue;
    }
    if (!isPlainObject(value)) {
      continue;
    }

    candidateObjectMap[key] = value;
    foundCandidate = true;
  }

  if (foundCandidate) {
    return collectFromObjectMap(candidateObjectMap);
  }

  return {};
}

export function verifyExerciseInstructionPresence(registryPath) {
  const resolvedPath = path.resolve(registryPath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const payload = JSON.parse(raw);

  const exercises = extractExercises(payload);
  const failures = [];

  for (const [registryKey, exercise] of Object.entries(exercises)) {
    const exerciseId =
      typeof exercise.exercise_id === "string" && exercise.exercise_id.trim().length > 0
        ? exercise.exercise_id.trim()
        : registryKey;

    if (!isPlainObject(exercise)) {
      failures.push(
        normalizeFailure(
          exerciseId,
          exerciseId,
          "exercise_not_object",
          "Exercise entry must be an object."
        )
      );
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(exercise, "instruction")) {
      failures.push(
        normalizeFailure(
          exerciseId,
          `${exerciseId}.instruction`,
          "instruction_missing",
          "Exercise is missing required instruction object."
        )
      );
      continue;
    }

    const instruction = exercise.instruction;
    if (!isPlainObject(instruction)) {
      failures.push(
        normalizeFailure(
          exerciseId,
          `${exerciseId}.instruction`,
          "instruction_not_object",
          "instruction must be an object."
        )
      );
      continue;
    }

    const allowedInstructionKeys = new Set(["short", "detailed"]);
    for (const key of Object.keys(instruction)) {
      if (!allowedInstructionKeys.has(key)) {
        failures.push(
          normalizeFailure(
            exerciseId,
            `${exerciseId}.instruction.${key}`,
            "instruction_extra_key",
            `instruction contains forbidden key '${key}'.`
          )
        );
      }
    }

    if (!Object.prototype.hasOwnProperty.call(instruction, "short")) {
      failures.push(
        normalizeFailure(
          exerciseId,
          `${exerciseId}.instruction.short`,
          "instruction_short_missing",
          "instruction.short is required."
        )
      );
    } else if (typeof instruction.short !== "string") {
      failures.push(
        normalizeFailure(
          exerciseId,
          `${exerciseId}.instruction.short`,
          "instruction_short_not_string",
          "instruction.short must be a string."
        )
      );
    } else if (instruction.short.trim().length === 0) {
      failures.push(
        normalizeFailure(
          exerciseId,
          `${exerciseId}.instruction.short`,
          "instruction_short_empty",
          "instruction.short must be non-empty."
        )
      );
    }

    if (Object.prototype.hasOwnProperty.call(instruction, "detailed")) {
      if (!Array.isArray(instruction.detailed)) {
        failures.push(
          normalizeFailure(
            exerciseId,
            `${exerciseId}.instruction.detailed`,
            "instruction_detailed_not_array",
            "instruction.detailed must be an array when present."
          )
        );
      } else {
        for (let index = 0; index < instruction.detailed.length; index += 1) {
          const cue = instruction.detailed[index];
          if (typeof cue !== "string") {
            failures.push(
              normalizeFailure(
                exerciseId,
                `${exerciseId}.instruction.detailed[${index}]`,
                "instruction_detailed_item_not_string",
                "Detailed instruction cue must be a string."
              )
            );
            continue;
          }

          if (cue.trim().length === 0) {
            failures.push(
              normalizeFailure(
                exerciseId,
                `${exerciseId}.instruction.detailed[${index}]`,
                "instruction_detailed_item_empty",
                "Detailed instruction cue must be non-empty."
              )
            );
          }
        }
      }
    }
  }

  return {
    ok: failures.length === 0,
    verifier: "exercise_instruction_presence",
    registry_path: resolvedPath,
    checked_exercise_count: Object.keys(exercises).length,
    failures,
  };
}

function main() {
  const registryPath =
    process.argv[2] ??
    path.join(repoRootFromHere(), "registries", "exercise", "exercise.registry.json");

  const result = verifyExerciseInstructionPresence(registryPath);

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