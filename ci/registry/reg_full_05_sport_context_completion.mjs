/** REG-FULL-05 explicit sport-context closure guard. */
import fs from "node:fs";
import crypto from "node:crypto";

export const REG_FULL_05_FAILURE_TOKEN = "CI_REG_FULL_05_SPORT_CONTEXT_COMPLETION";
export const REG_FULL_05_ACTIVITIES = Object.freeze(["powerlifting", "general_strength", "rugby_union"]);
export const REG_FULL_05_PATHS = Object.freeze({
  activity: "registries/activity/activity.registry.json",
  exercise: "registries/exercise/exercise.registry.json",
  applicability: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json",
  subdivision: "registries/sport_subdivision/sport_subdivision.registry.json",
  role: "registries/sport_role/sport_role.registry.json",
  metric: "registries/sport_metric/sport_metric.registry.json",
  link: "registries/metric_exercise_link/metric_exercise_link.registry.json",
  threshold: "registries/threshold_marker/threshold_marker.registry.json",
  bundle: "registries/registry_bundle.json",
  finalSurface: "registries/final_registry_surface_manifest.json",
  evidence: "ci/evidence/reg_full_05_sport_context_completion.v1.json"
});

export const REG_FULL_05_REQUIRED_SUBDIVISIONS = Object.freeze([
  "powerlifting__competition_lift", "powerlifting__general_preparation", "powerlifting__squat", "powerlifting__bench_press", "powerlifting__deadlift", "powerlifting__competition",
  "general_strength__training", "general_strength__lower_body", "general_strength__upper_body", "general_strength__full_body", "general_strength__conditioning", "general_strength__speed_power",
  "rugby_union__general_preparation", "rugby_union__forwards", "rugby_union__backs", "rugby_union__front_row", "rugby_union__second_row", "rugby_union__back_row", "rugby_union__half_backs", "rugby_union__midfield", "rugby_union__back_three", "rugby_union__speed_power", "rugby_union__conditioning", "rugby_union__set_piece"
]);
export const REG_FULL_05_REQUIRED_RUGBY_ROLES = Object.freeze([
  "rugby_union__field_player", "rugby_union__forward", "rugby_union__back", "rugby_union__loosehead_prop", "rugby_union__hooker", "rugby_union__tighthead_prop", "rugby_union__lock", "rugby_union__blindside_flanker", "rugby_union__openside_flanker", "rugby_union__number_eight", "rugby_union__scrum_half", "rugby_union__fly_half", "rugby_union__inside_centre", "rugby_union__outside_centre", "rugby_union__wing", "rugby_union__fullback"
]);
export const REG_FULL_05_REQUIRED_METRICS = Object.freeze({
  powerlifting: Object.freeze(["powerlifting__load_kg", "powerlifting__repetition_count", "powerlifting__attempt_count", "powerlifting__body_mass_kg", "powerlifting__general_preparation_load_kg", "powerlifting__general_preparation_repetition_count", "powerlifting__general_preparation_set_count", "powerlifting__general_preparation_duration_seconds"]),
  general_strength: Object.freeze(["general_strength__load_kg", "general_strength__repetition_count", "general_strength__set_count", "general_strength__duration_seconds", "general_strength__body_mass_kg", "general_strength__distance_m", "general_strength__sprint_time_seconds", "general_strength__sprint_distance_m", "general_strength__jump_height_cm", "general_strength__jump_distance_cm", "general_strength__change_of_direction_time_seconds"]),
  rugby_union: Object.freeze(["rugby_union__body_mass_kg", "rugby_union__sprint_time_seconds", "rugby_union__load_kg", "rugby_union__repetition_count", "rugby_union__set_count", "rugby_union__duration_seconds", "rugby_union__distance_m", "rugby_union__sprint_distance_m", "rugby_union__jump_height_cm", "rugby_union__jump_distance_cm", "rugby_union__change_of_direction_time_seconds", "rugby_union__contact_repetition_count", "rugby_union__set_piece_repetition_count"])
});
export const REG_FULL_05_HISTORICAL_THRESHOLDS = Object.freeze([
  "threshold_marker__powerlifting__attempt_count__gte_1",
  "threshold_marker__powerlifting__attempt_count__lte_3",
  "threshold_marker__general_strength__set_count__gte_1",
  "threshold_marker__general_strength__duration_seconds__gte_60",
  "threshold_marker__general_strength__duration_seconds__lte_3600"
]);
export const REG_FULL_05_REQUIRED_S_REG_20_LINKS = Object.freeze([
  "powerlifting__attempt_count__paused_back_squat",
  "powerlifting__attempt_count__paused_deadlift",
  "powerlifting__attempt_count__paused_bench_press",
  "general_strength__set_count__paused_back_squat",
  "general_strength__set_count__romanian_deadlift",
  "general_strength__set_count__close_grip_bench_press",
  "general_strength__duration_seconds__tempo_back_squat",
  "general_strength__duration_seconds__romanian_deadlift"
]);
const CANDIDATE_METRIC_SUBDIVISIONS = Object.freeze({
  "powerlifting__body_mass_kg": "powerlifting__general_preparation",
  "rugby_union__jump_height_cm": "rugby_union__general_preparation",
  "rugby_union__sprint_distance_m": "rugby_union__general_preparation"
});
const LINKLESS = new Set(["powerlifting__body_mass_kg", "general_strength__body_mass_kg", "rugby_union__body_mass_kg"]);
const STATUSES = Object.freeze(["recorded_met", "recorded_not_met", "not_recorded", "invalid_source", "insufficient_recorded_data"]);
const OPERATORS = new Set(["greater_than_or_equal", "less_than_or_equal", "equal_to"]);
const SOURCES = new Set(["coach_declared", "organisation_declared_later", "fixture_declared"]);
const BAD = Object.freeze(["fallback", "unknown", "unspecified", "catch_all", "default_"]);

