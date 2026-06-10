import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_EXERCISE_REGISTRY_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "registries",
  "exercise",
  "exercise.registry.json",
);

const REQUIRED_PATTERNS = Object.freeze([
  "squat",
  "horizontal_push",
  "hinge",
]);

function fail(message) {
  const error = new Error(message);
  error.name = "ExercisePartialRomCoverageError";
  throw error;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function loadExerciseRegistry(registryPath = DEFAULT_EXERCISE_REGISTRY_PATH) {
  const parsed = readJson(registryPath);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("Exercise registry must parse to an object.");
  }

  if (!parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
    fail("Exercise registry must contain an object at entries.");
  }

  return parsed;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getPattern(exercise) {
  return normalizeString(exercise?.pattern);
}

function getRom(exercise) {
  return normalizeString(exercise?.rom);
}

function isPartialRomExercise(exercise) {
  const rom = getRom(exercise);
  return rom === "partial";
}

export function evaluatePartialRomCoverage(exerciseRegistry) {
  const entries = exerciseRegistry?.entries;

  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    fail("Exercise registry entries must be an object keyed by exercise id.");
  }

  const problems = [];
  const coverage = new Map();

  for (const requiredPattern of REQUIRED_PATTERNS) {
    coverage.set(requiredPattern, {
      pattern: requiredPattern,
      exercise_ids: [],
      partial_rom_exercise_ids: [],
    });
  }

  for (const [exerciseId, exercise] of Object.entries(entries)) {
    const pattern = getPattern(exercise);

    if (!pattern) {
      problems.push({
        type: "missing_pattern",
        exercise_id: exerciseId,
      });
      continue;
    }

    if (!coverage.has(pattern)) {
      continue;
    }

    const lane = coverage.get(pattern);
    lane.exercise_ids.push(exerciseId);

    if (isPartialRomExercise(exercise)) {
      lane.partial_rom_exercise_ids.push(exerciseId);
    }
  }

  for (const requiredPattern of REQUIRED_PATTERNS) {
    const lane = coverage.get(requiredPattern);

    if (lane.exercise_ids.length === 0) {
      problems.push({
        type: "missing_required_pattern",
        pattern: requiredPattern,
      });
      continue;
    }

    if (lane.partial_rom_exercise_ids.length === 0) {
      problems.push({
        type: "missing_partial_rom_variant",
        pattern: requiredPattern,
        exercise_ids: lane.exercise_ids.slice().sort(),
      });
    }
  }

  const validated_patterns = Array.from(coverage.values()).map((lane) => ({
    pattern: lane.pattern,
    exercise_count: lane.exercise_ids.length,
    partial_rom_exercise_count: lane.partial_rom_exercise_ids.length,
    partial_rom_exercise_ids: lane.partial_rom_exercise_ids.slice().sort(),
  }));

  return {
    ok: problems.length === 0,
    validated_pattern_count: validated_patterns.length,
    validated_patterns,
    problems,
  };
}

export function verifyPartialRomCoverage(
  registryPath = DEFAULT_EXERCISE_REGISTRY_PATH,
) {
  const exerciseRegistry = loadExerciseRegistry(registryPath);
  const result = evaluatePartialRomCoverage(exerciseRegistry);

  if (!result.ok) {
    const summary = result.problems
      .map((problem) => {
        switch (problem.type) {
          case "missing_pattern":
            return `missing_pattern:${problem.exercise_id}`;
          case "missing_required_pattern":
            return `missing_required_pattern:${problem.pattern}`;
          case "missing_partial_rom_variant":
            return `missing_partial_rom_variant:${problem.pattern}`;
          default:
            return `unknown_problem:${JSON.stringify(problem)}`;
        }
      })
      .join(" ; ");

    fail(`Partial ROM coverage invalid: ${summary}`);
  }

  return result;
}

function main() {
  const registryPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_EXERCISE_REGISTRY_PATH;

  try {
    const result = verifyPartialRomCoverage(registryPath);
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