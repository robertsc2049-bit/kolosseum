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

export const REQUIRED_CORE_MOVEMENT_IDS = [
  "anti_rotation",
  "loaded_flexion",
  "rotational_work",
];

const REQUIRED_EQUIPMENT_BY_MOVEMENT = {
  anti_rotation: ["bodyweight", "cable", "plate"],
  loaded_flexion: ["bodyweight", "cable", "plate"],
  rotational_work: ["bodyweight", "cable", "plate"],
};

const REQUIRED_JOINT_STRESS_BY_MOVEMENT = {
  anti_rotation: ["neutral", "thoracic_low", "lumbar_low"],
  loaded_flexion: ["neutral", "thoracic_low", "lumbar_low"],
  rotational_work: ["neutral", "thoracic_low", "lumbar_low"],
};

function fail(message) {
  const error = new Error(message);
  error.name = "CoreMovementLawError";
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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim().toLowerCase())
    .sort();
}

export function evaluateCoreMovementLaw(movementRegistry) {
  const movementEntries = movementRegistry?.entries;
  if (!movementEntries || typeof movementEntries !== "object" || Array.isArray(movementEntries)) {
    fail("Movement registry entries must be an object.");
  }

  const details = [];
  const missingMovements = [];

  for (const movementId of REQUIRED_CORE_MOVEMENT_IDS) {
    const entry = movementEntries[movementId] ?? null;

    if (!entry) {
      missingMovements.push(movementId);
      details.push({
        movement_id: movementId,
        present: false,
        equipment_vocab: [],
        joint_stress_tags_vocab: [],
        missing_equipment_tokens: [...REQUIRED_EQUIPMENT_BY_MOVEMENT[movementId]],
        missing_joint_stress_tokens: [...REQUIRED_JOINT_STRESS_BY_MOVEMENT[movementId]],
      });
      continue;
    }

    const equipmentVocab = normalizeStringArray(entry.equipment_vocab);
    const jointStressVocab = normalizeStringArray(entry.joint_stress_tags_vocab);

    const missingEquipmentTokens = REQUIRED_EQUIPMENT_BY_MOVEMENT[movementId]
      .filter((token) => !equipmentVocab.includes(token))
      .sort();

    const missingJointStressTokens = REQUIRED_JOINT_STRESS_BY_MOVEMENT[movementId]
      .filter((token) => !jointStressVocab.includes(token))
      .sort();

    details.push({
      movement_id: movementId,
      present: true,
      equipment_vocab: equipmentVocab,
      joint_stress_tags_vocab: jointStressVocab,
      missing_equipment_tokens: missingEquipmentTokens,
      missing_joint_stress_tokens: missingJointStressTokens,
    });
  }

  const invalidMovements = details
    .filter((item) => item.present && (item.missing_equipment_tokens.length > 0 || item.missing_joint_stress_tokens.length > 0))
    .map((item) => item.movement_id);

  return {
    ok: missingMovements.length === 0 && invalidMovements.length === 0,
    required_core_movement_ids: [...REQUIRED_CORE_MOVEMENT_IDS],
    missing_movements: missingMovements,
    invalid_movements: invalidMovements,
    details,
  };
}

export function verifyCoreMovementLaw(registryPath = DEFAULT_MOVEMENT_REGISTRY_PATH) {
  const movementRegistry = loadMovementRegistry(registryPath);
  const result = evaluateCoreMovementLaw(movementRegistry);

  if (result.missing_movements.length > 0) {
    fail(`Core movement law missing movement ids: ${result.missing_movements.join(", ")}`);
  }

  if (result.invalid_movements.length > 0) {
    fail(`Core movement law has incomplete vocab for: ${result.invalid_movements.join(", ")}`);
  }

  return result;
}

function main() {
  const registryPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_MOVEMENT_REGISTRY_PATH;

  try {
    const result = verifyCoreMovementLaw(registryPath);
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