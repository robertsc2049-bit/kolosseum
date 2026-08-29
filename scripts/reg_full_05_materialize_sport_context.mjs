/**
 * REG-FULL-05 deterministic authoring only.
 * Generated registry rows are explicit authority; this script is not runtime inference.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const TOKEN = "CI_REG_FULL_05_SPORT_CONTEXT_COMPLETION";
const P = Object.freeze({
  activity: "registries/activity/activity.registry.json",
  exercise: "registries/exercise/exercise.registry.json",
  applicability: "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json",
  equipment: "registries/exercise_equipment_compatibility/exercise_equipment_compatibility.registry.json",
  subdivision: "registries/sport_subdivision/sport_subdivision.registry.json",
  role: "registries/sport_role/sport_role.registry.json",
  metric: "registries/sport_metric/sport_metric.registry.json",
  link: "registries/metric_exercise_link/metric_exercise_link.registry.json",
  threshold: "registries/threshold_marker/threshold_marker.registry.json",
  bundle: "registries/registry_bundle.json",
  evidence: "ci/evidence/reg_full_05_sport_context_completion.v1.json",
  s19: "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
  s20: "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json",
  s26: "ci/registry/s_reg_26_sport_subdivision_registry_activation.mjs",
  s28: "ci/registry/s_reg_28_sport_role_registry_activation.mjs",
  s29: "ci/registry/s_reg_29_metric_exercise_link_registry_activation.mjs",
  s30: "ci/registry/s_reg_30_sport_metric_extension_threshold_marker_activation.mjs"
});
const ACTIVITIES = Object.freeze(["powerlifting", "general_strength", "rugby_union"]);
const HISTORICAL = Object.freeze({
  subdivisions: Object.freeze(["powerlifting__competition_lift", "powerlifting__general_preparation", "general_strength__training", "rugby_union__general_preparation"]),
  roles: Object.freeze(["powerlifting__athlete", "general_strength__participant", "rugby_union__field_player"]),
  links: Object.freeze([
    "powerlifting__load_kg__back_squat", "powerlifting__load_kg__deadlift", "powerlifting__load_kg__bench_press",
    "powerlifting__repetition_count__back_squat", "powerlifting__repetition_count__deadlift", "powerlifting__repetition_count__bench_press",
    "general_strength__load_kg__back_squat", "general_strength__load_kg__deadlift", "general_strength__load_kg__bench_press",
    "general_strength__repetition_count__back_squat", "general_strength__repetition_count__deadlift", "general_strength__repetition_count__bench_press"
  ]),
  thresholds: Object.freeze([
    "threshold_marker__powerlifting__attempt_count__gte_1",
    "threshold_marker__powerlifting__attempt_count__lte_3",
    "threshold_marker__general_strength__set_count__gte_1",
    "threshold_marker__general_strength__duration_seconds__gte_60",
    "threshold_marker__general_strength__duration_seconds__lte_3600"
  ])
});

const subdivision = (id, activity, label) => ({ sport_subdivision_id: id, activity_id: activity, display_label: label, context_type: "declared_context", copy_boundary_notes: "factual sport context classification only" });
const role = (id, activity, subdivisionId, label) => ({ sport_role_id: id, activity_id: activity, sport_subdivision_id: subdivisionId, display_label: label, context_type: "declared_context", copy_boundary_notes: "factual sport role classification only" });
const metric = (id, activity, subdivisionId, label, unit, valueType) => ({ sport_metric_id: id, activity_id: activity, sport_subdivision_id: subdivisionId, display_label: label, metric_kind: "factual_metric_definition", unit, value_type: valueType, copy_boundary_notes: "factual sport metric definition only" });

const SUBDIVISIONS = Object.freeze([
  subdivision("powerlifting__squat", "powerlifting", "Squat"),
  subdivision("powerlifting__bench_press", "powerlifting", "Bench press"),
  subdivision("powerlifting__deadlift", "powerlifting", "Deadlift"),
  subdivision("powerlifting__competition", "powerlifting", "Competition"),
  subdivision("general_strength__lower_body", "general_strength", "Lower body"),
  subdivision("general_strength__upper_body", "general_strength", "Upper body"),
  subdivision("general_strength__full_body", "general_strength", "Full body"),
  subdivision("general_strength__conditioning", "general_strength", "Conditioning"),
  subdivision("general_strength__speed_power", "general_strength", "Speed and power"),
  subdivision("rugby_union__forwards", "rugby_union", "Forwards"),
  subdivision("rugby_union__backs", "rugby_union", "Backs"),
  subdivision("rugby_union__front_row", "rugby_union", "Front row"),
  subdivision("rugby_union__second_row", "rugby_union", "Second row"),
  subdivision("rugby_union__back_row", "rugby_union", "Back row"),
  subdivision("rugby_union__half_backs", "rugby_union", "Half backs"),
  subdivision("rugby_union__midfield", "rugby_union", "Midfield"),
  subdivision("rugby_union__back_three", "rugby_union", "Back three"),
  subdivision("rugby_union__speed_power", "rugby_union", "Speed and power"),
  subdivision("rugby_union__conditioning", "rugby_union", "Conditioning"),
  subdivision("rugby_union__set_piece", "rugby_union", "Set piece")
]);
const ROLES = Object.freeze([
  role("rugby_union__forward", "rugby_union", "rugby_union__forwards", "Forward"),
  role("rugby_union__back", "rugby_union", "rugby_union__backs", "Back"),
  role("rugby_union__loosehead_prop", "rugby_union", "rugby_union__front_row", "Loosehead prop"),
  role("rugby_union__hooker", "rugby_union", "rugby_union__front_row", "Hooker"),
  role("rugby_union__tighthead_prop", "rugby_union", "rugby_union__front_row", "Tighthead prop"),
  role("rugby_union__lock", "rugby_union", "rugby_union__second_row", "Lock"),
  role("rugby_union__blindside_flanker", "rugby_union", "rugby_union__back_row", "Blindside flanker"),
  role("rugby_union__openside_flanker", "rugby_union", "rugby_union__back_row", "Openside flanker"),
  role("rugby_union__number_eight", "rugby_union", "rugby_union__back_row", "Number eight"),
  role("rugby_union__scrum_half", "rugby_union", "rugby_union__half_backs", "Scrum-half"),
  role("rugby_union__fly_half", "rugby_union", "rugby_union__half_backs", "Fly-half"),
  role("rugby_union__inside_centre", "rugby_union", "rugby_union__midfield", "Inside centre"),
  role("rugby_union__outside_centre", "rugby_union", "rugby_union__midfield", "Outside centre"),
  role("rugby_union__wing", "rugby_union", "rugby_union__back_three", "Wing"),
  role("rugby_union__fullback", "rugby_union", "rugby_union__back_three", "Fullback")
]);
// S-REG-19-owned IDs are promoted from its candidate file to preserve prior semantics.
const METRICS = Object.freeze([
  metric("powerlifting__general_preparation_load_kg", "powerlifting", "powerlifting__general_preparation", "General preparation load", "kg", "number"),
  metric("powerlifting__general_preparation_repetition_count", "powerlifting", "powerlifting__general_preparation", "General preparation repetition count", "count", "integer"),
  metric("powerlifting__general_preparation_set_count", "powerlifting", "powerlifting__general_preparation", "General preparation set count", "count", "integer"),
  metric("powerlifting__general_preparation_duration_seconds", "powerlifting", "powerlifting__general_preparation", "General preparation duration", "seconds", "number"),
  metric("general_strength__body_mass_kg", "general_strength", "general_strength__full_body", "Body mass", "kg", "number"),
  metric("general_strength__distance_m", "general_strength", "general_strength__conditioning", "Distance", "m", "number"),
  metric("general_strength__sprint_time_seconds", "general_strength", "general_strength__speed_power", "Sprint time", "seconds", "number"),
  metric("general_strength__sprint_distance_m", "general_strength", "general_strength__speed_power", "Sprint distance", "m", "number"),
  metric("general_strength__jump_height_cm", "general_strength", "general_strength__speed_power", "Jump height", "cm", "number"),
  metric("general_strength__jump_distance_cm", "general_strength", "general_strength__speed_power", "Jump distance", "cm", "number"),
  metric("general_strength__change_of_direction_time_seconds", "general_strength", "general_strength__speed_power", "Change-of-direction time", "seconds", "number"),
  metric("rugby_union__load_kg", "rugby_union", "rugby_union__general_preparation", "Load", "kg", "number"),
  metric("rugby_union__repetition_count", "rugby_union", "rugby_union__general_preparation", "Repetition count", "count", "integer"),
  metric("rugby_union__set_count", "rugby_union", "rugby_union__general_preparation", "Set count", "count", "integer"),
  metric("rugby_union__duration_seconds", "rugby_union", "rugby_union__conditioning", "Duration", "seconds", "number"),
  metric("rugby_union__distance_m", "rugby_union", "rugby_union__conditioning", "Distance", "m", "number"),
  metric("rugby_union__jump_distance_cm", "rugby_union", "rugby_union__speed_power", "Jump distance", "cm", "number"),
  metric("rugby_union__change_of_direction_time_seconds", "rugby_union", "rugby_union__speed_power", "Change-of-direction time", "seconds", "number"),
  metric("rugby_union__contact_repetition_count", "rugby_union", "rugby_union__forwards", "Contact repetition count", "count", "integer"),
  metric("rugby_union__set_piece_repetition_count", "rugby_union", "rugby_union__set_piece", "Set-piece repetition count", "count", "integer")
]);

const LOAD_EQUIPMENT = new Set(["barbell", "dumbbell", "kettlebell", "cable_machine", "trap_bar", "medicine_ball", "sled", "machine_general", "plate"]);
const RESISTANCE = new Set(["squat", "hinge", "single_leg_squat", "single_leg_hinge", "horizontal_push", "incline_push", "decline_push", "vertical_push", "angled_push", "horizontal_pull", "vertical_pull", "carry_bilateral", "carry_unilateral", "core_anti_extension", "core_anti_rotation", "core_anti_lateral_flexion", "rotation", "throw_slam", "conditioning_sled"]);
const DURATION = new Set(["core_anti_extension", "core_anti_rotation", "core_anti_lateral_flexion", "carry_bilateral", "carry_unilateral", "conditioning_sled", "conditioning_cyclical", "conditioning_row", "locomotion_walk", "locomotion_run", "locomotion_crawl"]);
const DISTANCE = new Set(["carry_bilateral", "carry_unilateral", "conditioning_sled", "sprint_acceleration", "sprint_max_velocity", "change_of_direction", "locomotion_walk", "locomotion_run", "locomotion_crawl"]);
const SPRINT = new Set(["sprint_acceleration", "sprint_max_velocity"]);
const COMP_LIFTS = new Set(["back_squat", "bench_press", "deadlift"]);
const LINKLESS_METRIC_REASONS = Object.freeze({
  "powerlifting__body_mass_kg": "athlete_context_measure_not_exercise_measure",
  "general_strength__body_mass_kg": "athlete_context_measure_not_exercise_measure",
  "rugby_union__body_mass_kg": "athlete_context_measure_not_exercise_measure",
  "rugby_union__contact_repetition_count": "sport_context_measure_not_exercise_measure",
  "rugby_union__set_piece_repetition_count": "sport_context_measure_not_exercise_measure"
});
const LINKLESS_METRICS = new Set(Object.keys(LINKLESS_METRIC_REASONS));

function fail(reason, details = {}) { const e = new Error(`${reason}: ${JSON.stringify(details)}`); e.code = TOKEN; throw e; }
function read(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); }
function write(rel, value) { const abs = path.join(ROOT, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function hash(rel) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex"); }
function keep(entries, ids, label) { for (const id of ids) if (!entries[id]) fail(`${label}_historical_seed_missing`, { id }); }
function append(entries, rows, key, label) { const out = { ...entries }; for (const row of rows) { const id = row[key]; if (out[id]) fail(`${label}_collision`, { id }); out[id] = row; } return out; }
function same(actual, expected, fields, reason, id) { for (const field of fields) if (actual[field] !== expected[field]) fail(reason, { id, field, actual: actual[field], expected: expected[field] }); }

function promoteS19(entries, candidate) {
  if (candidate.slice_id !== "S-REG-19" || candidate.registry_id !== "sport_metric_registry_1c") fail("s_reg_19_candidate_identity_invalid");
  const out = { ...entries };
  for (const source of candidate.records ?? []) {
    const row = metric(source.sport_metric_id, source.activity_id, source.sport_subdivision_id, source.display_label, source.unit, source.value_type);
    if (out[row.sport_metric_id]) same(out[row.sport_metric_id], row, ["sport_metric_id", "activity_id", "sport_subdivision_id", "display_label", "metric_kind", "unit", "value_type", "copy_boundary_notes"], "s_reg_19_live_metric_semantic_drift", row.sport_metric_id);
    else out[row.sport_metric_id] = row;
  }
  return out;
}
function applicabilityPairs(registry) { return new Set(Object.values(registry.entries ?? {}).map((row) => `${row.exercise_id}::${row.activity_id}`)); }
function promoteS20(entries, candidate, metrics, exercises, allowedPairs) {
  if (candidate.slice_id !== "S-REG-20" || candidate.registry_id !== "metric_exercise_link_registry_1c_a") fail("s_reg_20_candidate_identity_invalid");
  const out = { ...entries };
  for (const source of candidate.records ?? []) {
    const row = { metric_exercise_link_id: source.metric_exercise_link_id, sport_metric_id: source.sport_metric_id, exercise_id: source.exercise_id, activity_id: source.activity_id, link_kind: source.link_kind, value_context: source.value_context, copy_boundary_notes: "factual metric-exercise relationship only" };
    if (!metrics[row.sport_metric_id]) fail("s_reg_20_metric_fk_missing", { id: row.metric_exercise_link_id });
    if (!exercises[row.exercise_id]) fail("s_reg_20_exercise_fk_missing", { id: row.metric_exercise_link_id });
    if (!allowedPairs.has(`${row.exercise_id}::${row.activity_id}`)) fail("s_reg_20_explicit_applicability_missing", { id: row.metric_exercise_link_id });
    if (out[row.metric_exercise_link_id]) same(out[row.metric_exercise_link_id], row, ["metric_exercise_link_id", "sport_metric_id", "exercise_id", "activity_id", "link_kind", "value_context"], "s_reg_20_live_link_semantic_drift", row.metric_exercise_link_id);
    else out[row.metric_exercise_link_id] = row;
  }
  return out;
}
function equipmentByExercise(registry) {
  const out = new Map();
  for (const row of Object.values(registry.entries ?? {})) { if (!out.has(row.exercise_id)) out.set(row.exercise_id, new Set()); out.get(row.exercise_id).add(row.equipment_id); }
  return out;
}
function isLoaded(map, exerciseId) { return [...(map.get(exerciseId) ?? [])].some((id) => LOAD_EQUIPMENT.has(id)); }
function policy(metricId) {
  if (LINKLESS_METRICS.has(metricId)) return { linkable: false, match: () => false };
  if (["powerlifting__load_kg", "powerlifting__repetition_count", "powerlifting__attempt_count"].includes(metricId)) return { linkable: true, match: (ex) => COMP_LIFTS.has(ex.exercise_id) };
  if (metricId.endsWith("__sprint_time_seconds") || metricId.endsWith("__sprint_distance_m")) return { linkable: true, match: (ex) => SPRINT.has(ex.movement_pattern_id) };
  if (metricId.endsWith("__jump_height_cm")) return { linkable: true, match: (ex) => ex.movement_pattern_id === "jump_vertical" };
  if (metricId.endsWith("__jump_distance_cm")) return { linkable: true, match: (ex) => ex.movement_pattern_id === "jump_horizontal" };
  if (metricId.endsWith("__change_of_direction_time_seconds")) return { linkable: true, match: (ex) => ex.movement_pattern_id === "change_of_direction" };
  if (metricId.endsWith("__distance_m")) return { linkable: true, match: (ex) => DISTANCE.has(ex.movement_pattern_id) };
  if (metricId.endsWith("__duration_seconds") || metricId.endsWith("_duration_seconds")) return { linkable: true, match: (ex) => DURATION.has(ex.movement_pattern_id) };
  if (metricId.endsWith("__load_kg") || metricId.endsWith("_load_kg")) return { linkable: true, match: (ex, eq) => RESISTANCE.has(ex.movement_pattern_id) && isLoaded(eq, ex.exercise_id) };
  if (metricId.endsWith("__repetition_count") || metricId.endsWith("__set_count") || metricId.endsWith("_repetition_count") || metricId.endsWith("_set_count")) return { linkable: true, match: (ex) => RESISTANCE.has(ex.movement_pattern_id) };
  fail("metric_policy_missing", { metric_id: metricId });
}
function link(metricRow, exerciseRow) {
  const id = `${metricRow.sport_metric_id}__${exerciseRow.exercise_id}`;
  return { metric_exercise_link_id: id, sport_metric_id: metricRow.sport_metric_id, exercise_id: exerciseRow.exercise_id, activity_id: metricRow.activity_id, link_kind: "factual_metric_exercise_link", value_context: "recorded_value_context_only", copy_boundary_notes: "explicit factual metric-exercise relationship only; no runtime inference or fallback" };
}
function thresholdTemplate(metricId, row) {
  if (row.value_type === "integer" || row.unit === "count") return [{ idOp: "gte", operator: "greater_than_or_equal", value: 1 }];
  if (metricId.endsWith("__body_mass_kg")) return [{ idOp: "gte", operator: "greater_than_or_equal", value: 1 }];
  if (row.unit === "seconds") return [{ idOp: "gte", operator: "greater_than_or_equal", value: 0.001 }];
  if (["kg", "m", "cm"].includes(row.unit)) return [{ idOp: "gte", operator: "greater_than_or_equal", value: 0 }];
  fail("threshold_template_missing", { metric_id: metricId, unit: row.unit });
}
function threshold(metricRow, t) {
  const suffix = String(t.value).replace(".", "_");
  const id = `threshold_marker__${metricRow.sport_metric_id}__${t.idOp}_${suffix}`;
  return { threshold_marker_id: id, sport_metric_id: metricRow.sport_metric_id, activity_id: metricRow.activity_id, threshold_operator: t.operator, threshold_value: t.value, threshold_unit: metricRow.unit, threshold_source: "coach_declared", marker_status_allowed_values: ["recorded_met", "recorded_not_met", "not_recorded", "invalid_source", "insufficient_recorded_data"], copy_boundary_notes: "factual recorded-value boundary candidate only; dormant/non-runtime; no evaluator, recommendation, suitability, safety or performance interpretation" };
}

function patchHistoricalValidators() {
  const patches = [
    [P.s26, "  return Object.keys(sportSubdivisionRegistry.entries).length;", HISTORICAL.subdivisions, "s_reg_26_historical_activated_record_missing", "sportSubdivisionRegistry"],
    [P.s28, "  return Object.keys(sportRoleRegistry.entries).length;", HISTORICAL.roles, "s_reg_28_historical_activated_record_missing", "sportRoleRegistry"],
    [P.s29, "  return Object.keys(metricExerciseLinkRegistry.entries).length;", HISTORICAL.links, "s_reg_29_historical_activated_record_missing", "metricExerciseLinkRegistry"],
    [P.s30, "  return Object.keys(thresholdMarkerRegistry.entries).length;", HISTORICAL.thresholds, "s_reg_30_historical_threshold_marker_missing", "thresholdMarkerRegistry"]
  ];
  for (const [rel, anchor, ids, reason, variable] of patches) {
    const abs = path.join(ROOT, rel);
    const source = fs.readFileSync(abs, "utf8");
    const marker = `REG-FULL-05 supersession-safe historical membership: ${ids.length}`;
    if (source.includes(marker)) continue;
    if (source.split(anchor).length - 1 !== 1) fail("historical_validator_patch_anchor_invalid", { path: rel });
    const list = JSON.stringify(ids, null, 2).replace(/\n/g, "\n  ");
    const replacement = `  // ${marker}\n  const historicalIds = ${list};\n  for (const id of historicalIds) {\n    if (!${variable}.entries[id]) fail("${reason}", { id });\n  }\n  return historicalIds.length;`;
    fs.writeFileSync(abs, source.replace(anchor, replacement), "utf8");
  }
}

function materialize() {
  const activity = read(P.activity), exercise = read(P.exercise), applicability = read(P.applicability), equipment = read(P.equipment);
  const oldSubdivision = read(P.subdivision), oldRole = read(P.role), oldMetric = read(P.metric), oldLink = read(P.link), oldThreshold = read(P.threshold);
  const s19 = read(P.s19), s20 = read(P.s20);
  const activityIds = Object.keys(activity.entries ?? {}).sort();
  if (JSON.stringify(activityIds) !== JSON.stringify([...ACTIVITIES].sort())) fail("supported_activity_set_invalid", { actual: activityIds });
  if (Object.keys(exercise.entries ?? {}).length !== 215) fail("exercise_count_invalid", { actual: Object.keys(exercise.entries ?? {}).length, expected: 215 });
  keep(oldSubdivision.entries, HISTORICAL.subdivisions, "subdivision");
  keep(oldRole.entries, HISTORICAL.roles, "role");
  keep(oldLink.entries, HISTORICAL.links, "metric_link");
  keep(oldThreshold.entries, HISTORICAL.thresholds, "threshold");

  const subdivisions = append(oldSubdivision.entries, SUBDIVISIONS, "sport_subdivision_id", "subdivision");
  const roles = append(oldRole.entries, ROLES, "sport_role_id", "role");
  const metrics = append(promoteS19(oldMetric.entries, s19), METRICS, "sport_metric_id", "metric");
  const subdivisionIds = new Set(Object.keys(subdivisions));
  const supported = new Set(ACTIVITIES);
  for (const row of Object.values(roles)) {
    if (!supported.has(row.activity_id)) fail("role_activity_fk_missing", { id: row.sport_role_id });
    const sub = subdivisions[row.sport_subdivision_id];
    if (!sub) fail("role_subdivision_fk_missing", { id: row.sport_role_id });
    if (sub.activity_id !== row.activity_id) fail("role_subdivision_activity_mismatch", { id: row.sport_role_id });
  }
  for (const row of Object.values(metrics)) {
    if (!supported.has(row.activity_id)) fail("metric_activity_fk_missing", { id: row.sport_metric_id });
    if (!subdivisionIds.has(row.sport_subdivision_id)) fail("metric_subdivision_fk_missing", { id: row.sport_metric_id });
    if (subdivisions[row.sport_subdivision_id].activity_id !== row.activity_id) fail("metric_subdivision_activity_mismatch", { id: row.sport_metric_id });
  }

  const allowedPairs = applicabilityPairs(applicability);
  const eq = equipmentByExercise(equipment);
  const exercises = Object.values(exercise.entries);
  const links = promoteS20(oldLink.entries, s20, metrics, exercise.entries, allowedPairs);
  for (const metricRow of Object.values(metrics)) {
    const p = policy(metricRow.sport_metric_id);
    if (!p.linkable) continue;
    const matches = exercises.filter((ex) => allowedPairs.has(`${ex.exercise_id}::${metricRow.activity_id}`)).filter((ex) => p.match(ex, eq)).sort((a, b) => a.exercise_id.localeCompare(b.exercise_id));
    if (!matches.length) fail("linkable_metric_has_no_explicit_exercises", { metric_id: metricRow.sport_metric_id });
    for (const ex of matches) { const row = link(metricRow, ex); if (!links[row.metric_exercise_link_id]) links[row.metric_exercise_link_id] = row; }
  }
  for (const row of Object.values(links)) {
    const metricRow = metrics[row.sport_metric_id], exerciseRow = exercise.entries[row.exercise_id];
    if (!metricRow) fail("metric_link_metric_fk_missing", { id: row.metric_exercise_link_id });
    if (!exerciseRow) fail("metric_link_exercise_fk_missing", { id: row.metric_exercise_link_id });
    if (metricRow.activity_id !== row.activity_id) fail("metric_link_activity_mismatch", { id: row.metric_exercise_link_id });
    if (!allowedPairs.has(`${row.exercise_id}::${row.activity_id}`)) fail("metric_link_explicit_applicability_missing", { id: row.metric_exercise_link_id });
    if (row.metric_exercise_link_id !== `${row.sport_metric_id}__${row.exercise_id}`) fail("metric_link_primary_key_invalid", { id: row.metric_exercise_link_id });
  }

  const thresholds = { ...oldThreshold.entries };
  for (const metricRow of Object.values(metrics)) {
    if (Object.values(thresholds).some((row) => row.sport_metric_id === metricRow.sport_metric_id)) continue;
    for (const t of thresholdTemplate(metricRow.sport_metric_id, metricRow)) { const row = threshold(metricRow, t); if (thresholds[row.threshold_marker_id]) fail("threshold_marker_collision", { id: row.threshold_marker_id }); thresholds[row.threshold_marker_id] = row; }
  }
  for (const row of Object.values(thresholds)) {
    const metricRow = metrics[row.sport_metric_id];
    if (!metricRow) fail("threshold_metric_fk_missing", { id: row.threshold_marker_id });
    if (row.activity_id !== metricRow.activity_id) fail("threshold_activity_mismatch", { id: row.threshold_marker_id });
    if (row.threshold_unit !== metricRow.unit) fail("threshold_unit_mismatch", { id: row.threshold_marker_id });
    if (!["greater_than_or_equal", "less_than_or_equal", "equal_to"].includes(row.threshold_operator)) fail("threshold_operator_invalid", { id: row.threshold_marker_id, actual: row.threshold_operator });
  }

  write(P.subdivision, { registry_id: "sport_subdivision", version: "2.0.0", entries: subdivisions });
  write(P.role, { registry_id: "sport_role", version: "2.0.0", entries: roles });
  write(P.metric, { registry_id: "sport_metric", version: "2.0.0", entries: metrics });
  write(P.link, { registry_id: "metric_exercise_link", version: "2.0.0", entries: links });
  write(P.threshold, { registry_id: "threshold_marker", version: "2.0.0", entries: thresholds });
  patchHistoricalValidators();
  console.log(`REG-FULL-05 materialized subdivisions=${Object.keys(subdivisions).length} roles=${Object.keys(roles).length} metrics=${Object.keys(metrics).length} metric_links=${Object.keys(links).length} thresholds=${Object.keys(thresholds).length}`);
}

function assertMaterializedForEvidence() {
  const docs = { subdivision: read(P.subdivision), role: read(P.role), metric: read(P.metric), link: read(P.link), threshold: read(P.threshold) };
  const expected = { subdivision: "sport_subdivision", role: "sport_role", metric: "sport_metric", link: "metric_exercise_link", threshold: "threshold_marker" };
  for (const [key, registryId] of Object.entries(expected)) {
    const doc = docs[key];
    if (doc.registry_id !== registryId || doc.version !== "2.0.0") fail("evidence_requires_materialized_registry", { key, registry_id: doc.registry_id, version: doc.version });
  }
  const counts = {
    subdivision: Object.keys(docs.subdivision.entries ?? {}).length,
    role: Object.keys(docs.role.entries ?? {}).length,
    metric: Object.keys(docs.metric.entries ?? {}).length,
    link: Object.keys(docs.link.entries ?? {}).length,
    threshold: Object.keys(docs.threshold.entries ?? {}).length
  };
  if (counts.subdivision < 24 || counts.role < 18 || counts.metric < 32 || counts.link <= 12 || counts.threshold < counts.metric) fail("evidence_requires_completed_reg_full_05_surface", { counts });
  return docs;
}

function writeEvidence() {
  const { subdivision: subdivisionRegistry, role: roleRegistry, metric: metricRegistry, link: links, threshold: thresholds } = assertMaterializedForEvidence();
  read(P.bundle);
  const byActivity = {};
  for (const activityId of ACTIVITIES) byActivity[activityId] = {
    subdivision_count: Object.values(subdivisionRegistry.entries).filter((row) => row.activity_id === activityId).length,
    role_count: Object.values(roleRegistry.entries).filter((row) => row.activity_id === activityId).length,
    metric_count: Object.values(metricRegistry.entries).filter((row) => row.activity_id === activityId).length,
    metric_exercise_link_count: Object.values(links.entries).filter((row) => row.activity_id === activityId).length,
    threshold_marker_count: Object.values(thresholds.entries).filter((row) => row.activity_id === activityId).length
  };
  write(P.evidence, {
    slice_id: "REG-FULL-05",
    closure_id: "sport_context_completion",
    status: "materialized",
    authority: {
      supported_activities: [...ACTIVITIES],
      sport_subdivision_truth: P.subdivision,
      sport_role_truth: P.role,
      sport_metric_truth: P.metric,
      metric_exercise_link_truth: P.link,
      threshold_marker_truth: P.threshold,
      historical_candidate_inputs_preserved: ["S-REG-19", "S-REG-20", "S-REG-21"],
      metric_exercise_link_runtime_inference_allowed: false,
      generic_fallback_allowed: false,
      metric_exercise_link_exemptions: Object.entries(LINKLESS_METRIC_REASONS).map(([metric_id, reason]) => ({ metric_id, reason })),
      threshold_marker_supersession: {
        supersedes: "REG-FULL-00 threshold_marker_registry new_content_allowed=false only",
        content_extension_authorised_by: "REG-FULL-05 human instruction",
        final_authoritative: false,
        final_runtime_load: false,
        runtime_evaluator_allowed: false,
        interpretation_or_recommendation_allowed: false,
        historical_s_reg_30_rows_preserved: true
      }
    },
    counts: {
      activity_count: ACTIVITIES.length,
      subdivision_count: Object.keys(subdivisionRegistry.entries).length,
      role_count: Object.keys(roleRegistry.entries).length,
      sport_metric_count: Object.keys(metricRegistry.entries).length,
      metric_exercise_link_count: Object.keys(links.entries).length,
      threshold_marker_count: Object.keys(thresholds.entries).length,
      by_activity: byActivity
    },
    historical_seed_counts: { subdivision: 4, role: 3, sport_metric_pre_s_reg_30: 6, sport_metric_s_reg_30_extension: 3, metric_exercise_link: 12, threshold_marker: 5 },
    hashes_sha256: {
      sport_subdivision_registry: hash(P.subdivision),
      sport_role_registry: hash(P.role),
      sport_metric_registry: hash(P.metric),
      metric_exercise_link_registry: hash(P.link),
      threshold_marker_registry: hash(P.threshold),
      registry_bundle: hash(P.bundle)
    }
  });
  console.log(`REG-FULL-05 evidence written: ${P.evidence}`);
}

const args = new Set(process.argv.slice(2));
if (args.has("--write")) materialize();
else if (args.has("--write-evidence")) writeEvidence();
else { console.error("Usage: node scripts/reg_full_05_materialize_sport_context.mjs --write | --write-evidence"); process.exit(1); }
