import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const TOKEN = "CI_REG_FULL_04_EQUIPMENT_COMPATIBILITY_APPLICABILITY_CLOSURE";
export const EXPECTED_EXERCISE_COUNT = 244;
export const REQUIRED_CONTEXTS = Object.freeze(["training", "testing", "competition"]);
export const VALID_COMPATIBILITY_TYPES = Object.freeze(["required", "alternative"]);
export const PATHS = Object.freeze({
  exercise: "registries/exercise/exercise.registry.json",
  movement: "registries/movement/movement.registry.json",
  equipment: "registries/equipment/equipment.registry.json",
  activity: "registries/activity/activity.registry.json",
  applicability: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json",
  compatibility: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json",
  surface: "registries/final_registry_surface_manifest.json",
  evidence: "ci/evidence/reg_full_04_equipment_applicability_closure.v1.json"
});

const FALLBACK_MARKERS = Object.freeze(["fallback", "unknown", "unspecified", "catch_all", "catch-all", "default_equipment"]);
const EXPECTED_SURFACE_DEPENDENCIES = Object.freeze(["exercise_registry_3a", "equipment_environment_registry_3e"]);

function readJson(root, rel) { return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8")); }
function entries(doc) { return doc?.entries && typeof doc.entries === "object" && !Array.isArray(doc.entries) ? doc.entries : {}; }
function push(errors, code, detail) { errors.push({ code, detail }); }
function sortedUnique(values) { return [...new Set(values)].sort(); }
function sameSet(a, b) { return JSON.stringify(sortedUnique(a)) === JSON.stringify(sortedUnique(b)); }
function containsFallback(value) { const v = String(value ?? "").toLowerCase(); return FALLBACK_MARKERS.some(marker => v === marker || v.includes(`__${marker}`) || v.includes(`${marker}__`) || v.includes(`_${marker}_`)); }
function activityIdsFromExercise(exercise) {
  return sortedUnique([
    exercise?.primary_activity_applicability,
    ...(Array.isArray(exercise?.secondary_activity_applicability) ? exercise.secondary_activity_applicability : [])
  ].filter(v => typeof v === "string" && v.length > 0));
}
function sha256Text(text) { return crypto.createHash("sha256").update(text, "utf8").digest("hex"); }
function sha256File(root, rel) { return sha256Text(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8")); }

export function auditRegFull04Documents({ exercise, movement, equipment, activity, applicability, compatibility }) {
  const errors = [];
  const ex = entries(exercise);
  const mv = entries(movement);
  const eq = entries(equipment);
  const ac = entries(activity);
  const ap = entries(applicability);
  const cp = entries(compatibility);

  if (exercise?.registry_id !== "exercise") push(errors, "EXERCISE_REGISTRY_ID", exercise?.registry_id);
  if (compatibility?.registry_id !== "exercise_equipment_compatibility_registry") push(errors, "COMPATIBILITY_REGISTRY_ID", compatibility?.registry_id);
  if (Object.keys(ex).length !== EXPECTED_EXERCISE_COUNT) push(errors, "EXERCISE_COUNT", { expected: EXPECTED_EXERCISE_COUNT, actual: Object.keys(ex).length });

  const equipmentRowsByExercise = new Map();
  const seenEquipmentPair = new Set();
  for (const [key, row] of Object.entries(cp)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) { push(errors, "COMPATIBILITY_ROW", key); continue; }
    const expectedKey = `${row.exercise_id}__${row.equipment_id}`;
    if (row.compatibility_id !== key || expectedKey !== key) push(errors, "COMPATIBILITY_PRIMARY_KEY", { key, expected: expectedKey, compatibility_id: row.compatibility_id });
    if (seenEquipmentPair.has(expectedKey)) push(errors, "COMPATIBILITY_DUPLICATE", expectedKey); else seenEquipmentPair.add(expectedKey);
    if (!VALID_COMPATIBILITY_TYPES.includes(row.compatibility_type)) push(errors, "COMPATIBILITY_TYPE", { key, compatibility_type: row.compatibility_type });
    if (containsFallback(row.equipment_id) || containsFallback(row.compatibility_id)) push(errors, "GENERIC_FALLBACK_FORBIDDEN", key);
    if (!ex[row.exercise_id]) push(errors, "COMPATIBILITY_EXERCISE_FK", { key, exercise_id: row.exercise_id });
    if (!eq[row.equipment_id]) push(errors, "COMPATIBILITY_EQUIPMENT_FK", { key, equipment_id: row.equipment_id });
    const list = equipmentRowsByExercise.get(row.exercise_id) ?? [];
    list.push(row);
    equipmentRowsByExercise.set(row.exercise_id, list);
  }

  const applicabilityRowsByExercise = new Map();
  const seenApplicabilityKeys = new Set();
  for (const [key, row] of Object.entries(ap)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) { push(errors, "APPLICABILITY_ROW", key); continue; }
    const expectedKey = `${row.exercise_id}__${row.activity_id}__${row.activity_context}`;
    if (row.applicability_id !== key || expectedKey !== key) push(errors, "APPLICABILITY_PRIMARY_KEY", { key, expected: expectedKey, applicability_id: row.applicability_id });
    if (seenApplicabilityKeys.has(expectedKey)) push(errors, "APPLICABILITY_DUPLICATE", expectedKey); else seenApplicabilityKeys.add(expectedKey);
    if (!ex[row.exercise_id]) push(errors, "APPLICABILITY_EXERCISE_FK", { key, exercise_id: row.exercise_id });
    if (!ac[row.activity_id]) push(errors, "APPLICABILITY_ACTIVITY_FK", { key, activity_id: row.activity_id });
    if (!REQUIRED_CONTEXTS.includes(row.activity_context)) push(errors, "APPLICABILITY_CONTEXT", { key, context: row.activity_context });
    const list = applicabilityRowsByExercise.get(row.exercise_id) ?? [];
    list.push(row);
    applicabilityRowsByExercise.set(row.exercise_id, list);
  }

  let resolvedExercises = 0;
  let requiredEquipmentEdges = 0;
  let alternativeEquipmentEdges = 0;
  let activityRelationPairs = 0;

  for (const [exerciseId, exerciseRow] of Object.entries(ex)) {
    if (!exerciseRow || typeof exerciseRow !== "object" || Array.isArray(exerciseRow)) { push(errors, "EXERCISE_ROW", exerciseId); continue; }
    if (exerciseRow.exercise_id !== exerciseId) push(errors, "EXERCISE_PRIMARY_KEY", { key: exerciseId, exercise_id: exerciseRow.exercise_id });

    const movementId = exerciseRow.movement_pattern_id;
    const movementRow = mv[movementId];
    if (!movementRow) push(errors, "MOVEMENT_FK", { exercise_id: exerciseId, movement_pattern_id: movementId });

    const equipmentRows = equipmentRowsByExercise.get(exerciseId) ?? [];
    const requiredRows = equipmentRows.filter(row => row.compatibility_type === "required");
    const alternativeRows = equipmentRows.filter(row => row.compatibility_type === "alternative");
    if (requiredRows.length === 0) push(errors, "EXPLICIT_REQUIRED_EQUIPMENT_MISSING", exerciseId);
    requiredEquipmentEdges += requiredRows.length;
    alternativeEquipmentEdges += alternativeRows.length;

    const movementEquipment = new Set(Array.isArray(movementRow?.equipment_vocab) ? movementRow.equipment_vocab : []);
    for (const row of equipmentRows) {
      if (!movementEquipment.has(row.equipment_id)) push(errors, "MOVEMENT_EQUIPMENT_COMPATIBILITY", { exercise_id: exerciseId, movement_pattern_id: movementId, equipment_id: row.equipment_id });
    }

    const embeddedRequired = Array.isArray(exerciseRow.equipment_requirements) ? exerciseRow.equipment_requirements : [];
    const embeddedAlternatives = Array.isArray(exerciseRow.equipment_alternatives) ? exerciseRow.equipment_alternatives : [];
    const explicitRequired = requiredRows.map(row => row.equipment_id);
    const explicitAlternatives = alternativeRows.map(row => row.equipment_id);
    if (!sameSet(explicitRequired, embeddedRequired)) push(errors, "EMBEDDED_REQUIRED_EQUIPMENT_PROJECTION_DRIFT", { exercise_id: exerciseId, explicit: sortedUnique(explicitRequired), embedded: sortedUnique(embeddedRequired) });
    if (!sameSet(explicitAlternatives, embeddedAlternatives)) push(errors, "EMBEDDED_ALTERNATIVE_EQUIPMENT_PROJECTION_DRIFT", { exercise_id: exerciseId, explicit: sortedUnique(explicitAlternatives), embedded: sortedUnique(embeddedAlternatives) });

    const applicabilityRows = applicabilityRowsByExercise.get(exerciseId) ?? [];
    if (applicabilityRows.length === 0) push(errors, "EXPLICIT_ACTIVITY_RELATION_MISSING", exerciseId);
    const contextsByActivity = new Map();
    for (const row of applicabilityRows) {
      const contexts = contextsByActivity.get(row.activity_id) ?? [];
      contexts.push(row.activity_context);
      contextsByActivity.set(row.activity_id, contexts);
    }
    for (const [activityId, contexts] of contextsByActivity) {
      if (!sameSet(contexts, REQUIRED_CONTEXTS) || contexts.length !== REQUIRED_CONTEXTS.length) push(errors, "ACTIVITY_CONTEXT_CLOSURE", { exercise_id: exerciseId, activity_id: activityId, contexts: sortedUnique(contexts) });
      if (!(Array.isArray(movementRow?.activity_applicability) && movementRow.activity_applicability.includes(activityId))) push(errors, "MOVEMENT_ACTIVITY_COMPATIBILITY", { exercise_id: exerciseId, movement_pattern_id: movementId, activity_id: activityId });
      activityRelationPairs += 1;
    }

    const explicitActivities = [...contextsByActivity.keys()];
    const embeddedActivities = activityIdsFromExercise(exerciseRow);
    if (!sameSet(explicitActivities, embeddedActivities)) push(errors, "EMBEDDED_ACTIVITY_PROJECTION_DRIFT", { exercise_id: exerciseId, explicit: sortedUnique(explicitActivities), embedded: embeddedActivities });

    if (movementRow && requiredRows.length > 0 && contextsByActivity.size > 0) resolvedExercises += 1;
  }

  for (const exerciseId of equipmentRowsByExercise.keys()) if (!ex[exerciseId]) push(errors, "ORPHAN_EQUIPMENT_RELATION", exerciseId);
  for (const exerciseId of applicabilityRowsByExercise.keys()) if (!ex[exerciseId]) push(errors, "ORPHAN_ACTIVITY_RELATION", exerciseId);

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      exercise_count: Object.keys(ex).length,
      resolved_exercise_count: resolvedExercises,
      compatibility_edge_count: Object.keys(cp).length,
      required_equipment_edge_count: requiredEquipmentEdges,
      alternative_equipment_edge_count: alternativeEquipmentEdges,
      activity_relation_pair_count: activityRelationPairs,
      applicability_row_count: Object.keys(ap).length
    }
  };
}

