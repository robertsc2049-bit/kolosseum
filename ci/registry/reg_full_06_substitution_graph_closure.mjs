import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const REG_FULL_06_FAILURE_TOKEN = "CI_REG_FULL_06_SUBSTITUTION_GRAPH_CLOSURE";
export const REG_FULL_06_ACTIVITIES = Object.freeze(["powerlifting", "general_strength", "rugby_union", "strongman"]);
export const REG_FULL_06_PATHS = Object.freeze({
  activity: "registries/activity/activity.registry.json",
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

export const REG_FULL_06_DIFFICULTY_RANK = Object.freeze({ beginner: 0, intermediate: 1, advanced: 2 });
export const REG_FULL_06_EQUIPMENT_LEVEL = Object.freeze({
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

const CHANGE_PRIORITY = Object.freeze({ same_required_equipment: 0, lateral: 1, downgrade: 2 });
const REQUIRED_COPY_TOKENS = Object.freeze(["factual explicit substitution edge", "no closest-exercise inference", "no recommendation", "no medical claim", "no suitability claim", "no performance guarantee"]);
const FALLBACK_MARKERS = Object.freeze(["fallback", "default", "generic", "catch_all", "unknown", "unspecified", "closest"]);
const EXPECTED_LEGACY_GRAPH = Object.freeze({
  graph_id: "exercise_substitution_graph",
  version: "1.0.0",
  edges: {
    back_squat: ["goblet_squat"],
    bench_press: ["dumbbell_bench_press"],
    overhead_press: ["dumbbell_overhead_press"]
  }
});

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function entries(doc) { return isObject(doc?.entries) ? doc.entries : {}; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function push(errors, code, detail) { errors.push({ code, detail }); }
function stableArray(value) { return Array.isArray(value) ? value : []; }
function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function subset(values, allowed) { const set = new Set(allowed); return values.every((value) => set.has(value)); }
function sha256File(abs) { return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex"); }

function requiredEquipmentByExercise(compatibility, errors) {
  const out = new Map();
  for (const [key, row] of Object.entries(entries(compatibility))) {
    if (!isObject(row)) { push(errors, "EQUIPMENT_COMPATIBILITY_ROW", key); continue; }
    if (row.compatibility_type !== "required") continue;
    if (!out.has(row.exercise_id)) out.set(row.exercise_id, []);
    const list = out.get(row.exercise_id);
    if (list.includes(row.equipment_id)) push(errors, "DUPLICATE_REQUIRED_EQUIPMENT", { exercise_id: row.exercise_id, equipment_id: row.equipment_id });
    else list.push(row.equipment_id);
  }
  for (const list of out.values()) list.sort();
  return out;
}

function trainingRowsByExercise(applicability, errors) {
  const out = new Map();
  for (const [key, row] of Object.entries(entries(applicability))) {
    if (!isObject(row) || row.activity_context !== "training") continue;
    if (!out.has(row.exercise_id)) out.set(row.exercise_id, new Map());
    const map = out.get(row.exercise_id);
    if (map.has(row.activity_id)) push(errors, "DUPLICATE_TRAINING_APPLICABILITY", { exercise_id: row.exercise_id, activity_id: row.activity_id, key });
    else map.set(row.activity_id, row);
  }
  return out;
}

function equipmentLevel(requiredIds, equipmentEntries, errors, exerciseId) {
  if (!Array.isArray(requiredIds) || requiredIds.length === 0) {
    push(errors, "REQUIRED_EQUIPMENT_MISSING", exerciseId);
    return null;
  }
  let level = 0;
  for (const equipmentId of requiredIds) {
    if (!equipmentEntries[equipmentId]) push(errors, "EQUIPMENT_FK", { exercise_id: exerciseId, equipment_id: equipmentId });
    if (!Object.prototype.hasOwnProperty.call(REG_FULL_06_EQUIPMENT_LEVEL, equipmentId)) {
      push(errors, "EQUIPMENT_DIRECTION_POLICY_MISSING", { exercise_id: exerciseId, equipment_id: equipmentId });
      return null;
    }
    level = Math.max(level, REG_FULL_06_EQUIPMENT_LEVEL[equipmentId]);
  }
  return level;
}

function classifyEquipmentChange(sourceRequired, targetRequired, equipmentEntries, errors, sourceId, targetId) {
  const sourceSorted = [...sourceRequired].sort();
  const targetSorted = [...targetRequired].sort();
  if (sameJson(sourceSorted, targetSorted)) return "same_required_equipment";
  const sourceLevel = equipmentLevel(sourceSorted, equipmentEntries, errors, sourceId);
  const targetLevel = equipmentLevel(targetSorted, equipmentEntries, errors, targetId);
  if (sourceLevel === null || targetLevel === null) return null;
  if (targetLevel > sourceLevel) return "upgrade";
  return targetLevel === sourceLevel ? "lateral" : "downgrade";
}

function sharedActivities(sourceId, targetId, trainingRows) {
  const source = trainingRows.get(sourceId) ?? new Map();
  const target = trainingRows.get(targetId) ?? new Map();
  const out = [];
  for (const activityId of REG_FULL_06_ACTIVITIES) {
    const sourceRow = source.get(activityId);
    const targetRow = target.get(activityId);
    if (sourceRow?.applicability_state !== "allowed") continue;
    if (targetRow?.applicability_state !== "allowed") continue;
    if (targetRow?.substitution_applicability !== "eligible") continue;
    out.push(activityId);
  }
  return out;
}

function expectedCandidateRows(docs, errors) {
  const ex = entries(docs.exercise);
  const eq = entries(docs.equipment);
  const requiredEquipment = requiredEquipmentByExercise(docs.equipmentCompatibility, errors);
  const trainingRows = trainingRowsByExercise(docs.applicability, errors);
  const rows = [];
  const exerciseIds = Object.keys(ex).sort();

  for (const sourceId of exerciseIds) {
    const source = ex[sourceId];
    if (!requiredEquipment.has(sourceId)) { push(errors, "REQUIRED_EQUIPMENT_MISSING", sourceId); continue; }
    const sourceDifficulty = REG_FULL_06_DIFFICULTY_RANK[source?.difficulty_tier];
    if (!Number.isInteger(sourceDifficulty)) { push(errors, "DIFFICULTY_POLICY", { exercise_id: sourceId, difficulty_tier: source?.difficulty_tier }); continue; }

    for (const targetId of exerciseIds) {
      if (targetId === sourceId) continue;
      const target = ex[targetId];
      if (target?.substitution_eligibility !== "eligible") continue;
      if (target?.movement_pattern_id !== source?.movement_pattern_id) continue;
      if (target?.stimulus_intent !== source?.stimulus_intent) continue;
      const targetDifficulty = REG_FULL_06_DIFFICULTY_RANK[target?.difficulty_tier];
      if (!Number.isInteger(targetDifficulty) || targetDifficulty > sourceDifficulty) continue;
      if (!subset(stableArray(target?.joint_stress_tags), stableArray(source?.joint_stress_tags))) continue;
      const activities = sharedActivities(sourceId, targetId, trainingRows);
      if (activities.length === 0) continue;
      const targetRequired = requiredEquipment.get(targetId);
      if (!targetRequired) continue;
      const change = classifyEquipmentChange(requiredEquipment.get(sourceId), targetRequired, eq, errors, sourceId, targetId);
      if (!change || change === "upgrade") continue;
      const priority = CHANGE_PRIORITY[change];
      const difficultyDrop = sourceDifficulty - targetDifficulty;
      rows.push({
        substitution_edge_id: `${sourceId}__to__${targetId}`,
        source_exercise_id: sourceId,
        target_exercise_id: targetId,
        movement_pattern_preservation: "exact",
        stimulus_intent_preservation: "exact",
        equipment_change_type: change,
        excluded_equipment_handling: "explicit_target_required_equipment_filter",
        joint_stress_handling: "target_subset_or_equal",
        activity_applicability: activities,
        difficulty_tier_compatibility: "same_or_lower",
        deterministic_ordering_key: `${sourceId}|${String(priority).padStart(2, "0")}|${String(difficultyDrop).padStart(2, "0")}|${targetId}`
      });
    }
  }
  rows.sort((a, b) => a.deterministic_ordering_key.localeCompare(b.deterministic_ordering_key));
  return rows;
}

function auditArchitecture(surfaceManifest, legacyGraph, errors) {
  const substitution = stableArray(surfaceManifest?.entities).find((row) => row.entity_id === "substitution_registry");
  const legacy = stableArray(surfaceManifest?.entities).find((row) => row.entity_id === "exercise_substitution_graph");
  if (!substitution || substitution.classification !== "required_active" || substitution.final_state?.authoritative !== true || substitution.final_state?.final_runtime_load !== true || substitution.final_state?.new_content_allowed !== true || substitution.final_state?.final_load_position !== 24) {
    push(errors, "SUBSTITUTION_ARCHITECTURE", substitution ?? null);
  }
  const expectedDependencies = ["exercise_registry_3a", "exercise_equipment_compatibility_registry", "exercise_sport_applicability_registry_6x"];
  if (substitution && !sameJson(stableArray(substitution.dependency_ids), expectedDependencies)) push(errors, "SUBSTITUTION_DEPENDENCIES", substitution.dependency_ids);
  if (!legacy || legacy.classification !== "retained_legacy" || legacy.final_state?.authoritative !== false || legacy.final_state?.final_runtime_load !== false || legacy.final_state?.new_content_allowed !== false || legacy.successor_registry_id !== "substitution_registry" || legacy.migration_action !== "migrate/retire" || legacy.target_slice !== "REG-FULL-06") {
    push(errors, "LEGACY_ARCHITECTURE", legacy ?? null);
  }
  if (!sameJson(legacyGraph, EXPECTED_LEGACY_GRAPH)) push(errors, "LEGACY_GRAPH_MUTATED", legacyGraph);
}

export function auditRegFull06Documents(docs) {
  const errors = [];
  const ex = entries(docs.exercise);
  const mv = entries(docs.movement);
  const eq = entries(docs.equipment);
  const sub = entries(docs.substitution);
  const activities = Object.keys(entries(docs.activity)).sort();
  const expectedActivities = [...REG_FULL_06_ACTIVITIES].sort();

  if (!sameJson(activities, expectedActivities)) push(errors, "ACTIVITY_SCOPE", activities);
  if (Object.keys(ex).length !== 221) push(errors, "EXERCISE_COUNT", Object.keys(ex).length);
  if (Object.keys(mv).length !== 54) push(errors, "MOVEMENT_COUNT", Object.keys(mv).length);
  if (docs.substitution?.registry_id !== "substitution_registry" || docs.substitution?.version !== "1.0.0") push(errors, "SUBSTITUTION_HEADER", { registry_id: docs.substitution?.registry_id, version: docs.substitution?.version });
  if (Object.keys(sub).length === 0) push(errors, "EMPTY_SUBSTITUTION_REGISTRY", null);
  auditArchitecture(docs.surfaceManifest, docs.legacyGraph, errors);

  const requiredEquipment = requiredEquipmentByExercise(docs.equipmentCompatibility, errors);
  const trainingRows = trainingRowsByExercise(docs.applicability, errors);
  for (const exerciseId of Object.keys(ex)) {
    if (!mv[ex[exerciseId]?.movement_pattern_id]) push(errors, "EXERCISE_MOVEMENT_FK", { exercise_id: exerciseId, movement_pattern_id: ex[exerciseId]?.movement_pattern_id });
    if (!requiredEquipment.has(exerciseId)) push(errors, "REQUIRED_EQUIPMENT_MISSING", exerciseId);
    if (!Number.isInteger(REG_FULL_06_DIFFICULTY_RANK[ex[exerciseId]?.difficulty_tier])) push(errors, "DIFFICULTY_POLICY", { exercise_id: exerciseId, difficulty_tier: ex[exerciseId]?.difficulty_tier });
  }

  const seenPairs = new Set();
  const actualRows = Object.values(sub);
  let previousOrderingKey = null;
  for (const [key, row] of Object.entries(sub)) {
    if (!isObject(row)) { push(errors, "EDGE_ROW", key); continue; }
    const source = ex[row.source_exercise_id];
    const target = ex[row.target_exercise_id];
    const expectedId = `${row.source_exercise_id}__to__${row.target_exercise_id}`;
    if (row.substitution_edge_id !== key || key !== expectedId) push(errors, "EDGE_PRIMARY_KEY", { key, expected: expectedId, actual: row.substitution_edge_id });
    if (seenPairs.has(expectedId)) push(errors, "DUPLICATE_EDGE", expectedId); else seenPairs.add(expectedId);
    if (!source) push(errors, "SOURCE_FK", { key, source_exercise_id: row.source_exercise_id });
    if (!target) push(errors, "TARGET_FK", { key, target_exercise_id: row.target_exercise_id });
    if (row.source_exercise_id === row.target_exercise_id) push(errors, "SELF_EDGE", key);
    if (!source || !target) continue;
    if (source.movement_pattern_id !== target.movement_pattern_id || row.movement_pattern_preservation !== "exact") push(errors, "MOVEMENT_CLOSURE", key);
    if (source.stimulus_intent !== target.stimulus_intent || row.stimulus_intent_preservation !== "exact") push(errors, "STIMULUS_CLOSURE", key);
    if (target.substitution_eligibility !== "eligible") push(errors, "TARGET_SUBSTITUTION_ELIGIBILITY", key);
    const sourceDifficulty = REG_FULL_06_DIFFICULTY_RANK[source.difficulty_tier];
    const targetDifficulty = REG_FULL_06_DIFFICULTY_RANK[target.difficulty_tier];
    if (!Number.isInteger(sourceDifficulty) || !Number.isInteger(targetDifficulty) || targetDifficulty > sourceDifficulty || row.difficulty_tier_compatibility !== "same_or_lower") push(errors, "DIFFICULTY_CLOSURE", key);
    if (!subset(stableArray(target.joint_stress_tags), stableArray(source.joint_stress_tags)) || row.joint_stress_handling !== "target_subset_or_equal") push(errors, "JOINT_STRESS_CLOSURE", key);

    const sourceRequired = requiredEquipment.get(row.source_exercise_id) ?? [];
    const targetRequired = requiredEquipment.get(row.target_exercise_id) ?? [];
    const expectedChange = classifyEquipmentChange(sourceRequired, targetRequired, eq, errors, row.source_exercise_id, row.target_exercise_id);
    if (expectedChange === "upgrade") push(errors, "EQUIPMENT_UPGRADE", key);
    if (!expectedChange || expectedChange === "upgrade" || row.equipment_change_type !== expectedChange) push(errors, "EQUIPMENT_DIRECTION", { key, expected: expectedChange, actual: row.equipment_change_type });
    if (row.excluded_equipment_handling !== "explicit_target_required_equipment_filter") push(errors, "EXCLUDED_EQUIPMENT_HANDLING", key);

    const expectedActivity = sharedActivities(row.source_exercise_id, row.target_exercise_id, trainingRows);
    if (!sameJson(row.activity_applicability, expectedActivity) || expectedActivity.length === 0) push(errors, "ACTIVITY_CLOSURE", { key, expected: expectedActivity, actual: row.activity_applicability });
    const priority = CHANGE_PRIORITY[expectedChange];
    const difficultyDrop = sourceDifficulty - targetDifficulty;
    const expectedOrdering = `${row.source_exercise_id}|${String(priority).padStart(2, "0")}|${String(difficultyDrop).padStart(2, "0")}|${row.target_exercise_id}`;
    if (row.deterministic_ordering_key !== expectedOrdering) push(errors, "ORDERING_KEY", { key, expected: expectedOrdering, actual: row.deterministic_ordering_key });
    if (previousOrderingKey !== null && row.deterministic_ordering_key.localeCompare(previousOrderingKey) < 0) push(errors, "ORDERING_SEQUENCE", { previous: previousOrderingKey, current: row.deterministic_ordering_key });
    previousOrderingKey = row.deterministic_ordering_key;
    const lower = `${key} ${row.copy_legal_boundary_notes}`.toLowerCase();
    for (const marker of FALLBACK_MARKERS) {
      if (key.toLowerCase().includes(marker)) push(errors, "FALLBACK_EDGE_ID", { key, marker });
    }
    for (const token of REQUIRED_COPY_TOKENS) if (!lower.includes(token)) push(errors, "COPY_BOUNDARY", { key, token });
  }

  const expectedRows = expectedCandidateRows(docs, errors);
  const actualProjection = actualRows.map((row) => ({
    substitution_edge_id: row.substitution_edge_id,
    source_exercise_id: row.source_exercise_id,
    target_exercise_id: row.target_exercise_id,
    movement_pattern_preservation: row.movement_pattern_preservation,
    stimulus_intent_preservation: row.stimulus_intent_preservation,
    equipment_change_type: row.equipment_change_type,
    excluded_equipment_handling: row.excluded_equipment_handling,
    joint_stress_handling: row.joint_stress_handling,
    activity_applicability: row.activity_applicability,
    difficulty_tier_compatibility: row.difficulty_tier_compatibility,
    deterministic_ordering_key: row.deterministic_ordering_key
  }));
  if (!sameJson(actualProjection, expectedRows)) {
    const actualIds = new Set(actualProjection.map((row) => row.substitution_edge_id));
    const expectedIds = new Set(expectedRows.map((row) => row.substitution_edge_id));
    push(errors, "CANDIDATE_SET_CLOSURE", {
      missing: [...expectedIds].filter((id) => !actualIds.has(id)).slice(0, 25),
      unexpected: [...actualIds].filter((id) => !expectedIds.has(id)).slice(0, 25),
      expected_count: expectedRows.length,
      actual_count: actualProjection.length
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      exercises: Object.keys(ex).length,
      movements: Object.keys(mv).length,
      edges: Object.keys(sub).length,
      sources: new Set(actualRows.map((row) => row.source_exercise_id)).size,
      targets: new Set(actualRows.map((row) => row.target_exercise_id)).size
    }
  };
}

function readJson(root, rel) { return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8")); }

export function loadRegFull06Documents(root) {
  return {
    activity: readJson(root, REG_FULL_06_PATHS.activity),
    exercise: readJson(root, REG_FULL_06_PATHS.exercise),
    movement: readJson(root, REG_FULL_06_PATHS.movement),
    equipment: readJson(root, REG_FULL_06_PATHS.equipment),
    equipmentCompatibility: readJson(root, REG_FULL_06_PATHS.equipmentCompatibility),
    applicability: readJson(root, REG_FULL_06_PATHS.applicability),
    substitution: readJson(root, REG_FULL_06_PATHS.substitution),
    legacyGraph: readJson(root, REG_FULL_06_PATHS.legacyGraph),
    surfaceManifest: readJson(root, REG_FULL_06_PATHS.surfaceManifest),
    evidence: readJson(root, REG_FULL_06_PATHS.evidence)
  };
}

function auditEvidence(root, docs, result, errors) {
  const evidence = docs.evidence;
  if (evidence?.evidence_id !== "reg_full_06_substitution_graph_closure" || evidence?.version !== "1.0.0" || evidence?.slice_id !== "REG-FULL-06") push(errors, "EVIDENCE_HEADER", evidence ?? null);
  const expectedAuthority = {
    substitution_registry: REG_FULL_06_PATHS.substitution,
    exercise_registry: REG_FULL_06_PATHS.exercise,
    movement_registry: REG_FULL_06_PATHS.movement,
    equipment_registry: REG_FULL_06_PATHS.equipment,
    equipment_compatibility_registry: REG_FULL_06_PATHS.equipmentCompatibility,
    activity_applicability_registry: REG_FULL_06_PATHS.applicability,
    legacy_graph: REG_FULL_06_PATHS.legacyGraph
  };
  if (!sameJson(evidence?.authority, expectedAuthority)) push(errors, "EVIDENCE_AUTHORITY", evidence?.authority);
  const policy = evidence?.policy ?? {};
  const requiredPolicy = {
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
  };
  if (!sameJson(policy, requiredPolicy)) push(errors, "EVIDENCE_POLICY", policy);
  const rows = Object.values(entries(docs.substitution));
  const byType = { same_required_equipment: 0, lateral: 0, downgrade: 0 };
  for (const row of rows) if (Object.prototype.hasOwnProperty.call(byType, row.equipment_change_type)) byType[row.equipment_change_type]++;
  const expectedCounts = {
    exercise_count: result.counts.exercises,
    edge_count: result.counts.edges,
    source_exercise_count: result.counts.sources,
    target_exercise_count: result.counts.targets,
    equipment_change_type_counts: byType
  };
  if (!sameJson(evidence?.counts, expectedCounts)) push(errors, "EVIDENCE_COUNTS", { expected: expectedCounts, actual: evidence?.counts });
  const hashes = {
    exercise_registry_sha256: sha256File(path.join(root, REG_FULL_06_PATHS.exercise)),
    movement_registry_sha256: sha256File(path.join(root, REG_FULL_06_PATHS.movement)),
    equipment_registry_sha256: sha256File(path.join(root, REG_FULL_06_PATHS.equipment)),
    equipment_compatibility_registry_sha256: sha256File(path.join(root, REG_FULL_06_PATHS.equipmentCompatibility)),
    activity_applicability_registry_sha256: sha256File(path.join(root, REG_FULL_06_PATHS.applicability)),
    substitution_registry_sha256: sha256File(path.join(root, REG_FULL_06_PATHS.substitution)),
    legacy_graph_sha256: sha256File(path.join(root, REG_FULL_06_PATHS.legacyGraph))
  };
  if (!sameJson(evidence?.hashes, hashes)) push(errors, "EVIDENCE_HASH", { expected: hashes, actual: evidence?.hashes });
}

function walkRuntimeFiles(root) {
  const roots = ["src", "engine/src", "public/app-src"];
  const files = [];
  function walk(abs) {
    if (!fs.existsSync(abs)) return;
    for (const dirent of fs.readdirSync(abs, { withFileTypes: true })) {
      const full = path.join(abs, dirent.name);
      if (dirent.isDirectory()) walk(full);
      else if (/\.(?:js|mjs|cjs|ts|tsx)$/.test(dirent.name)) files.push(full);
    }
  }
  for (const rel of roots) walk(path.join(root, ...rel.split("/")));
  return files;
}

function auditRuntimeInference(root, errors) {
  for (const file of walkRuntimeFiles(root)) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (/exercise_substitution_graph/.test(text)) push(errors, "LEGACY_GRAPH_RUNTIME_CONSUMER", rel);
    if (/closest[_A-Za-z]*exercise|closest\s+exercise/i.test(text)) push(errors, "CLOSEST_EXERCISE_RUNTIME_INFERENCE", rel);
  }
}

export function runRegFull06Closure(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")) {
  const docs = loadRegFull06Documents(root);
  const result = auditRegFull06Documents(clone(docs));
  const errors = [...result.errors];
  auditEvidence(root, docs, result, errors);
  auditRuntimeInference(root, errors);
  if (errors.length) {
    const error = new Error(`${REG_FULL_06_FAILURE_TOKEN}\n${errors.map((row) => `${row.code}: ${JSON.stringify(row.detail)}`).join("\n")}`);
    error.name = "RegFull06ClosureError";
    error.errors = errors;
    throw error;
  }
  return { ...result, ok: true };
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    const result = runRegFull06Closure();
    process.stdout.write(`${REG_FULL_06_FAILURE_TOKEN}: PASS exercises=${result.counts.exercises} movements=${result.counts.movements} edges=${result.counts.edges} sources=${result.counts.sources} targets=${result.counts.targets}\n`);
  } catch (error) {
    process.stderr.write(`${error?.message ?? error}\n`);
    process.exit(1);
  }
}
