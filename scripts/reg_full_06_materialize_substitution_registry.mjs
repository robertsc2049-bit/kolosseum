import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const __filename = fileURLToPath(import.meta.url);

export const REG_FULL_06_PATHS = Object.freeze({
  exercise: "registries/exercise/exercise.registry.json",
  movement: "registries/movement/movement.registry.json",
  equipment: "registries/equipment/equipment.registry.json",
  equipmentCompatibility: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json",
  applicability: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json",
  substitution: "registries/substitution/substitution.registry.json",
  legacyGraph: "registries/exercise/exercise_substitution_graph.json",
  surfaceManifest: "registries/final_registry_surface_manifest.json",
  evidence: "ci/evidence/reg_full_06_substitution_graph_closure.v1.json"
});

export const ACTIVITY_ORDER = Object.freeze(["powerlifting", "general_strength", "rugby_union"]);
export const DIFFICULTY_RANK = Object.freeze({ beginner: 0, intermediate: 1, advanced: 2 });

// Authoring-time equipment burden only. These levels are explicit REG-FULL-06 policy;
// they are never inferred at runtime from names, classes, or missing data.
export const EQUIPMENT_LEVEL = Object.freeze({
  bodyweight: 0,
  open_floor_space: 0,
  resistance_band: 1,
  dumbbell: 1,
  kettlebell: 1,
  medicine_ball: 1,
  plate: 1,
  barbell: 2,
  rack: 2,
  bench: 2,
  cable_machine: 2,
  pull_up_bar: 2,
  trap_bar: 2,
  sled: 2,
  box: 2,
  machine_general: 2,
  cardio_machine_general: 2,
  yoke: 3,
  atlas_stone: 3,
  strongman_log: 3,
  axle_bar: 3,
  sandbag: 3,
  tire: 3
});

const CHANGE_PRIORITY = Object.freeze({
  same_required_equipment: 0,
  lateral: 1,
  downgrade: 2
});

const COPY_BOUNDARY = "factual explicit substitution edge only; caller must apply current activity context and available-equipment facts; no closest-exercise inference; no recommendation; no medical claim; no suitability claim; no performance guarantee";

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function writeJson(rel, value) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashFile(rel) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function entries(doc) {
  return doc?.entries && typeof doc.entries === "object" && !Array.isArray(doc.entries) ? doc.entries : {};
}

function requiredEquipmentByExercise(compatibility) {
  const out = new Map();
  for (const row of Object.values(entries(compatibility))) {
    if (row?.compatibility_type !== "required") continue;
    if (!out.has(row.exercise_id)) out.set(row.exercise_id, []);
    out.get(row.exercise_id).push(row.equipment_id);
  }
  for (const ids of out.values()) ids.sort();
  return out;
}

function trainingRowsByExercise(applicability) {
  const out = new Map();
  for (const row of Object.values(entries(applicability))) {
    if (row?.activity_context !== "training") continue;
    if (!out.has(row.exercise_id)) out.set(row.exercise_id, new Map());
    out.get(row.exercise_id).set(row.activity_id, row);
  }
  return out;
}

function equipmentLevelFor(requiredIds, equipmentEntries) {
  if (!Array.isArray(requiredIds) || requiredIds.length === 0) throw new Error("REG_FULL_06_REQUIRED_EQUIPMENT_MISSING");
  let level = 0;
  for (const equipmentId of requiredIds) {
    if (!equipmentEntries[equipmentId]) throw new Error(`REG_FULL_06_EQUIPMENT_FK:${equipmentId}`);
    if (!Object.prototype.hasOwnProperty.call(EQUIPMENT_LEVEL, equipmentId)) {
      throw new Error(`REG_FULL_06_EQUIPMENT_POLICY_MISSING:${equipmentId}`);
    }
    level = Math.max(level, EQUIPMENT_LEVEL[equipmentId]);
  }
  return level;
}

function classifyEquipmentChange(sourceRequired, targetRequired, equipmentEntries) {
  const sourceSorted = [...sourceRequired].sort();
  const targetSorted = [...targetRequired].sort();
  if (JSON.stringify(sourceSorted) === JSON.stringify(targetSorted)) return "same_required_equipment";
  const sourceLevel = equipmentLevelFor(sourceSorted, equipmentEntries);
  const targetLevel = equipmentLevelFor(targetSorted, equipmentEntries);
  if (targetLevel > sourceLevel) return null;
  return targetLevel === sourceLevel ? "lateral" : "downgrade";
}

function isSubset(values, allowed) {
  const set = new Set(allowed);
  return values.every((value) => set.has(value));
}

function sharedActivities(sourceId, targetId, trainingRows) {
  const source = trainingRows.get(sourceId) ?? new Map();
  const target = trainingRows.get(targetId) ?? new Map();
  const shared = [];
  for (const activityId of ACTIVITY_ORDER) {
    const sourceRow = source.get(activityId);
    const targetRow = target.get(activityId);
    if (sourceRow?.applicability_state !== "allowed") continue;
    if (targetRow?.applicability_state !== "allowed") continue;
    // Restricted sources are deliberately permitted only through explicit edge rows.
    // Targets must already be substitution-eligible in the explicit activity authority.
    if (targetRow?.substitution_applicability !== "eligible") continue;
    shared.push(activityId);
  }
  return shared;
}