export function loadRegFull04Documents(root = process.cwd()) {
  return {
    exercise: readJson(root, PATHS.exercise),
    movement: readJson(root, PATHS.movement),
    equipment: readJson(root, PATHS.equipment),
    activity: readJson(root, PATHS.activity),
    applicability: readJson(root, PATHS.applicability),
    compatibility: readJson(root, PATHS.compatibility)
  };
}

export function resolveExerciseRelations(documents, exerciseId) {
  const ex = entries(documents.exercise);
  const cp = entries(documents.compatibility);
  const ap = entries(documents.applicability);
  const exerciseRow = ex[exerciseId];
  if (!exerciseRow) { const error = new Error(`unknown exercise: ${exerciseId}`); error.code = "REG_FULL_04_UNKNOWN_EXERCISE"; throw error; }

  const equipmentRows = Object.values(cp).filter(row => row?.exercise_id === exerciseId);
  const required = sortedUnique(equipmentRows.filter(row => row.compatibility_type === "required").map(row => row.equipment_id));
  const alternatives = sortedUnique(equipmentRows.filter(row => row.compatibility_type === "alternative").map(row => row.equipment_id));
  if (required.length === 0) { const error = new Error(`missing explicit required equipment relation: ${exerciseId}`); error.code = "REG_FULL_04_REQUIRED_EQUIPMENT_RELATION_MISSING"; throw error; }

  const activityIds = sortedUnique(Object.values(ap).filter(row => row?.exercise_id === exerciseId).map(row => row.activity_id));
  if (activityIds.length === 0) { const error = new Error(`missing explicit activity relation: ${exerciseId}`); error.code = "REG_FULL_04_ACTIVITY_RELATION_MISSING"; throw error; }

  return Object.freeze({
    exercise_id: exerciseId,
    movement_pattern_id: exerciseRow.movement_pattern_id,
    required_equipment_ids: Object.freeze(required),
    alternative_equipment_ids: Object.freeze(alternatives),
    activity_ids: Object.freeze(activityIds)
  });
}

