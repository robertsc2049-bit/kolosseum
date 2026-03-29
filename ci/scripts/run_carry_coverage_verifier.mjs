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

export const REQUIRED_CARRY_EXERCISE_IDS = [
  "farmers_carry",
  "sandbag_carry",
  "yoke_carry",
];

function fail(message) {
  const error = new Error(message);
  error.name = "CarryCoverageError";
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

export function evaluateCarryCoverage(movementRegistry, exerciseRegistry) {
  const movementEntries = movementRegistry?.entries;
  const exerciseEntries = exerciseRegistry?.entries;

  if (!movementEntries || typeof movementEntries !== "object" || Array.isArray(movementEntries)) {
    fail("Movement registry entries must be an object.");
  }

  if (!exerciseEntries || typeof exerciseEntries !== "object" || Array.isArray(exerciseEntries)) {
    fail("Exercise registry entries must be an object.");
  }

  const carryMovement = movementEntries.carry ?? null;
  const carryMovementPresent = !!carryMovement;

  const carryExercises = Object.values(exerciseEntries).filter((exercise) => {
    if (!exercise || typeof exercise !== "object") return false;
    return typeof exercise.pattern === "string" && exercise.pattern.trim().toLowerCase() === "carry";
  });

  const carryExerciseIds = carryExercises
    .map((exercise) => (typeof exercise.exercise_id === "string" ? exercise.exercise_id : null))
    .filter(Boolean)
    .sort();

  const missingRequiredExerciseIds = REQUIRED_CARRY_EXERCISE_IDS.filter(
    (exerciseId) => !carryExerciseIds.includes(exerciseId),
  );

  const equipmentVocab = Array.isArray(carryMovement?.equipment_vocab)
    ? carryMovement.equipment_vocab
        .filter((token) => typeof token === "string" && token.trim())
        .map((token) => token.trim().toLowerCase())
        .sort()
    : [];

  const carryJointStressVocab = Array.isArray(carryMovement?.joint_stress_tags_vocab)
    ? carryMovement.joint_stress_tags_vocab
        .filter((token) => typeof token === "string" && token.trim())
        .map((token) => token.trim().toLowerCase())
        .sort()
    : [];

  const carryExerciseDetails = carryExercises.map((exercise) => ({
    exercise_id: exercise.exercise_id,
    equipment_tokens: collectEquipmentTokens(exercise),
    joint_stress_tags: Array.isArray(exercise.joint_stress_tags) ? exercise.joint_stress_tags : [],
    difficulty_tier: exercise.difficulty_tier ?? null,
    equipment_tier: exercise.equipment_tier ?? null,
  }));

  const ok =
    carryMovementPresent &&
    carryExerciseIds.length >= 3 &&
    missingRequiredExerciseIds.length === 0;

  return {
    ok,
    carry_movement_present: carryMovementPresent,
    required_carry_exercise_ids: [...REQUIRED_CARRY_EXERCISE_IDS],
    carry_exercise_count: carryExerciseIds.length,
    carry_exercise_ids: carryExerciseIds,
    missing_required_exercise_ids: missingRequiredExerciseIds,
    carry_equipment_vocab: equipmentVocab,
    carry_joint_stress_vocab: carryJointStressVocab,
    carry_exercise_details: carryExerciseDetails,
  };
}

export function verifyCarryCoverage(
  movementRegistryPath = DEFAULT_MOVEMENT_REGISTRY_PATH,
  exerciseRegistryPath = DEFAULT_EXERCISE_REGISTRY_PATH,
) {
  const movementRegistry = loadMovementRegistry(movementRegistryPath);
  const exerciseRegistry = loadExerciseRegistry(exerciseRegistryPath);
  const result = evaluateCarryCoverage(movementRegistry, exerciseRegistry);

  if (!result.carry_movement_present) {
    fail("Carry movement is missing from movement registry.");
  }

  if (result.carry_exercise_count < 3) {
    fail(`Carry movement requires at least 3 exercise entries; found ${result.carry_exercise_count}.`);
  }

  if (result.missing_required_exercise_ids.length > 0) {
    fail(`Carry movement is missing required exercise ids: ${result.missing_required_exercise_ids.join(", ")}`);
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
    const result = verifyCarryCoverage(movementRegistryPath, exerciseRegistryPath);
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