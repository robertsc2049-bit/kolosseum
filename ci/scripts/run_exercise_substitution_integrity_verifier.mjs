import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_GRAPH_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "registries",
  "exercise",
  "exercise_substitution_graph.json",
);

const DEFAULT_EXERCISE_REGISTRY_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "registries",
  "exercise",
  "exercise.registry.json",
);

const EQUIPMENT_CLASS_RANK = Object.freeze({
  bodyweight: 1,
  dumbbell: 2,
  barbell: 3,
});

function fail(message) {
  const error = new Error(message);
  error.name = "ExerciseSubstitutionIntegrityError";
  throw error;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function loadGraph(graphPath = DEFAULT_GRAPH_PATH) {
  const parsed = readJson(graphPath);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("Substitution graph must parse to an object.");
  }

  if (!parsed.edges || typeof parsed.edges !== "object" || Array.isArray(parsed.edges)) {
    fail("Substitution graph must contain an object at edges.");
  }

  return parsed;
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

function getEquipmentClass(exercise) {
  const direct = normalizeString(exercise?.equipment_class);
  if (direct) {
    return direct;
  }

  const tags = Array.isArray(exercise?.equipment_tags)
    ? exercise.equipment_tags.map((value) => normalizeString(value)).filter(Boolean)
    : [];

  if (tags.includes("barbell")) {
    return "barbell";
  }

  if (tags.includes("dumbbell")) {
    return "dumbbell";
  }

  if (tags.includes("bodyweight")) {
    return "bodyweight";
  }

  const equipment = Array.isArray(exercise?.equipment)
    ? exercise.equipment.map((value) => normalizeString(value)).filter(Boolean)
    : [];

  if (equipment.includes("barbell")) {
    return "barbell";
  }

  if (equipment.includes("dumbbell")) {
    return "dumbbell";
  }

  if (equipment.includes("bodyweight")) {
    return "bodyweight";
  }

  return "";
}

function getRank(equipmentClass) {
  return EQUIPMENT_CLASS_RANK[equipmentClass] ?? 0;
}

function isAllowedEquipmentDowngrade(sourceClass, targetClass) {
  const sourceRank = getRank(sourceClass);
  const targetRank = getRank(targetClass);

  if (!sourceRank || !targetRank) {
    return false;
  }

  return sourceRank >= targetRank;
}

export function evaluateSubstitutionIntegrity(graph, exerciseRegistry) {
  const edges = graph?.edges;
  const entries = exerciseRegistry?.entries;

  if (!edges || typeof edges !== "object" || Array.isArray(edges)) {
    fail("Graph edges must be an object keyed by source exercise id.");
  }

  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    fail("Exercise registry entries must be an object keyed by exercise id.");
  }

  const problems = [];
  const validated_edges = [];
  const seenPairs = new Set();

  for (const [sourceId, targets] of Object.entries(edges)) {
    const sourceExercise = entries[sourceId];

    if (!sourceExercise) {
      problems.push({
        type: "missing_source",
        source_id: sourceId,
      });
      continue;
    }

    if (!Array.isArray(targets)) {
      problems.push({
        type: "invalid_target_list",
        source_id: sourceId,
      });
      continue;
    }

    for (const rawTargetId of targets) {
      if (typeof rawTargetId !== "string" || !rawTargetId.trim()) {
        problems.push({
          type: "invalid_target_id",
          source_id: sourceId,
          target_id: rawTargetId,
        });
        continue;
      }

      const targetId = rawTargetId.trim();
      const pairKey = `${sourceId}=>${targetId}`;

      if (seenPairs.has(pairKey)) {
        problems.push({
          type: "duplicate_edge",
          source_id: sourceId,
          target_id: targetId,
        });
        continue;
      }

      seenPairs.add(pairKey);

      const targetExercise = entries[targetId];

      if (!targetExercise) {
        problems.push({
          type: "missing_target",
          source_id: sourceId,
          target_id: targetId,
        });
        continue;
      }

      if (sourceId === targetId) {
        problems.push({
          type: "self_edge",
          source_id: sourceId,
          target_id: targetId,
        });
        continue;
      }

      const sourcePattern = getPattern(sourceExercise);
      const targetPattern = getPattern(targetExercise);

      if (!sourcePattern || !targetPattern) {
        problems.push({
          type: "missing_pattern",
          source_id: sourceId,
          target_id: targetId,
        });
        continue;
      }

      if (sourcePattern !== targetPattern) {
        problems.push({
          type: "movement_intent_mismatch",
          source_id: sourceId,
          target_id: targetId,
          source_pattern: sourcePattern,
          target_pattern: targetPattern,
        });
        continue;
      }

      const sourceEquipmentClass = getEquipmentClass(sourceExercise);
      const targetEquipmentClass = getEquipmentClass(targetExercise);

      if (!sourceEquipmentClass || !targetEquipmentClass) {
        problems.push({
          type: "missing_equipment_class",
          source_id: sourceId,
          target_id: targetId,
        });
        continue;
      }

      if (!isAllowedEquipmentDowngrade(sourceEquipmentClass, targetEquipmentClass)) {
        problems.push({
          type: "cross_equipment_direction_invalid",
          source_id: sourceId,
          target_id: targetId,
          source_equipment_class: sourceEquipmentClass,
          target_equipment_class: targetEquipmentClass,
        });
        continue;
      }

      validated_edges.push({
        source_id: sourceId,
        target_id: targetId,
        pattern: sourcePattern,
        source_equipment_class: sourceEquipmentClass,
        target_equipment_class: targetEquipmentClass,
      });
    }
  }

  return {
    ok: problems.length === 0,
    validated_edge_count: validated_edges.length,
    validated_edges,
    problems,
  };
}