function auditCanonicalSurfaceAuthority(root) {
  const errors = [];
  let surface;
  try { surface = readJson(root, PATHS.surface); }
  catch (error) { return [{ code: "SURFACE_AUTHORITY_MISSING_OR_INVALID", detail: String(error?.message ?? error) }]; }

  if (surface?.manifest_id !== "kolosseum_final_registry_surface_authority" || surface?.slice_id !== "REG-FULL-00" || surface?.status !== "authoritative") {
    push(errors, "SURFACE_AUTHORITY_HEADER", { manifest_id: surface?.manifest_id, slice_id: surface?.slice_id, status: surface?.status });
    return errors;
  }

  const entity = Array.isArray(surface.entities)
    ? surface.entities.find(candidate => candidate?.canonical_registry_id === "exercise_equipment_compatibility_registry")
    : null;
  if (!entity) {
    push(errors, "SURFACE_AUTHORITY_ENTITY_MISSING", "exercise_equipment_compatibility_registry");
    return errors;
  }

  if (entity.classification !== "required_active") push(errors, "SURFACE_AUTHORITY_CLASSIFICATION", entity.classification);
  if (entity.final_state?.authoritative !== true || entity.final_state?.final_runtime_load !== true || entity.final_state?.new_content_allowed !== true || entity.final_state?.final_load_position !== 21) {
    push(errors, "SURFACE_AUTHORITY_FINAL_STATE", entity.final_state);
  }
  if (!sameSet(entity.dependency_ids ?? [], EXPECTED_SURFACE_DEPENDENCIES)) push(errors, "SURFACE_AUTHORITY_DEPENDENCIES", entity.dependency_ids);
  return errors;
}