export function buildSubstitutionEntries({ exercise, movement, equipment, equipmentCompatibility, applicability }) {
  const ex = entries(exercise);
  const mv = entries(movement);
  const eq = entries(equipment);
  const requiredEquipment = requiredEquipmentByExercise(equipmentCompatibility);
  const trainingRows = trainingRowsByExercise(applicability);
  const rows = [];

  for (const [exerciseId, record] of Object.entries(ex)) {
    if (record?.exercise_id !== exerciseId) throw new Error(`REG_FULL_06_EXERCISE_PRIMARY_KEY:${exerciseId}`);
    if (!mv[record?.movement_pattern_id]) throw new Error(`REG_FULL_06_MOVEMENT_FK:${exerciseId}`);
    if (!requiredEquipment.has(exerciseId)) throw new Error(`REG_FULL_06_REQUIRED_EQUIPMENT_MISSING:${exerciseId}`);
    if (!Object.prototype.hasOwnProperty.call(DIFFICULTY_RANK, record?.difficulty_tier)) {
      throw new Error(`REG_FULL_06_DIFFICULTY_POLICY_MISSING:${exerciseId}:${record?.difficulty_tier}`);
    }
  }

  const exerciseIds = Object.keys(ex).sort();
  for (const sourceId of exerciseIds) {
    const source = ex[sourceId];
    const sourceRequired = requiredEquipment.get(sourceId);
    const sourceDifficulty = DIFFICULTY_RANK[source.difficulty_tier];

    for (const targetId of exerciseIds) {
      if (targetId === sourceId) continue;
      const target = ex[targetId];
      if (target.substitution_eligibility !== "eligible") continue;
      if (target.movement_pattern_id !== source.movement_pattern_id) continue;
      if (target.stimulus_intent !== source.stimulus_intent) continue;

      const targetDifficulty = DIFFICULTY_RANK[target.difficulty_tier];
      if (targetDifficulty > sourceDifficulty) continue;
      if (!isSubset(target.joint_stress_tags ?? [], source.joint_stress_tags ?? [])) continue;

      const activities = sharedActivities(sourceId, targetId, trainingRows);
      if (activities.length === 0) continue;

      const targetRequired = requiredEquipment.get(targetId);
      if (!targetRequired) throw new Error(`REG_FULL_06_REQUIRED_EQUIPMENT_MISSING:${targetId}`);
      const equipmentChangeType = classifyEquipmentChange(sourceRequired, targetRequired, eq);
      if (!equipmentChangeType) continue;

      const difficultyDrop = sourceDifficulty - targetDifficulty;
      const priority = CHANGE_PRIORITY[equipmentChangeType];
      const orderingKey = `${sourceId}|${String(priority).padStart(2, "0")}|${String(difficultyDrop).padStart(2, "0")}|${targetId}`;
      const edgeId = `${sourceId}__to__${targetId}`;

      rows.push({
        substitution_edge_id: edgeId,
        source_exercise_id: sourceId,
        target_exercise_id: targetId,
        movement_pattern_preservation: "exact",
        stimulus_intent_preservation: "exact",
        equipment_change_type: equipmentChangeType,
        excluded_equipment_handling: "explicit_target_required_equipment_filter",
        joint_stress_handling: "target_subset_or_equal",
        activity_applicability: activities,
        difficulty_tier_compatibility: "same_or_lower",
        deterministic_ordering_key: orderingKey,
        copy_legal_boundary_notes: COPY_BOUNDARY
      });
    }
  }

  rows.sort((a, b) => a.deterministic_ordering_key.localeCompare(b.deterministic_ordering_key));
  const out = {};
  for (const row of rows) {
    if (out[row.substitution_edge_id]) throw new Error(`REG_FULL_06_DUPLICATE_EDGE:${row.substitution_edge_id}`);
    out[row.substitution_edge_id] = row;
  }
  return out;
}

export function buildRegistry(docs) {
  return {
    registry_id: "substitution_registry",
    version: "1.0.0",
    entries: buildSubstitutionEntries(docs)
  };
}

function validateArchitecture(surfaceManifest) {
  const substitution = (surfaceManifest?.entities ?? []).find((row) => row.entity_id === "substitution_registry");
  const legacy = (surfaceManifest?.entities ?? []).find((row) => row.entity_id === "exercise_substitution_graph");
  if (!substitution || substitution.classification !== "required_active" || substitution.final_state?.authoritative !== true || substitution.final_state?.final_runtime_load !== true || substitution.final_state?.new_content_allowed !== true || substitution.final_state?.final_load_position !== 24) {
    throw new Error("REG_FULL_06_SUBSTITUTION_ARCHITECTURE_DRIFT");
  }
  if (!legacy || legacy.classification !== "retained_legacy" || legacy.final_state?.authoritative !== false || legacy.final_state?.final_runtime_load !== false || legacy.final_state?.new_content_allowed !== false || legacy.successor_registry_id !== "substitution_registry" || legacy.target_slice !== "REG-FULL-06") {
    throw new Error("REG_FULL_06_LEGACY_ARCHITECTURE_DRIFT");
  }
}

