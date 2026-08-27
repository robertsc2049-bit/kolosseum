// DEV NOTE: REG-FULL-02 shared enforcement module. This closes the locked v0
// activity/movement universe and proves reciprocal activity<->movement coverage.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TOKEN = "CI_REG_FULL_02_ACTIVITY_MOVEMENT_COMPLETION";
export const REQUIRED_ACTIVITIES = Object.freeze(["powerlifting", "general_strength", "rugby_union"]);
export const REQUIRED_MOVEMENTS = Object.freeze([
  "squat", "hinge", "single_leg_squat", "single_leg_hinge",
  "knee_extension_isolation", "knee_flexion_isolation", "hip_abduction_isolation",
  "hip_adduction_isolation", "hip_extension_isolation", "hip_flexion_isolation",
  "calf_raise", "tibialis_raise", "horizontal_push", "incline_push", "decline_push",
  "vertical_push", "angled_push", "horizontal_pull", "vertical_pull", "scapular_retraction",
  "scapular_protraction", "scapular_upward_rotation", "scapular_depression",
  "shoulder_external_rotation", "shoulder_internal_rotation", "shoulder_abduction_isolation",
  "shoulder_horizontal_abduction_isolation", "elbow_flexion_isolation",
  "elbow_extension_isolation", "forearm_flexion_isolation", "forearm_extension_isolation",
  "grip_crush", "grip_support", "carry_bilateral", "carry_unilateral", "core_anti_extension",
  "core_anti_rotation", "core_anti_lateral_flexion", "trunk_flexion", "trunk_extension",
  "rotation", "locomotion_walk", "locomotion_run", "locomotion_crawl", "jump_vertical",
  "jump_horizontal", "sprint_acceleration", "sprint_max_velocity", "deceleration",
  "change_of_direction", "throw_slam", "conditioning_cyclical", "conditioning_row",
  "conditioning_sled"
]);
export const FORBIDDEN_MOVEMENT_ALIASES = Object.freeze([
  "carry", "lunge_split_stance", "brace", "jump_land", "deceleration_change_of_direction",
  "conditioning_general", "trunk_rotation_anti_rotation", "split_squat", "reverse_lunge",
  "step_up", "hip_thrust", "glute_bridge", "throw_pattern"
]);

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8"));
}
function sameSet(actual, expected) {
  return actual.length === expected.length && new Set(actual).size === actual.length && expected.every((x) => actual.includes(x));
}
function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

export function auditRegFull02(root) {
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  let activity; let movement;
  try { activity = readJson(root, "registries/activity/activity.registry.json"); }
  catch (e) { return { ok: false, errors: [{ code: "ACTIVITY_READ", detail: String(e.message || e) }] }; }
  try { movement = readJson(root, "registries/movement/movement.registry.json"); }
  catch (e) { return { ok: false, errors: [{ code: "MOVEMENT_READ", detail: String(e.message || e) }] }; }

  const activityEntries = isObject(activity?.entries) ? activity.entries : {};
  const movementEntries = isObject(movement?.entries) ? movement.entries : {};
  const activityIds = Object.keys(activityEntries);
  const movementIds = Object.keys(movementEntries);

  if (!sameSet(activityIds, REQUIRED_ACTIVITIES)) fail("ACTIVITY_SET", activityIds);
  if (!sameSet(movementIds, REQUIRED_MOVEMENTS)) fail("MOVEMENT_SET", `${movementIds.length}/54`);
  for (const alias of FORBIDDEN_MOVEMENT_ALIASES) {
    if (Object.prototype.hasOwnProperty.call(movementEntries, alias)) fail("FORBIDDEN_MOVEMENT_ALIAS", alias);
  }

  let activityToMovement = 0;
  for (const activityId of REQUIRED_ACTIVITIES) {
    const row = activityEntries[activityId];
    if (!isObject(row)) { fail("ACTIVITY_ROW_MISSING", activityId); continue; }
    if (row.activity_id !== activityId) fail("ACTIVITY_PRIMARY_KEY", activityId);
    const allowed = Array.isArray(row.allowed_movement_patterns) ? row.allowed_movement_patterns : [];
    if (!sameSet(allowed, REQUIRED_MOVEMENTS)) fail("ACTIVITY_ALLOWED_MOVEMENTS", `${activityId}:${allowed.length}/54`);
    else activityToMovement += allowed.length;
  }

  let movementToActivity = 0;
  for (const movementId of REQUIRED_MOVEMENTS) {
    const row = movementEntries[movementId];
    if (!isObject(row)) { fail("MOVEMENT_ROW_MISSING", movementId); continue; }
    if (row.movement_pattern_id !== movementId) fail("MOVEMENT_PRIMARY_KEY", movementId);
    const applicable = Array.isArray(row.activity_applicability) ? row.activity_applicability : [];
    if (!sameSet(applicable, REQUIRED_ACTIVITIES)) fail("MOVEMENT_ACTIVITY_APPLICABILITY", `${movementId}:${applicable.length}/3`);
    else movementToActivity += applicable.length;
  }

  for (const activityId of REQUIRED_ACTIVITIES) {
    const allowed = activityEntries[activityId]?.allowed_movement_patterns || [];
    for (const movementId of allowed) {
      if (!movementEntries[movementId]?.activity_applicability?.includes(activityId)) {
        fail("RECIPROCAL_COVERAGE", `${activityId}->${movementId}`);
      }
    }
  }

  const summary = {
    activity_count: activityIds.length,
    movement_count: movementIds.length,
    activity_to_movement_permissions: activityToMovement,
    movement_to_activity_permissions: movementToActivity
  };
  if (summary.activity_count !== 3 || summary.movement_count !== 54 || activityToMovement !== 162 || movementToActivity !== 162) {
    fail("SUMMARY_COUNTS", JSON.stringify(summary));
  }
  return { ok: errors.length === 0, errors, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = auditRegFull02(process.cwd());
  if (!result.ok) {
    console.error(`${TOKEN}: FAIL`);
    for (const e of result.errors) console.error(`${e.code}: ${typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)}`);
    process.exit(1);
  }
  console.log(`${TOKEN}: PASS activities=3 movements=54 activity_to_movement=162 movement_to_activity=162`);
}