function auditEvidence(root, result) {
  const errors = [];
  let evidence;
  try { evidence = readJson(root, PATHS.evidence); }
  catch (error) { return [{ code: "EVIDENCE_MISSING_OR_INVALID", detail: String(error?.message ?? error) }]; }

  if (evidence?.slice_id !== "REG-FULL-04" || evidence?.closure_id !== "equipment_compatibility_applicability_closure" || evidence?.status !== "materialized") push(errors, "EVIDENCE_HEADER", evidence);
  if (evidence?.authority?.exercise_equipment_truth !== PATHS.compatibility) push(errors, "EVIDENCE_EQUIPMENT_AUTHORITY", evidence?.authority?.exercise_equipment_truth);
  if (evidence?.authority?.exercise_activity_truth !== PATHS.applicability) push(errors, "EVIDENCE_ACTIVITY_AUTHORITY", evidence?.authority?.exercise_activity_truth);
  if (evidence?.authority?.embedded_exercise_equipment_fields !== "compatibility_projection_only" || evidence?.authority?.embedded_exercise_activity_fields !== "compatibility_projection_only") push(errors, "EVIDENCE_EMBEDDED_AUTHORITY", evidence?.authority);
  if (evidence?.authority?.inferred_equipment_allowed !== false || evidence?.authority?.generic_fallback_allowed !== false) push(errors, "EVIDENCE_FAIL_CLOSED", evidence?.authority);

  for (const [key, actual] of Object.entries(result.counts)) if (evidence?.counts?.[key] !== actual) push(errors, "EVIDENCE_COUNT", { key, expected: actual, actual: evidence?.counts?.[key] });

  const expectedHashes = {
    exercise_registry: sha256File(root, PATHS.exercise),
    movement_registry: sha256File(root, PATHS.movement),
    equipment_registry: sha256File(root, PATHS.equipment),
    activity_registry: sha256File(root, PATHS.activity),
    exercise_activity_applicability_registry: sha256File(root, PATHS.applicability),
    exercise_equipment_compatibility_registry: sha256File(root, PATHS.compatibility)
  };
  for (const [key, expected] of Object.entries(expectedHashes)) if (evidence?.sha256?.[key] !== expected) push(errors, "EVIDENCE_HASH", { key, expected, actual: evidence?.sha256?.[key] });
  return errors;
}

export function auditRegFull04(root = process.cwd()) {
  let documents;
  try { documents = loadRegFull04Documents(root); }
  catch (error) { return { ok: false, errors: [{ code: "REQUIRED_RELATION_FILE_MISSING", detail: String(error?.message ?? error) }], counts: {} }; }
  const result = auditRegFull04Documents(documents);
  const surfaceErrors = auditCanonicalSurfaceAuthority(root);
  const evidenceErrors = auditEvidence(root, result);
  return { ...result, ok: result.ok && surfaceErrors.length === 0 && evidenceErrors.length === 0, errors: [...result.errors, ...surfaceErrors, ...evidenceErrors] };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("reg_full_04_equipment_compatibility_applicability_closure.mjs")) {
  const result = auditRegFull04(process.cwd());
  if (!result.ok) {
    console.error(`${TOKEN}: FAIL`);
    for (const error of result.errors) console.error(`${error.code}: ${typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail)}`);
    process.exit(1);
  }
  console.log(`${TOKEN}: PASS exercises=${result.counts.resolved_exercise_count}/${result.counts.exercise_count} equipment_edges=${result.counts.compatibility_edge_count} activity_pairs=${result.counts.activity_relation_pair_count} applicability_rows=${result.counts.applicability_row_count}`);
}
