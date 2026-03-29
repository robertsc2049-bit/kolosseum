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

function fail(message) {
  const error = new Error(message);
  error.name = "CarryMovementLawError";
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

export function evaluateCarryMovementLaw(movementRegistry) {
  const movementEntries = movementRegistry?.entries;
  if (!movementEntries || typeof movementEntries !== "object" || Array.isArray(movementEntries)) {
    fail("Movement registry entries must be an object.");
  }

  const carry = movementEntries.carry ?? null;
  const carryPresent = !!carry;

  const equipmentVocab = Array.isArray(carry?.equipment_vocab)
    ? carry.equipment_vocab
        .filter((token) => typeof token === "string" && token.trim())
        .map((token) => token.trim().toLowerCase())
        .sort()
    : [];

  const jointStressVocab = Array.isArray(carry?.joint_stress_tags_vocab)
    ? carry.joint_stress_tags_vocab
        .filter((token) => typeof token === "string" && token.trim())
        .map((token) => token.trim().toLowerCase())
        .sort()
    : [];

  const requiredEquipmentTokens = ["dumbbell", "kettlebell", "trap_bar", "sandbag", "yoke", "plate"];
  const missingEquipmentTokens = requiredEquipmentTokens.filter((token) => !equipmentVocab.includes(token));

  const requiredJointStressTokens = ["neutral", "shoulder", "grip", "lumbar_low", "thoracic_low", "hip"];
  const missingJointStressTokens = requiredJointStressTokens.filter((token) => !jointStressVocab.includes(token));

  const ok =
    carryPresent &&
    missingEquipmentTokens.length === 0 &&
    missingJointStressTokens.length === 0;

  return {
    ok,
    carry_present: carryPresent,
    required_equipment_tokens: requiredEquipmentTokens,
    required_joint_stress_tokens: requiredJointStressTokens,
    carry_equipment_vocab: equipmentVocab,
    carry_joint_stress_vocab: jointStressVocab,
    missing_equipment_tokens: missingEquipmentTokens,
    missing_joint_stress_tokens: missingJointStressTokens,
  };
}

export function verifyCarryMovementLaw(registryPath = DEFAULT_MOVEMENT_REGISTRY_PATH) {
  const movementRegistry = loadMovementRegistry(registryPath);
  const result = evaluateCarryMovementLaw(movementRegistry);

  if (!result.carry_present) {
    fail("Carry movement is missing from movement registry.");
  }

  if (result.missing_equipment_tokens.length > 0) {
    fail(`Carry movement is missing required equipment vocab: ${result.missing_equipment_tokens.join(", ")}`);
  }

  if (result.missing_joint_stress_tokens.length > 0) {
    fail(`Carry movement is missing required joint stress vocab: ${result.missing_joint_stress_tokens.join(", ")}`);
  }

  return result;
}

function main() {
  const registryPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_MOVEMENT_REGISTRY_PATH;

  try {
    const result = verifyCarryMovementLaw(registryPath);
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