function loadDocs() {
  return {
    exercise: readJson(REG_FULL_06_PATHS.exercise),
    movement: readJson(REG_FULL_06_PATHS.movement),
    equipment: readJson(REG_FULL_06_PATHS.equipment),
    equipmentCompatibility: readJson(REG_FULL_06_PATHS.equipmentCompatibility),
    applicability: readJson(REG_FULL_06_PATHS.applicability)
  };
}

function buildEvidence(registry) {
  const rows = Object.values(registry.entries);
  const sourceIds = new Set(rows.map((row) => row.source_exercise_id));
  const targetIds = new Set(rows.map((row) => row.target_exercise_id));
  const byType = { same_required_equipment: 0, lateral: 0, downgrade: 0 };
  for (const row of rows) byType[row.equipment_change_type]++;
  return {
    evidence_id: "reg_full_06_substitution_graph_closure",
    version: "1.0.0",
    slice_id: "REG-FULL-06",
    authority: {
      substitution_registry: REG_FULL_06_PATHS.substitution,
      exercise_registry: REG_FULL_06_PATHS.exercise,
      movement_registry: REG_FULL_06_PATHS.movement,
      equipment_registry: REG_FULL_06_PATHS.equipment,
      equipment_compatibility_registry: REG_FULL_06_PATHS.equipmentCompatibility,
      activity_applicability_registry: REG_FULL_06_PATHS.applicability,
      legacy_graph: REG_FULL_06_PATHS.legacyGraph
    },
    policy: {
      exact_movement_pattern_required: true,
      exact_stimulus_intent_required: true,
      target_substitution_eligibility_required: "eligible",
      source_restricted_allowed_only_by_explicit_edge: true,
      target_joint_stress_tags_must_be_subset_or_equal: true,
      target_difficulty_must_be_same_or_lower: true,
      equipment_direction: ["same_required_equipment", "lateral", "downgrade"],
      equipment_upgrade_forbidden: true,
      runtime_inference_forbidden: true,
      closest_exercise_algorithm_forbidden: true,
      generic_fallback_forbidden: true,
      deterministic_ordering_required: true
    },
    counts: {
      exercise_count: Object.keys(entries(readJson(REG_FULL_06_PATHS.exercise))).length,
      edge_count: rows.length,
      source_exercise_count: sourceIds.size,
      target_exercise_count: targetIds.size,
      equipment_change_type_counts: byType
    },
    hashes: {
      exercise_registry_sha256: hashFile(REG_FULL_06_PATHS.exercise),
      movement_registry_sha256: hashFile(REG_FULL_06_PATHS.movement),
      equipment_registry_sha256: hashFile(REG_FULL_06_PATHS.equipment),
      equipment_compatibility_registry_sha256: hashFile(REG_FULL_06_PATHS.equipmentCompatibility),
      activity_applicability_registry_sha256: hashFile(REG_FULL_06_PATHS.applicability),
      substitution_registry_sha256: hashFile(REG_FULL_06_PATHS.substitution),
      legacy_graph_sha256: hashFile(REG_FULL_06_PATHS.legacyGraph)
    }
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (!args.has("--write") && !args.has("--write-evidence")) {
    throw new Error("Usage: node scripts/reg_full_06_materialize_substitution_registry.mjs --write [--write-evidence]");
  }

  validateArchitecture(readJson(REG_FULL_06_PATHS.surfaceManifest));
  const docs = loadDocs();

  if (args.has("--write")) {
    const registry = buildRegistry(docs);
    if (Object.keys(registry.entries).length === 0) throw new Error("REG_FULL_06_EMPTY_SUBSTITUTION_REGISTRY");
    writeJson(REG_FULL_06_PATHS.substitution, registry);
    process.stdout.write(`REG-FULL-06 wrote ${REG_FULL_06_PATHS.substitution} edges=${Object.keys(registry.entries).length}\n`);
  }

  if (args.has("--write-evidence")) {
    if (!fs.existsSync(path.join(ROOT, REG_FULL_06_PATHS.substitution))) throw new Error("REG_FULL_06_SUBSTITUTION_REGISTRY_MISSING");
    const registry = readJson(REG_FULL_06_PATHS.substitution);
    const expected = buildRegistry(docs);
    if (JSON.stringify(registry) !== JSON.stringify(expected)) throw new Error("REG_FULL_06_MATERIALIZED_REGISTRY_DRIFT");
    writeJson(REG_FULL_06_PATHS.evidence, buildEvidence(registry));
    process.stdout.write(`REG-FULL-06 wrote ${REG_FULL_06_PATHS.evidence}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
  }
}
