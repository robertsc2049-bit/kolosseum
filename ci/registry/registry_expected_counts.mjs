import fs from "node:fs";
import path from "node:path";

export const REGISTRY_EXPECTED_COUNTS_PATH = "registries/registry_expected_counts.json";
export const REGISTRY_EXPECTED_COUNTS_SNAPSHOT_ID = "kolosseum_registry_expected_counts";
export const REGISTRY_EXPECTED_COUNTS_SCHEMA_VERSION = "1.0.0";

export const REGISTRY_EXPECTED_COUNT_KEYS = Object.freeze([
  "required_active_registry_count",
  "authoritative_schema_count",
  "compact_bundle_registry_count",
  "supported_activity_count",
  "exercise_count",
  "resolved_exercise_count",
  "movement_count",
  "equipment_count",
  "equipment_compatibility_edge_count",
  "required_equipment_edge_count",
  "alternative_equipment_edge_count",
  "activity_relation_pair_count",
  "applicability_row_count",
  "programme_template_count",
  "substitution_edge_count",
  "substitution_source_count",
  "substitution_target_count",
  "copy_source_file_count",
  "copy_source_record_count",
  "copy_provenance_record_count",
  "exact_copy_control_count"
]);

export const REGISTRY_EXPECTED_COUNT_SOURCE_PATHS = Object.freeze({
  surfaceManifest: "registries/final_registry_surface_manifest.json",
  schemaManifest: "registries/final_registry_schema_manifest.json",
  registryIndex: "registries/registry_index.json",
  activity: "registries/activity/activity.registry.json",
  exercise: "registries/exercise/exercise.registry.json",
  movement: "registries/movement/movement.registry.json",
  equipment: "registries/equipment/equipment.registry.json",
  compatibility: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json",
  applicability: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json",
  programmeTemplate: "registries/program/sport_program_template.registry.json",
  substitution: "registries/substitution/substitution.registry.json",
  copy: "registries/copy/copy.registry.json"
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8"));
}

function objectEntries(doc, label) {
  if (!isObject(doc?.entries)) throw new Error(`${label} must expose object entries`);
  return doc.entries;
}

function rows(doc, label) {
  if (Array.isArray(doc?.entries)) return doc.entries;
  if (isObject(doc?.entries)) return Object.values(doc.entries);
  throw new Error(`${label} must expose array or object entries`);
}

function sortedKeys(value) {
  return Object.keys(value).sort((a, b) => a.localeCompare(b));
}

export function loadRegistryExpectedCountSourceDocuments(root = process.cwd()) {
  return Object.fromEntries(
    Object.entries(REGISTRY_EXPECTED_COUNT_SOURCE_PATHS).map(([key, rel]) => [key, readJson(root, rel)])
  );
}

export function deriveRegistryExpectedCountsFromDocuments(documents) {
  const activities = objectEntries(documents.activity, "activity registry");
  const exercises = objectEntries(documents.exercise, "exercise registry");
  const movements = objectEntries(documents.movement, "movement registry");
  const equipment = objectEntries(documents.equipment, "equipment registry");
  const compatibility = objectEntries(documents.compatibility, "equipment compatibility registry");
  const applicability = objectEntries(documents.applicability, "exercise applicability registry");
  const substitutions = objectEntries(documents.substitution, "substitution registry");
  const templates = rows(documents.programmeTemplate, "programme template registry");
  const copyRows = rows(documents.copy, "copy registry");

  const requiredRowsByExercise = new Set();
  let requiredEquipmentEdges = 0;
  let alternativeEquipmentEdges = 0;
  for (const row of Object.values(compatibility)) {
    if (row?.compatibility_type === "required") {
      requiredEquipmentEdges += 1;
      if (typeof row.exercise_id === "string") requiredRowsByExercise.add(row.exercise_id);
    }
    if (row?.compatibility_type === "alternative") alternativeEquipmentEdges += 1;
  }

  const applicabilityExerciseIds = new Set();
  const activityPairs = new Set();
  for (const row of Object.values(applicability)) {
    if (typeof row?.exercise_id === "string") applicabilityExerciseIds.add(row.exercise_id);
    if (typeof row?.exercise_id === "string" && typeof row?.activity_id === "string") {
      activityPairs.add(`${row.exercise_id}\u0000${row.activity_id}`);
    }
  }

  let resolvedExerciseCount = 0;
  for (const [exerciseId, exercise] of Object.entries(exercises)) {
    if (movements[exercise?.movement_pattern_id] && requiredRowsByExercise.has(exerciseId) && applicabilityExerciseIds.has(exerciseId)) {
      resolvedExerciseCount += 1;
    }
  }

  const substitutionRows = Object.values(substitutions);
  const substitutionSources = new Set(substitutionRows.map((row) => row?.source_exercise_id).filter((value) => typeof value === "string"));
  const substitutionTargets = new Set(substitutionRows.map((row) => row?.target_exercise_id).filter((value) => typeof value === "string"));

  const copySourceFiles = new Set();
  let exactCopyControlCount = 0;
  for (const row of copyRows) {
    if (!isObject(row)) throw new Error("copy registry contains a non-object row");
    if (typeof row.source_file === "string" && row.source_file.length > 0) copySourceFiles.add(row.source_file);
    if (!Array.isArray(row.exact_copy_controls)) throw new Error(`copy row ${row.copy_id ?? "unknown"} is missing exact_copy_controls`);
    exactCopyControlCount += row.exact_copy_controls.length;
  }

  const surfaceEntities = Array.isArray(documents.surfaceManifest?.entities) ? documents.surfaceManifest.entities : [];
  const schemaRows = Array.isArray(documents.schemaManifest?.registries) ? documents.schemaManifest.registries : [];
  const registryOrder = Array.isArray(documents.registryIndex?.order) ? documents.registryIndex.order : [];

  return Object.freeze({
    required_active_registry_count: surfaceEntities.filter((row) => row?.classification === "required_active").length,
    authoritative_schema_count: schemaRows.length,
    compact_bundle_registry_count: registryOrder.length,
    supported_activity_count: Object.keys(activities).length,
    exercise_count: Object.keys(exercises).length,
    resolved_exercise_count: resolvedExerciseCount,
    movement_count: Object.keys(movements).length,
    equipment_count: Object.keys(equipment).length,
    equipment_compatibility_edge_count: Object.keys(compatibility).length,
    required_equipment_edge_count: requiredEquipmentEdges,
    alternative_equipment_edge_count: alternativeEquipmentEdges,
    activity_relation_pair_count: activityPairs.size,
    applicability_row_count: Object.keys(applicability).length,
    programme_template_count: templates.length,
    substitution_edge_count: substitutionRows.length,
    substitution_source_count: substitutionSources.size,
    substitution_target_count: substitutionTargets.size,
    copy_source_file_count: copySourceFiles.size,
    copy_source_record_count: copyRows.length,
    copy_provenance_record_count: copyRows.length,
    exact_copy_control_count: exactCopyControlCount
  });
}

export function deriveRegistryExpectedCounts(root = process.cwd()) {
  return deriveRegistryExpectedCountsFromDocuments(loadRegistryExpectedCountSourceDocuments(root));
}

export function buildRegistryExpectedCountsSnapshot(root = process.cwd()) {
  return Object.freeze({
    snapshot_id: REGISTRY_EXPECTED_COUNTS_SNAPSHOT_ID,
    schema_version: REGISTRY_EXPECTED_COUNTS_SCHEMA_VERSION,
    authority: "derived_acceptance_facts_only",
    runtime_registry_authority: false,
    counts: deriveRegistryExpectedCounts(root)
  });
}

export function serializeRegistryExpectedCountsSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function loadRegistryExpectedCounts(root = process.cwd()) {
  return readJson(root, REGISTRY_EXPECTED_COUNTS_PATH);
}

export function auditRegistryExpectedCountsSnapshot(snapshot, derivedCounts) {
  const errors = [];
  if (!isObject(snapshot)
    || snapshot.snapshot_id !== REGISTRY_EXPECTED_COUNTS_SNAPSHOT_ID
    || snapshot.schema_version !== REGISTRY_EXPECTED_COUNTS_SCHEMA_VERSION
    || snapshot.authority !== "derived_acceptance_facts_only"
    || snapshot.runtime_registry_authority !== false
    || !isObject(snapshot.counts)) {
    errors.push({ code: "SNAPSHOT_HEADER", detail: snapshot ?? null });
    return { ok: false, errors };
  }

  const actualKeys = sortedKeys(snapshot.counts);
  const expectedKeys = [...REGISTRY_EXPECTED_COUNT_KEYS].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    errors.push({ code: "SNAPSHOT_COUNT_KEYS", detail: { expected: expectedKeys, actual: actualKeys } });
  }

  for (const key of REGISTRY_EXPECTED_COUNT_KEYS) {
    const actual = snapshot.counts[key];
    const expected = derivedCounts[key];
    if (!Number.isInteger(actual) || actual < 0) {
      errors.push({ code: "SNAPSHOT_COUNT_VALUE", detail: { count: key, actual } });
      continue;
    }
    if (actual !== expected) errors.push({ code: "SNAPSHOT_STALE", detail: { count: key, expected, actual } });
  }
  return { ok: errors.length === 0, errors };
}

export function validateRegistryExpectedCountsSnapshot(root = process.cwd()) {
  let snapshot = null;
  let derivedCounts = null;
  const errors = [];
  try {
    snapshot = loadRegistryExpectedCounts(root);
  } catch (error) {
    errors.push({ code: "SNAPSHOT_MISSING_OR_INVALID", detail: error?.message ?? String(error) });
  }
  try {
    derivedCounts = deriveRegistryExpectedCounts(root);
  } catch (error) {
    errors.push({ code: "SNAPSHOT_DERIVATION_FAILED", detail: error?.message ?? String(error) });
  }
  if (snapshot !== null && derivedCounts !== null) {
    const audit = auditRegistryExpectedCountsSnapshot(snapshot, derivedCounts);
    errors.push(...audit.errors);
  }
  return { ok: errors.length === 0, errors, snapshot, derived_counts: derivedCounts };
}