function fail(reason, details = {}) { const e = new Error(reason); e.code = REG_FULL_05_FAILURE_TOKEN; e.reason = reason; e.details = details; throw e; }
function read(path) { return JSON.parse(fs.readFileSync(path, "utf8")); }
function sha(path) { return crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex"); }
function object(value, reason) { if (!value || typeof value !== "object" || Array.isArray(value)) fail(reason, { actual: value }); }
function requireIds(entries, ids, reason) { for (const id of ids) if (!entries[id]) fail(reason, { id }); }
function noFallback(id, surface) { if (BAD.some((marker) => id.includes(marker))) fail("reg_full_05_generic_fallback_forbidden", { surface, id }); }
function pairs(applicability) { return new Set(Object.values(applicability.entries ?? {}).map((row) => `${row.exercise_id}::${row.activity_id}`)); }

export function auditRegFull05Documents(docs) {
  const { activity, exercise, applicability, subdivision, role, metric, link, threshold } = docs;
  for (const [name, doc] of Object.entries(docs)) { object(doc, `reg_full_05_${name}_document_invalid`); object(doc.entries, `reg_full_05_${name}_entries_invalid`); }
  const activities = Object.keys(activity.entries).sort();
  if (JSON.stringify(activities) !== JSON.stringify([...REG_FULL_05_ACTIVITIES].sort())) fail("reg_full_05_supported_activity_set_invalid", { actual: activities });
  if (Object.keys(exercise.entries).length !== 215) fail("reg_full_05_exercise_count_invalid", { actual: Object.keys(exercise.entries).length, expected: 215 });
  if (subdivision.registry_id !== "sport_subdivision" || role.registry_id !== "sport_role" || metric.registry_id !== "sport_metric" || link.registry_id !== "metric_exercise_link" || threshold.registry_id !== "threshold_marker") fail("reg_full_05_registry_identity_invalid");
  for (const doc of [subdivision, role, metric, link, threshold]) if (doc.version !== "2.0.0") fail("reg_full_05_registry_version_invalid", { registry_id: doc.registry_id, actual: doc.version });

  requireIds(subdivision.entries, REG_FULL_05_REQUIRED_SUBDIVISIONS, "reg_full_05_required_subdivision_missing");
  if (Object.keys(subdivision.entries).length < 24) fail("reg_full_05_subdivision_floor_invalid", { actual: Object.keys(subdivision.entries).length });
  const subdivisionCounts = Object.fromEntries(REG_FULL_05_ACTIVITIES.map((id) => [id, 0]));
  for (const [id, row] of Object.entries(subdivision.entries)) {
    noFallback(id, "sport_subdivision");
    if (row.sport_subdivision_id !== id) fail("reg_full_05_subdivision_primary_key_invalid", { id });
    if (!activity.entries[row.activity_id]) fail("reg_full_05_subdivision_activity_fk_missing", { id });
    subdivisionCounts[row.activity_id] += 1;
  }
  for (const id of REG_FULL_05_ACTIVITIES) if (subdivisionCounts[id] < 2) fail("reg_full_05_activity_subdivision_coverage_incomplete", { activity_id: id });

  requireIds(role.entries, ["powerlifting__athlete", "general_strength__participant", ...REG_FULL_05_REQUIRED_RUGBY_ROLES], "reg_full_05_required_role_missing");
  if (Object.keys(role.entries).length < 18) fail("reg_full_05_role_floor_invalid", { actual: Object.keys(role.entries).length });
  const roleCounts = Object.fromEntries(REG_FULL_05_ACTIVITIES.map((id) => [id, 0]));
  for (const [id, row] of Object.entries(role.entries)) {
    noFallback(id, "sport_role");
    if (row.sport_role_id !== id) fail("reg_full_05_role_primary_key_invalid", { id });
    const sub = subdivision.entries[row.sport_subdivision_id];
    if (!activity.entries[row.activity_id]) fail("reg_full_05_role_activity_fk_missing", { id });
    if (!sub) fail("reg_full_05_role_subdivision_fk_missing", { id });
    if (sub.activity_id !== row.activity_id) fail("reg_full_05_role_subdivision_activity_mismatch", { id });
    roleCounts[row.activity_id] += 1;
  }
  for (const id of REG_FULL_05_ACTIVITIES) if (roleCounts[id] < 1) fail("reg_full_05_activity_role_coverage_incomplete", { activity_id: id });

  for (const activityId of REG_FULL_05_ACTIVITIES) requireIds(metric.entries, REG_FULL_05_REQUIRED_METRICS[activityId], "reg_full_05_required_metric_missing");
  if (Object.keys(metric.entries).length < 32) fail("reg_full_05_metric_floor_invalid", { actual: Object.keys(metric.entries).length });
  const metricCounts = Object.fromEntries(REG_FULL_05_ACTIVITIES.map((id) => [id, 0]));
  for (const [id, row] of Object.entries(metric.entries)) {
    noFallback(id, "sport_metric");
    if (row.sport_metric_id !== id) fail("reg_full_05_metric_primary_key_invalid", { id });
    const sub = subdivision.entries[row.sport_subdivision_id];
    if (!activity.entries[row.activity_id]) fail("reg_full_05_metric_activity_fk_missing", { id });
    if (!sub) fail("reg_full_05_metric_subdivision_fk_missing", { id });
    if (sub.activity_id !== row.activity_id) fail("reg_full_05_metric_subdivision_activity_mismatch", { id });
    if (row.metric_kind !== "factual_metric_definition") fail("reg_full_05_metric_kind_invalid", { id });
    metricCounts[row.activity_id] += 1;
  }
  for (const [id, subdivisionId] of Object.entries(CANDIDATE_METRIC_SUBDIVISIONS)) if (metric.entries[id]?.sport_subdivision_id !== subdivisionId) fail("reg_full_05_s_reg_19_metric_semantic_drift", { id, actual: metric.entries[id]?.sport_subdivision_id, expected: subdivisionId });

  const allowedPairs = pairs(applicability);
  const byMetric = new Map();
  const linkCounts = Object.fromEntries(REG_FULL_05_ACTIVITIES.map((id) => [id, 0]));
  const seen = new Set();
  requireIds(link.entries, REG_FULL_05_REQUIRED_S_REG_20_LINKS, "reg_full_05_s_reg_20_candidate_link_missing");
  for (const [id, row] of Object.entries(link.entries)) {
    noFallback(id, "metric_exercise_link");
    if (row.metric_exercise_link_id !== id || id !== `${row.sport_metric_id}__${row.exercise_id}`) fail("reg_full_05_metric_link_primary_key_invalid", { id });
    const metricRow = metric.entries[row.sport_metric_id];
    if (!metricRow) fail("reg_full_05_metric_link_metric_fk_missing", { id, metric_id: row.sport_metric_id });
    if (!exercise.entries[row.exercise_id]) fail("reg_full_05_metric_link_exercise_fk_missing", { id, exercise_id: row.exercise_id });
    if (metricRow.activity_id !== row.activity_id) fail("reg_full_05_metric_link_activity_mismatch", { id });
    if (!allowedPairs.has(`${row.exercise_id}::${row.activity_id}`)) fail("reg_full_05_metric_link_explicit_applicability_missing", { id });
    if (row.link_kind !== "factual_metric_exercise_link" || row.value_context !== "recorded_value_context_only") fail("reg_full_05_metric_link_semantics_invalid", { id });
    const pair = `${row.sport_metric_id}::${row.exercise_id}`;
    if (seen.has(pair)) fail("reg_full_05_metric_link_duplicate", { id });
    seen.add(pair);
    byMetric.set(row.sport_metric_id, (byMetric.get(row.sport_metric_id) ?? 0) + 1);
    linkCounts[row.activity_id] += 1;
  }
  if (Object.keys(link.entries).length <= 12) fail("reg_full_05_metric_link_seed_only", { actual: Object.keys(link.entries).length });
  for (const metricId of Object.keys(metric.entries)) {
    const count = byMetric.get(metricId) ?? 0;
    if (LINKLESS.has(metricId)) { if (count !== 0) fail("reg_full_05_body_mass_metric_must_be_linkless", { metric_id: metricId, count }); }
    else if (count < 1) fail("reg_full_05_linkable_metric_without_explicit_exercise", { metric_id: metricId });
  }
  for (const id of REG_FULL_05_ACTIVITIES) if (linkCounts[id] < 1) fail("reg_full_05_activity_metric_link_coverage_incomplete", { activity_id: id });

  requireIds(threshold.entries, REG_FULL_05_HISTORICAL_THRESHOLDS, "reg_full_05_historical_threshold_missing");
  const byThresholdMetric = new Map();
  const thresholdCounts = Object.fromEntries(REG_FULL_05_ACTIVITIES.map((id) => [id, 0]));
  for (const [id, row] of Object.entries(threshold.entries)) {
    noFallback(id, "threshold_marker");
    if (!id.startsWith("threshold_marker__") || row.threshold_marker_id !== id) fail("reg_full_05_threshold_primary_key_invalid", { id });
    const metricRow = metric.entries[row.sport_metric_id];
    if (!metricRow) fail("reg_full_05_threshold_metric_fk_missing", { id });
    if (metricRow.activity_id !== row.activity_id) fail("reg_full_05_threshold_activity_mismatch", { id });
    if (metricRow.unit !== row.threshold_unit) fail("reg_full_05_threshold_unit_mismatch", { id, metric_unit: metricRow.unit, threshold_unit: row.threshold_unit });
    if (!OPERATORS.has(row.threshold_operator)) fail("reg_full_05_threshold_operator_invalid", { id, actual: row.threshold_operator });
    if (!SOURCES.has(row.threshold_source)) fail("reg_full_05_threshold_source_invalid", { id, actual: row.threshold_source });
    if (JSON.stringify(row.marker_status_allowed_values) !== JSON.stringify(STATUSES)) fail("reg_full_05_threshold_status_contract_invalid", { id });
    const notes = String(row.copy_boundary_notes ?? "").toLowerCase();
    if (!notes.includes("factual") || (!REG_FULL_05_HISTORICAL_THRESHOLDS.includes(id) && (!notes.includes("dormant") || !notes.includes("non-runtime")))) fail("reg_full_05_threshold_copy_boundary_invalid", { id });
    byThresholdMetric.set(row.sport_metric_id, (byThresholdMetric.get(row.sport_metric_id) ?? 0) + 1);
    thresholdCounts[row.activity_id] += 1;
  }
  for (const metricId of Object.keys(metric.entries)) if ((byThresholdMetric.get(metricId) ?? 0) < 1) fail("reg_full_05_metric_without_threshold_marker", { metric_id: metricId });
  for (const id of REG_FULL_05_ACTIVITIES) if (thresholdCounts[id] < 1) fail("reg_full_05_activity_threshold_coverage_incomplete", { activity_id: id });

  return Object.freeze({
    activity_count: activities.length,
    subdivision_count: Object.keys(subdivision.entries).length,
    role_count: Object.keys(role.entries).length,
    metric_count: Object.keys(metric.entries).length,
    metric_link_count: Object.keys(link.entries).length,
    threshold_count: Object.keys(threshold.entries).length,
    by_activity: Object.freeze(Object.fromEntries(REG_FULL_05_ACTIVITIES.map((id) => [id, Object.freeze({ subdivisions: subdivisionCounts[id], roles: roleCounts[id], metrics: metricCounts[id], metric_links: linkCounts[id], thresholds: thresholdCounts[id] })])))
  });
}

export function auditRegFull05Authority({ finalSurface, evidence, liveHashes }) {
  object(finalSurface, "reg_full_05_final_surface_invalid");
  const thresholdEntity = finalSurface.entities?.find((row) => row.canonical_registry_id === "threshold_marker_registry");
  if (!thresholdEntity) fail("reg_full_05_threshold_final_surface_missing");
  const final = thresholdEntity.final_state;
  if (thresholdEntity.classification !== "dormant" || !final || final.authoritative !== false || final.final_runtime_load !== false || final.final_load_position !== null) fail("reg_full_05_threshold_must_remain_dormant_non_runtime", { threshold: thresholdEntity });
  object(evidence, "reg_full_05_evidence_invalid");
  if (evidence.slice_id !== "REG-FULL-05" || evidence.closure_id !== "sport_context_completion" || evidence.status !== "materialized") fail("reg_full_05_evidence_identity_invalid");
  if (JSON.stringify(evidence.authority?.historical_candidate_inputs_preserved) !== JSON.stringify(["S-REG-19", "S-REG-20", "S-REG-21"])) fail("reg_full_05_candidate_history_evidence_invalid");
  if (evidence.authority?.metric_exercise_link_runtime_inference_allowed !== false || evidence.authority?.generic_fallback_allowed !== false) fail("reg_full_05_evidence_fallback_boundary_invalid");
  const s = evidence.authority?.threshold_marker_supersession;
  if (!s || s.final_authoritative !== false || s.final_runtime_load !== false || s.runtime_evaluator_allowed !== false || s.interpretation_or_recommendation_allowed !== false || s.historical_s_reg_30_rows_preserved !== true) fail("reg_full_05_threshold_supersession_invalid", { actual: s });
  if (typeof s.supersedes !== "string" || !s.supersedes.includes("new_content_allowed=false only")) fail("reg_full_05_threshold_supersession_scope_too_broad", { actual: s?.supersedes });
  for (const [key, actual] of Object.entries(liveHashes)) if (evidence.hashes_sha256?.[key] !== actual) fail("reg_full_05_evidence_hash_mismatch", { key, declared: evidence.hashes_sha256?.[key], actual });
}

export function loadRegFull05Documents() {
  return { activity: read(REG_FULL_05_PATHS.activity), exercise: read(REG_FULL_05_PATHS.exercise), applicability: read(REG_FULL_05_PATHS.applicability), subdivision: read(REG_FULL_05_PATHS.subdivision), role: read(REG_FULL_05_PATHS.role), metric: read(REG_FULL_05_PATHS.metric), link: read(REG_FULL_05_PATHS.link), threshold: read(REG_FULL_05_PATHS.threshold) };
}
export function runRegFull05Closure() {
  const result = auditRegFull05Documents(loadRegFull05Documents());
  auditRegFull05Authority({
    finalSurface: read(REG_FULL_05_PATHS.finalSurface), evidence: read(REG_FULL_05_PATHS.evidence),
    liveHashes: { sport_subdivision_registry: sha(REG_FULL_05_PATHS.subdivision), sport_role_registry: sha(REG_FULL_05_PATHS.role), sport_metric_registry: sha(REG_FULL_05_PATHS.metric), metric_exercise_link_registry: sha(REG_FULL_05_PATHS.link), threshold_marker_registry: sha(REG_FULL_05_PATHS.threshold), registry_bundle: sha(REG_FULL_05_PATHS.bundle) }
  });
  console.log(`CI_REG_FULL_05_SPORT_CONTEXT_COMPLETION: PASS activities=${result.activity_count} subdivisions=${result.subdivision_count} roles=${result.role_count} metrics=${result.metric_count} metric_links=${result.metric_link_count} thresholds=${result.threshold_count}`);
  return result;
}
if (process.argv[1]?.endsWith("reg_full_05_sport_context_completion.mjs")) {
  try { runRegFull05Closure(); }
  catch (error) { console.error(`${REG_FULL_05_FAILURE_TOKEN}: ${error.reason ?? error.message}`); if (error.details && Object.keys(error.details).length) console.error(JSON.stringify(error.details, null, 2)); process.exit(1); }
}
