import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REGISTRY_PATH = path.resolve(__dirname, "..", "..", "registries", "exercise", "exercise.registry.json");

export const REQUIRED_ACCESSIBLE_PATTERNS = [
  "squat",
  "hinge",
  "horizontal_push",
  "vertical_push",
];

const MACHINE_EQUIPMENT_KEYS = new Set([
  "machine",
  "selectorized_machine",
  "plate_loaded_machine",
  "cable",
  "cables",
  "pulley",
  "smith_machine",
]);

function fail(message) {
  const error = new Error(message);
  error.name = "AccessibilityCoverageError";
  throw error;
}

export function loadExerciseRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  const raw = fs.readFileSync(registryPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    fail("Exercise registry must parse to an object.");
  }

  if (!parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
    fail("Exercise registry must contain an object at entries.");
  }

  return parsed;
}

function collectStrings(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized ? [normalized] : [];
  }

  return [];
}

export function isAccessibleExercise(exercise) {
  const difficultyTier = typeof exercise?.difficulty_tier === "string"
    ? exercise.difficulty_tier.trim().toLowerCase()
    : "";

  const stability = typeof exercise?.stability === "string"
    ? exercise.stability.trim().toLowerCase()
    : "";

  const equipmentTokens = new Set([
    ...collectStrings(exercise?.equipment),
    ...collectStrings(exercise?.equipment_tags),
  ]);

  const hasMachineLikeEquipment = [...equipmentTokens].some((token) => MACHINE_EQUIPMENT_KEYS.has(token));
  const hasLowSkillDifficulty = difficultyTier === "beginner";
  const hasAccessibleStability = stability === "stable" || stability === "semi_stable";

  return hasMachineLikeEquipment && hasLowSkillDifficulty && hasAccessibleStability;
}

export function evaluateAccessibilityCoverage(registry) {
  const entriesObject = registry?.entries;
  if (!entriesObject || typeof entriesObject !== "object" || Array.isArray(entriesObject)) {
    fail("Registry entries must be an object keyed by exercise id.");
  }

  const entries = Object.values(entriesObject);
  const accessibleByPattern = new Map();

  for (const pattern of REQUIRED_ACCESSIBLE_PATTERNS) {
    accessibleByPattern.set(pattern, []);
  }

  for (const exercise of entries) {
    if (!exercise || typeof exercise !== "object") continue;

    const pattern = typeof exercise.pattern === "string"
      ? exercise.pattern.trim().toLowerCase()
      : "";

    if (!accessibleByPattern.has(pattern)) continue;
    if (!isAccessibleExercise(exercise)) continue;

    const exerciseId = typeof exercise.exercise_id === "string"
      ? exercise.exercise_id
      : "(unknown_exercise_id)";

    accessibleByPattern.get(pattern).push(exerciseId);
  }

  const missingPatterns = REQUIRED_ACCESSIBLE_PATTERNS.filter(
    (pattern) => (accessibleByPattern.get(pattern) ?? []).length === 0,
  );

  return {
    ok: missingPatterns.length === 0,
    required_patterns: [...REQUIRED_ACCESSIBLE_PATTERNS],
    missing_patterns: missingPatterns,
    accessible_by_pattern: Object.fromEntries(
      [...accessibleByPattern.entries()].map(([pattern, ids]) => [pattern, ids]),
    ),
  };
}

export function verifyAccessibilityCoverage(registryPath = DEFAULT_REGISTRY_PATH) {
  const registry = loadExerciseRegistry(registryPath);
  const result = evaluateAccessibilityCoverage(registry);

  if (!result.ok) {
    const details = result.missing_patterns.join(", ");
    fail(`Machine / accessible coverage missing for pattern(s): ${details}`);
  }

  return result;
}

function main() {
  const registryPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_REGISTRY_PATH;

  try {
    const result = verifyAccessibilityCoverage(registryPath);
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