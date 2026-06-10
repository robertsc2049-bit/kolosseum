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

const ALLOWED_JOINT_STRESS = new Set(["low", "medium", "high"]);

function fail(message) {
  const error = new Error(message);
  error.name = "ExerciseJointStressCoverageError";
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

function deriveJointStressFromTags(exercise) {
  const tags = Array.isArray(exercise?.joint_stress_tags)
    ? exercise.joint_stress_tags.map((value) => normalizeString(value)).filter(Boolean)
    : [];

  if (tags.length === 0) {
    return "";
  }

  const severities = new Set();

  for (const tag of tags) {
    const parts = tag.split("_");
    const severity = parts[parts.length - 1];

    if (!ALLOWED_JOINT_STRESS.has(severity)) {
      return "__invalid__";
    }

    severities.add(severity);
  }

  if (severities.has("high")) {
    return "high";
  }

  if (severities.has("medium")) {
    return "medium";
  }

  return "low";
}

export function evaluateJointStressCoverage(exerciseRegistry) {
  const entries = exerciseRegistry?.entries;

  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    fail("Exercise registry entries must be an object keyed by exercise id.");
  }

  const problems = [];
  const laneSummary = new Map();

  for (const [exerciseId, exercise] of Object.entries(entries)) {
    const pattern = getPattern(exercise);
    const jointStress = deriveJointStressFromTags(exercise);

    if (!pattern) {
      problems.push({
        type: "missing_pattern",
        exercise_id: exerciseId,
      });
      continue;
    }

    if (!jointStress) {
      problems.push({
        type: "missing_joint_stress_tags",
        exercise_id: exerciseId,
        pattern,
      });
      continue;
    }

    if (jointStress === "__invalid__") {
      problems.push({
        type: "invalid_joint_stress_tags",
        exercise_id: exerciseId,
        pattern,
        joint_stress_tags: exercise?.joint_stress_tags ?? [],
      });
      continue;
    }

    if (!laneSummary.has(pattern)) {
      laneSummary.set(pattern, {
        pattern,
        exercise_ids: [],
        low_stress_exercise_ids: [],
      });
    }

    const lane = laneSummary.get(pattern);
    lane.exercise_ids.push(exerciseId);

    if (jointStress === "low") {
      lane.low_stress_exercise_ids.push(exerciseId);
    }
  }

  for (const lane of laneSummary.values()) {
    if (lane.low_stress_exercise_ids.length === 0) {
      problems.push({
        type: "missing_low_joint_stress_option",
        pattern: lane.pattern,
        exercise_ids: lane.exercise_ids.slice().sort(),
      });
    }
  }

  const validated_lanes = Array.from(laneSummary.values())
    .map((lane) => ({
      pattern: lane.pattern,
      exercise_count: lane.exercise_ids.length,
      low_stress_exercise_count: lane.low_stress_exercise_ids.length,
      low_stress_exercise_ids: lane.low_stress_exercise_ids.slice().sort(),
    }))
    .sort((a, b) => a.pattern.localeCompare(b.pattern));

  return {
    ok: problems.length === 0,
    validated_lane_count: validated_lanes.length,
    validated_lanes,
    problems,
  };
}

export function verifyJointStressCoverage(
  registryPath = DEFAULT_EXERCISE_REGISTRY_PATH,
) {
  const exerciseRegistry = loadExerciseRegistry(registryPath);
  const result = evaluateJointStressCoverage(exerciseRegistry);

  if (!result.ok) {
    const summary = result.problems
      .map((problem) => {
        switch (problem.type) {
          case "missing_pattern":
            return `missing_pattern:${problem.exercise_id}`;
          case "missing_joint_stress_tags":
            return `missing_joint_stress_tags:${problem.exercise_id}`;
          case "invalid_joint_stress_tags":
            return `invalid_joint_stress_tags:${problem.exercise_id}`;
          case "missing_low_joint_stress_option":
            return `missing_low_joint_stress_option:${problem.pattern}`;
          default:
            return `unknown_problem:${JSON.stringify(problem)}`;
        }
      })
      .join(" ; ");

    fail(`Joint-stress coverage invalid: ${summary}`);
  }

  return result;
}

function main() {
  const registryPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_EXERCISE_REGISTRY_PATH;

  try {
    const result = verifyJointStressCoverage(registryPath);
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