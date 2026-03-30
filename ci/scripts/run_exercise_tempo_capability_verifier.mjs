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

const ALLOWED_TEMPO_CAPABILITY = new Set([
  "none",
  "paused",
  "tempo",
  "paused_and_tempo",
]);

const REQUIRED_PATTERNS = Object.freeze([
  "squat",
  "horizontal_push",
  "hinge",
]);

function fail(message) {
  const error = new Error(message);
  error.name = "ExerciseTempoCapabilityError";
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

function getTempoCapability(exercise) {
  return normalizeString(exercise?.tempo_capability);
}

function isTempoCapable(capability) {
  return capability === "paused" || capability === "tempo" || capability === "paused_and_tempo";
}

export function evaluateTempoCapability(exerciseRegistry) {
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
      tempo_capable_exercise_ids: [],
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

    if (coverage.has(pattern)) {
      const lane = coverage.get(pattern);
      lane.exercise_ids.push(exerciseId);
    }

    const tempoCapability = getTempoCapability(exercise);

    if (!tempoCapability) {
      problems.push({
        type: "missing_tempo_capability",
        exercise_id: exerciseId,
        pattern,
      });
      continue;
    }

    if (!ALLOWED_TEMPO_CAPABILITY.has(tempoCapability)) {
      problems.push({
        type: "invalid_tempo_capability",
        exercise_id: exerciseId,
        pattern,
        tempo_capability: tempoCapability,
      });
      continue;
    }

    if (coverage.has(pattern) && isTempoCapable(tempoCapability)) {
      const lane = coverage.get(pattern);
      lane.tempo_capable_exercise_ids.push(exerciseId);
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

    if (lane.tempo_capable_exercise_ids.length === 0) {
      problems.push({
        type: "missing_tempo_capable_variant",
        pattern: requiredPattern,
        exercise_ids: lane.exercise_ids.slice().sort(),
      });
    }
  }

  const validated_patterns = Array.from(coverage.values()).map((lane) => ({
    pattern: lane.pattern,
    exercise_count: lane.exercise_ids.length,
    tempo_capable_exercise_count: lane.tempo_capable_exercise_ids.length,
    tempo_capable_exercise_ids: lane.tempo_capable_exercise_ids.slice().sort(),
  }));

  return {
    ok: problems.length === 0,
    validated_pattern_count: validated_patterns.length,
    validated_patterns,
    problems,
  };
}

export function verifyTempoCapability(
  registryPath = DEFAULT_EXERCISE_REGISTRY_PATH,
) {
  const exerciseRegistry = loadExerciseRegistry(registryPath);
  const result = evaluateTempoCapability(exerciseRegistry);

  if (!result.ok) {
    const summary = result.problems
      .map((problem) => {
        switch (problem.type) {
          case "missing_pattern":
            return `missing_pattern:${problem.exercise_id}`;
          case "missing_tempo_capability":
            return `missing_tempo_capability:${problem.exercise_id}`;
          case "invalid_tempo_capability":
            return `invalid_tempo_capability:${problem.exercise_id}`;
          case "missing_required_pattern":
            return `missing_required_pattern:${problem.pattern}`;
          case "missing_tempo_capable_variant":
            return `missing_tempo_capable_variant:${problem.pattern}`;
          default:
            return `unknown_problem:${JSON.stringify(problem)}`;
        }
      })
      .join(" ; ");

    fail(`Tempo capability invalid: ${summary}`);
  }

  return result;
}

function main() {
  const registryPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_EXERCISE_REGISTRY_PATH;

  try {
    const result = verifyTempoCapability(registryPath);
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