export function verifySubstitutionIntegrity(
  graphPath = DEFAULT_GRAPH_PATH,
  registryPath = DEFAULT_EXERCISE_REGISTRY_PATH,
) {
  const graph = loadGraph(graphPath);
  const exerciseRegistry = loadExerciseRegistry(registryPath);
  const result = evaluateSubstitutionIntegrity(graph, exerciseRegistry);

  if (!result.ok) {
    const summary = result.problems
      .map((problem) => {
        switch (problem.type) {
          case "missing_source":
            return `missing_source:${problem.source_id}`;
          case "invalid_target_list":
            return `invalid_target_list:${problem.source_id}`;
          case "invalid_target_id":
            return `invalid_target_id:${problem.source_id}`;
          case "missing_target":
            return `missing_target:${problem.source_id}->${problem.target_id}`;
          case "self_edge":
            return `self_edge:${problem.source_id}`;
          case "missing_pattern":
            return `missing_pattern:${problem.source_id}->${problem.target_id}`;
          case "movement_intent_mismatch":
            return `movement_intent_mismatch:${problem.source_id}->${problem.target_id}`;
          case "missing_equipment_class":
            return `missing_equipment_class:${problem.source_id}->${problem.target_id}`;
          case "cross_equipment_direction_invalid":
            return `cross_equipment_direction_invalid:${problem.source_id}->${problem.target_id}`;
          case "duplicate_edge":
            return `duplicate_edge:${problem.source_id}->${problem.target_id}`;
          default:
            return `unknown_problem:${JSON.stringify(problem)}`;
        }
      })
      .join(" ; ");

    fail(`Substitution integrity invalid: ${summary}`);
  }

  return result;
}

function main() {
  const graphPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_GRAPH_PATH;

  const registryPath = process.argv[3]
    ? path.resolve(process.cwd(), process.argv[3])
    : DEFAULT_EXERCISE_REGISTRY_PATH;

  try {
    const result = verifySubstitutionIntegrity(graphPath, registryPath);
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