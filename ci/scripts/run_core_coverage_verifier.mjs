import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MOVEMENT_REGISTRY_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "registries",
  "movement",
  "movement.registry.json",
);

const DEFAULT_EXERCISE_REGISTRY_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "registries",
  "exercise",
  "exercise.registry.json",
);

export const REQUIRED_CORE_MOVEMENTS = [
  "anti_rotation",
  "loaded_flexion",
  "rotational_work",
];

export const REQUIRED_CORE_EXERCISE_IDS = {
  anti_rotation: ["pallof_press"],
  loaded_flexion: ["cable_crunch"],
  rotational_work: ["cable_woodchop"],
};

function fail(message) {
  const error = new Error(message);
  error.name = "CoreCoverageError";
  throw error;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function loadMovementRegistry(registryPath = DEFAULT_MOVEMENT_REGISTRY_PATH) {
  const parsed = readJson(registryPath);

  if (!parsed || typeof parsed !== "object") {
    fail("Movement registry must parse to an object.");
  }

  if (!parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
    fail("Movement registry must contain an object at entries.");
  }

  return parsed;
}

export function loadExerciseRegistry(registryPath = DEFAULT_EXERCISE_REGISTRY_PATH) {
  const parsed = readJson(registryPath);

  if (!parsed || typeof parsed !== "object") {
    fail("Exercise registry must parse to an object.");
  }

  if (!parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
    fail("Exercise registry must contain an object at entries.");
  }

  return parsed;
}

function collectEquipmentTokens(exercise) {
  const values = [];

  if (Array.isArray(exercise?.equipment)) {
    for (const item of exercise.equipment) {
      if (typeof item === "string" && item.trim()) values.push(item.trim().toLowerCase());
    }
  }

  if (Array.isArray(exercise?.equipment_tags)) {
    for (const item of exercise.equipment_tags) {
      if (typeof item === "string" && item.trim()) values.push(item.trim().toLowerCase());
    }
  }

  return [...new Set(values)];
}

export function evaluateCoreCoverage(movementRegistry, exerciseRegistry) {
  const movementEntries = movementRegistry?.entries;
  const exerciseEntries = exerciseRegistry?.entries;

  if (!movementEntries || typeof movementEntries !== "object" || Array.isArray(movementEntries)) {
    fail("Movement registry entries must be an object.");
  }

  if (!exerciseEntries || typeof exerciseEntries !== "object" || Array.isArray(exerciseEntries)) {
    fail("Exercise registry entries must be an object.");
  }

  const movementPresence = Object.fromEntries(
    REQUIRED_CORE_MOVEMENTS.map((movementId) => [movementId, !!movementEntries[movementId]])
  );

  const exercisesByMovement = {};
  const exerciseDetailsByMovement = {};

  for (const movementId of REQUIRED_CORE_MOVEMENTS) {
    const matchingExercises = Object.values(exerciseEntries).filter((exercise) => {
      if (!exercise || typeof exercise !== "object") return false;
      return typeof exercise.pattern === "string" && exercise.pattern.trim().toLowerCase() === movementId;
    });

    const ids = matchingExercises
      .map((exercise) => (typeof exercise.exercise_id === "string" ? exercise.exercise_id : null))
      .filter(Boolean)
      .sort();

    exercisesByMovement[movementId] = ids;
    exerciseDetailsByMovement[movementId] = matchingExercises.map((exercise) => ({
      exercise_id: exercise.exercise_id,
      equipment_tokens: collectEquipmentTokens(exercise),
      joint_stress_tags: Array.isArray(exercise.joint_stress_tags) ? exercise.joint_stress_tags : [],
      difficulty_tier: exercise.difficulty_tier ?? null,
      equipment_tier: exercise.equipment_tier ?? null,
    }));
  }

  const missingMovements = REQUIRED_CORE_MOVEMENTS.filter((movementId) => !movementPresence[movementId]);

  const missingRequiredExerciseIds = Object.fromEntries(
    REQUIRED_CORE_MOVEMENTS.map((movementId) => [
      movementId,
      REQUIRED_CORE_EXERCISE_IDS[movementId].filter(
        (exerciseId) => !(exercisesByMovement[movementId] ?? []).includes(exerciseId),
      ),
    ]),
  );

  const incompleteMovements = REQUIRED_CORE_MOVEMENTS.filter(
    (movementId) => missingRequiredExerciseIds[movementId].length > 0,
  );

  return {
    ok: missingMovements.length === 0 && incompleteMovements.length === 0,
    required_core_movements: [...REQUIRED_CORE_MOVEMENTS],
    required_core_exercise_ids: REQUIRED_CORE_EXERCISE_IDS,
    missing_movements: missingMovements,
    missing_required_exercise_ids: missingRequiredExerciseIds,
    exercises_by_movement: exercisesByMovement,
    exercise_details_by_movement: exerciseDetailsByMovement,
  };
}

export function verifyCoreCoverage(
  movementRegistryPath = DEFAULT_MOVEMENT_REGISTRY_PATH,
  exerciseRegistryPath = DEFAULT_EXERCISE_REGISTRY_PATH,
) {
  const movementRegistry = loadMovementRegistry(movementRegistryPath);
  const exerciseRegistry = loadExerciseRegistry(exerciseRegistryPath);
  const result = evaluateCoreCoverage(movementRegistry, exerciseRegistry);

  if (result.missing_movements.length > 0) {
    fail(`Core coverage missing movement ids: ${result.missing_movements.join(", ")}`);
  }

  const missingPairs = Object.entries(result.missing_required_exercise_ids)
    .filter(([, ids]) => ids.length > 0)
    .map(([movementId, ids]) => `${movementId} -> ${ids.join(", ")}`);

  if (missingPairs.length > 0) {
    fail(`Core coverage missing required exercise ids: ${missingPairs.join(" ; ")}`);
  }

  return result;
}

function main() {
  const movementRegistryPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_MOVEMENT_REGISTRY_PATH;

  const exerciseRegistryPath = process.argv[3]
    ? path.resolve(process.cwd(), process.argv[3])
    : DEFAULT_EXERCISE_REGISTRY_PATH;

  try {
    const result = verifyCoreCoverage(movementRegistryPath, exerciseRegistryPath);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}