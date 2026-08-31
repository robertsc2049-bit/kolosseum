import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PATHS = Object.freeze({
  exercise: "registries/exercise/exercise.registry.json",
  movement: "registries/movement/movement.registry.json",
  equipment: "registries/equipment/equipment.registry.json",
  activity: "registries/activity/activity.registry.json",
  applicability: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json",
  compatibility: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json",
  evidence: "ci/evidence/reg_full_04_equipment_applicability_closure.v1.json"
});

const REQUIRED_CONTEXTS = Object.freeze(["training", "testing", "competition"]);
const FALLBACK_MARKERS = Object.freeze(["fallback", "unknown", "unspecified", "catch_all", "catch-all", "default_equipment"]);

function abs(rel) { return path.join(ROOT, ...rel.split("/")); }
function readRaw(rel) { return fs.readFileSync(abs(rel), "utf8"); }
function readJson(rel) { return JSON.parse(readRaw(rel)); }
function entries(doc) { return doc?.entries && typeof doc.entries === "object" && !Array.isArray(doc.entries) ? doc.entries : {}; }
function sha256Text(text) { return crypto.createHash("sha256").update(text, "utf8").digest("hex"); }
function sha256File(rel) { return sha256Text(readRaw(rel)); }
function sortedUnique(values) { return [...new Set(values)].sort(); }
function fail(code, detail) { const error = new Error(`${code}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); error.code = code; error.detail = detail; throw error; }
function containsFallback(value) { const v = String(value ?? "").toLowerCase(); return FALLBACK_MARKERS.some(marker => v === marker || v.includes(`__${marker}`) || v.includes(`${marker}__`) || v.includes(`_${marker}_`)); }

function activityIdsFromExercise(exercise) {
  return sortedUnique([
    exercise.primary_activity_applicability,
    ...(Array.isArray(exercise.secondary_activity_applicability) ? exercise.secondary_activity_applicability : [])
  ].filter(v => typeof v === "string" && v.length > 0));
}

function canonicalEquipmentArray(exerciseId, field, value) {
  if (!Array.isArray(value) || value.some(v => typeof v !== "string" || !v.trim())) fail("REG_FULL_04_EMBEDDED_EQUIPMENT_INVALID", { exercise_id: exerciseId, field });
  const normalized = value.map(v => v.trim());
  if (new Set(normalized).size !== normalized.length) fail("REG_FULL_04_EMBEDDED_EQUIPMENT_DUPLICATE", { exercise_id: exerciseId, field });
  return normalized;
}

function validateAndBuild() {
  const exerciseDoc = readJson(PATHS.exercise);
  const movementDoc = readJson(PATHS.movement);
  const equipmentDoc = readJson(PATHS.equipment);
  const activityDoc = readJson(PATHS.activity);
  const applicabilityDoc = readJson(PATHS.applicability);

  const exercises = entries(exerciseDoc);
  const movements = entries(movementDoc);
  const equipment = entries(equipmentDoc);
  const activities = entries(activityDoc);
  const applicability = entries(applicabilityDoc);

  if (Object.keys(exercises).length !== 221) fail("REG_FULL_04_EXERCISE_UNIVERSE_INVALID", { expected: 221, actual: Object.keys(exercises).length });

  const applicabilityByExercise = new Map();
  for (const [key, row] of Object.entries(applicability)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) fail("REG_FULL_04_APPLICABILITY_ROW_INVALID", key);
    if (!exercises[row.exercise_id]) fail("REG_FULL_04_APPLICABILITY_EXERCISE_FK", { key, exercise_id: row.exercise_id });
    if (!activities[row.activity_id]) fail("REG_FULL_04_APPLICABILITY_ACTIVITY_FK", { key, activity_id: row.activity_id });
    const expectedKey = `${row.exercise_id}__${row.activity_id}__${row.activity_context}`;
    if (row.applicability_id !== key || expectedKey !== key) fail("REG_FULL_04_APPLICABILITY_PRIMARY_KEY", { key, expected: expectedKey });
    if (!REQUIRED_CONTEXTS.includes(row.activity_context)) fail("REG_FULL_04_APPLICABILITY_CONTEXT", { key, context: row.activity_context });
    const list = applicabilityByExercise.get(row.exercise_id) ?? [];
    list.push(row);
    applicabilityByExercise.set(row.exercise_id, list);
  }

  const compatibilityEntries = {};
  let requiredEdgeCount = 0;
  let alternativeEdgeCount = 0;
  let activityRelationPairCount = 0;

  for (const exerciseId of Object.keys(exercises).sort()) {
    const exercise = exercises[exerciseId];
    if (exercise.exercise_id !== exerciseId) fail("REG_FULL_04_EXERCISE_PRIMARY_KEY", { key: exerciseId, exercise_id: exercise.exercise_id });

    const movement = movements[exercise.movement_pattern_id];
    if (!movement) fail("REG_FULL_04_MOVEMENT_FK", { exercise_id: exerciseId, movement_pattern_id: exercise.movement_pattern_id });

    const required = canonicalEquipmentArray(exerciseId, "equipment_requirements", exercise.equipment_requirements);
    const alternatives = canonicalEquipmentArray(exerciseId, "equipment_alternatives", exercise.equipment_alternatives);
    if (required.length === 0) fail("REG_FULL_04_REQUIRED_EQUIPMENT_MISSING", exerciseId);
    const cross = required.filter(id => alternatives.includes(id));
    if (cross.length) fail("REG_FULL_04_EQUIPMENT_TYPE_CONFLICT", { exercise_id: exerciseId, equipment_ids: cross });

    const movementEquipment = new Set(Array.isArray(movement.equipment_vocab) ? movement.equipment_vocab : []);
    for (const [compatibilityType, equipmentIds] of [["required", required], ["alternative", alternatives]]) {
      for (const equipmentId of equipmentIds) {
        if (containsFallback(equipmentId)) fail("REG_FULL_04_GENERIC_FALLBACK_FORBIDDEN", { exercise_id: exerciseId, equipment_id: equipmentId });
        if (!equipment[equipmentId]) fail("REG_FULL_04_EQUIPMENT_FK", { exercise_id: exerciseId, equipment_id: equipmentId });
        if (!movementEquipment.has(equipmentId)) fail("REG_FULL_04_MOVEMENT_EQUIPMENT_COMPATIBILITY", { exercise_id: exerciseId, movement_pattern_id: exercise.movement_pattern_id, equipment_id: equipmentId });
        const compatibilityId = `${exerciseId}__${equipmentId}`;
        if (compatibilityEntries[compatibilityId]) fail("REG_FULL_04_COMPATIBILITY_DUPLICATE", compatibilityId);
        compatibilityEntries[compatibilityId] = {
          compatibility_id: compatibilityId,
          exercise_id: exerciseId,
          equipment_id: equipmentId,
          compatibility_type: compatibilityType,
          copy_legal_boundary_notes: "factual declared exercise-equipment compatibility only; no inference, fallback, recommendation or suitability claim"
        };
        if (compatibilityType === "required") requiredEdgeCount += 1; else alternativeEdgeCount += 1;
      }
    }

    const rows = applicabilityByExercise.get(exerciseId) ?? [];
    if (!rows.length) fail("REG_FULL_04_ACTIVITY_RELATION_MISSING", exerciseId);
    const contextsByActivity = new Map();
    for (const row of rows) {
      const set = contextsByActivity.get(row.activity_id) ?? new Set();
      if (set.has(row.activity_context)) fail("REG_FULL_04_APPLICABILITY_DUPLICATE_CONTEXT", { exercise_id: exerciseId, activity_id: row.activity_id, context: row.activity_context });
      set.add(row.activity_context);
      contextsByActivity.set(row.activity_id, set);
    }
    for (const [activityId, contexts] of contextsByActivity) {
      const actualContexts = [...contexts].sort();
      const expectedContexts = [...REQUIRED_CONTEXTS].sort();
      if (JSON.stringify(actualContexts) !== JSON.stringify(expectedContexts)) fail("REG_FULL_04_ACTIVITY_CONTEXT_CLOSURE", { exercise_id: exerciseId, activity_id: activityId, actual: actualContexts, expected: expectedContexts });
      if (!(Array.isArray(movement.activity_applicability) && movement.activity_applicability.includes(activityId))) fail("REG_FULL_04_MOVEMENT_ACTIVITY_COMPATIBILITY", { exercise_id: exerciseId, movement_pattern_id: exercise.movement_pattern_id, activity_id: activityId });
      activityRelationPairCount += 1;
    }

    const explicitActivityIds = [...contextsByActivity.keys()].sort();
    const embeddedActivityIds = activityIdsFromExercise(exercise);
    if (JSON.stringify(explicitActivityIds) !== JSON.stringify(embeddedActivityIds)) fail("REG_FULL_04_EMBEDDED_ACTIVITY_PROJECTION_DRIFT", { exercise_id: exerciseId, explicit: explicitActivityIds, embedded: embeddedActivityIds });
  }

  const compatibilityDoc = {
    registry_id: "exercise_equipment_compatibility_registry",
    version: "1.0.0",
    entries: compatibilityEntries
  };

  const exerciseCount = Object.keys(exercises).length;
  return {
    compatibilityDoc,
    counts: {
      exercise_count: exerciseCount,
      resolved_exercise_count: exerciseCount,
      compatibility_edge_count: Object.keys(compatibilityEntries).length,
      required_equipment_edge_count: requiredEdgeCount,
      alternative_equipment_edge_count: alternativeEdgeCount,
      activity_relation_pair_count: activityRelationPairCount,
      applicability_row_count: Object.keys(applicability).length
    }
  };
}

const { compatibilityDoc, counts } = validateAndBuild();
const compatibilityText = `${JSON.stringify(compatibilityDoc, null, 2)}\n`;

if (!process.argv.includes("--write")) {
  console.log(JSON.stringify({ ok: true, write_required: true, paths: PATHS, counts }, null, 2));
  process.exit(0);
}

fs.mkdirSync(path.dirname(abs(PATHS.compatibility)), { recursive: true });
fs.writeFileSync(abs(PATHS.compatibility), compatibilityText, "utf8");

const evidence = {
  slice_id: "REG-FULL-04",
  closure_id: "equipment_compatibility_applicability_closure",
  status: "materialized",
  authority: {
    exercise_equipment_truth: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json",
    exercise_activity_truth: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json",
    embedded_exercise_equipment_fields: "compatibility_projection_only",
    embedded_exercise_activity_fields: "compatibility_projection_only",
    inferred_equipment_allowed: false,
    generic_fallback_allowed: false
  },
  counts,
  sha256: {
    exercise_registry: sha256File(PATHS.exercise),
    movement_registry: sha256File(PATHS.movement),
    equipment_registry: sha256File(PATHS.equipment),
    activity_registry: sha256File(PATHS.activity),
    exercise_activity_applicability_registry: sha256File(PATHS.applicability),
    exercise_equipment_compatibility_registry: sha256Text(compatibilityText)
  }
};

fs.mkdirSync(path.dirname(abs(PATHS.evidence)), { recursive: true });
fs.writeFileSync(abs(PATHS.evidence), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`REG-FULL-04 materialized ${counts.compatibility_edge_count} equipment edges and ${counts.activity_relation_pair_count} exercise-activity pairs across ${counts.exercise_count} exercises.`);
