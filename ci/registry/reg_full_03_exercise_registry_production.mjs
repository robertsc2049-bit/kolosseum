import fs from "node:fs";
import path from "node:path";

export const TOKEN = "CI_REG_FULL_03_EXERCISE_REGISTRY_PRODUCTION";
export const EXPECTED_EXERCISE_COUNT = 221;
export const EXPECTED_TOKEN_COUNT = 4;
export const EXPECTED_APPLICABILITY_COUNT = 1803;
export const REQUIRED_CONTEXTS = Object.freeze(["training", "testing", "competition"]);
export const REQUIRED_ACTIVITIES = Object.freeze(["powerlifting", "general_strength", "rugby_union", "strongman"]);
export const EXPECTED_ACTIVITY_COUNTS = Object.freeze({ powerlifting: 165, general_strength: 215, rugby_union: 215, strongman: 6 });
export const EXPECTED_ACTIVITY_PATTERN_COUNTS = Object.freeze({ powerlifting: 41, general_strength: 54, rugby_union: 54, strongman: 3 });

export const REQUIRED_CANONICAL_FIELDS = Object.freeze([
  "exercise_id", "display_label", "movement_pattern_id", "primary_activity_applicability",
  "secondary_activity_applicability", "equipment_requirements", "equipment_alternatives",
  "difficulty_tier", "joint_stress_tags", "stimulus_intent", "instruction_short_text",
  "instruction_detail_text", "contraindication_or_exclusion_tags", "substitution_eligibility",
  "template_eligibility", "copy_legal_boundary_flags"
]);

export const REQUIRED_RUNTIME_FIELDS = Object.freeze([
  "rom", "stability", "equipment_tier", "tempo_capability", "coaching_cues",
  "common_faults", "fast_execution"
]);

export const LEGACY_REQUIRED_IDS = Object.freeze([
  "bench_press", "incline_bench_press", "dumbbell_bench_press", "push_up", "machine_chest_press",
  "single_arm_dumbbell_press", "overhead_press", "dumbbell_overhead_press", "single_arm_overhead_press",
  "back_squat", "goblet_squat", "split_squat", "deadlift", "kettlebell_deadlift", "single_leg_rdl",
  "pike_push_up", "box_squat", "pin_press", "partial_deadlift"
]);

export const POWERLIFTING_REQUIRED_IDS = Object.freeze([
  "back_squat", "bench_press", "deadlift", "high_bar_back_squat", "low_bar_back_squat",
  "paused_back_squat", "tempo_back_squat", "box_squat", "pin_squat", "front_squat",
  "paused_bench_press", "tempo_bench_press", "close_grip_bench_press", "spoto_press", "pin_press", "floor_press",
  "sumo_deadlift", "paused_deadlift", "tempo_deadlift", "deficit_deadlift", "block_pull", "rack_pull",
  "romanian_deadlift", "good_morning", "barbell_row", "pull_up", "cable_triceps_pressdown", "front_plank"
]);

export const GENERAL_STRENGTH_REQUIRED_IDS = Object.freeze([
  "goblet_squat", "bulgarian_split_squat", "reverse_lunge", "step_up", "trap_bar_deadlift",
  "dumbbell_bench_press", "overhead_press", "single_arm_overhead_press", "barbell_row", "lat_pulldown",
  "farmers_carry", "suitcase_carry", "front_plank", "pallof_press", "side_plank", "contralateral_single_leg_rdl"
]);

export const RUGBY_REQUIRED_IDS = Object.freeze([
  "back_squat", "trap_bar_deadlift", "bulgarian_split_squat", "farmers_carry", "bear_crawl",
  "ten_metre_acceleration", "twenty_metre_acceleration", "sled_sprint", "flying_twenty_sprint",
  "upright_max_velocity_sprint", "sprint_to_stick", "drop_to_stick", "five_ten_five_shuttle",
  "forty_five_degree_cut", "ninety_degree_cut", "countermovement_jump", "vertical_jump_to_stick",
  "standing_broad_jump", "broad_jump_to_stick", "medicine_ball_chest_pass", "rotational_medicine_ball_throw",
  "overhead_medicine_ball_slam", "bike_ergometer", "rowing_ergometer", "sled_push", "backward_sled_drag"
]);

const COMPETITION_LIFTS = new Set(["back_squat", "bench_press", "deadlift"]);
const TESTABLE_MOVEMENTS = new Set([
  "squat", "hinge", "single_leg_squat", "single_leg_hinge", "horizontal_push", "incline_push", "decline_push",
  "vertical_push", "angled_push", "horizontal_pull", "vertical_pull", "carry_bilateral", "carry_unilateral",
  "core_anti_extension", "core_anti_rotation", "core_anti_lateral_flexion", "locomotion_walk", "locomotion_run",
  "jump_vertical", "jump_horizontal", "sprint_acceleration", "sprint_max_velocity", "deceleration",
  "change_of_direction", "throw_slam", "conditioning_cyclical", "conditioning_row", "conditioning_sled"
]);
const FALLBACK_MARKERS = ["fallback", "default", "generic_fallback", "catch_all", "unknown", "misc", "other"];

function readJson(root, rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function push(errors, code, detail) { errors.push({ code, detail }); }
function own(o, k) { return Object.prototype.hasOwnProperty.call(Object(o), k); }
function entries(doc) { return doc?.entries && typeof doc.entries === "object" && !Array.isArray(doc.entries) ? doc.entries : {}; }
function activityIds(e) { return [e.primary_activity_applicability, ...(Array.isArray(e.secondary_activity_applicability) ? e.secondary_activity_applicability : [])]; }

export function auditRegFull03Documents({ exercise, movement, equipment, activity, token, applicability }) {
  const errors = [];
  const ex = entries(exercise); const mv = entries(movement); const eq = entries(equipment); const ac = entries(activity);
  const tk = entries(token); const ap = entries(applicability);
  const exerciseIds = Object.keys(ex);

  if (exercise?.registry_id !== "exercise") push(errors, "REGISTRY_ID", exercise?.registry_id);
  if (exerciseIds.length !== EXPECTED_EXERCISE_COUNT) push(errors, "EXERCISE_COUNT", { expected: EXPECTED_EXERCISE_COUNT, actual: exerciseIds.length });
  if (Object.keys(mv).length !== 54) push(errors, "MOVEMENT_UNIVERSE", { expected: 54, actual: Object.keys(mv).length });
  if (Object.keys(tk).length !== EXPECTED_TOKEN_COUNT) push(errors, "TOKEN_COUNT", { expected: EXPECTED_TOKEN_COUNT, actual: Object.keys(tk).length });
  if (Object.keys(ap).length !== EXPECTED_APPLICABILITY_COUNT) push(errors, "APPLICABILITY_COUNT", { expected: EXPECTED_APPLICABILITY_COUNT, actual: Object.keys(ap).length });

  for (const id of [...LEGACY_REQUIRED_IDS, ...POWERLIFTING_REQUIRED_IDS, ...GENERAL_STRENGTH_REQUIRED_IDS, ...RUGBY_REQUIRED_IDS]) {
    if (!ex[id]) push(errors, "REQUIRED_EXERCISE_MISSING", id);
  }

  const movementCoverage = new Map(Object.keys(mv).map(id => [id, 0]));
  const activityCounts = Object.fromEntries(REQUIRED_ACTIVITIES.map(a => [a, 0]));
  const activityPatterns = Object.fromEntries(REQUIRED_ACTIVITIES.map(a => [a, new Set()]));
  const requiredApplicability = new Set();

  for (const [key, e] of Object.entries(ex)) {
    if (!e || typeof e !== "object" || Array.isArray(e)) { push(errors, "EXERCISE_RECORD", key); continue; }
    if (e.exercise_id !== key) push(errors, "EXERCISE_PRIMARY_KEY", { key, exercise_id: e.exercise_id });
    for (const field of [...REQUIRED_CANONICAL_FIELDS, ...REQUIRED_RUNTIME_FIELDS]) if (!own(e, field)) push(errors, "CANONICAL_FIELD", { exercise_id: key, field });
    if (typeof e.display_label !== "string" || e.display_label.trim().length < 3) push(errors, "DISPLAY_LABEL", key);
    if (typeof e.instruction_short_text !== "string" || e.instruction_short_text.length < 30) push(errors, "INSTRUCTION_QUALITY", { exercise_id: key, field: "instruction_short_text" });
    for (const field of ["instruction_detail_text", "coaching_cues", "common_faults"]) {
      if (!Array.isArray(e[field]) || e[field].length < 3 || e[field].some(v => typeof v !== "string" || v.trim().length < 8)) push(errors, "INSTRUCTION_QUALITY", { exercise_id: key, field });
    }
    for (const field of ["contraindication_or_exclusion_tags", "copy_legal_boundary_flags", "equipment_requirements", "equipment_alternatives", "joint_stress_tags", "secondary_activity_applicability"]) {
      if (!Array.isArray(e[field])) push(errors, "CANONICAL_FIELD", { exercise_id: key, field });
    }
    if (!Array.isArray(e.equipment_requirements) || e.equipment_requirements.length < 1) push(errors, "EQUIPMENT_REQUIRED", key);
    if (!Array.isArray(e.joint_stress_tags) || e.joint_stress_tags.length < 1) push(errors, "JOINT_TAG_REQUIRED", key);
    if (!mv[e.movement_pattern_id]) push(errors, "MOVEMENT_FK", { exercise_id: key, movement_pattern_id: e.movement_pattern_id });
    else movementCoverage.set(e.movement_pattern_id, (movementCoverage.get(e.movement_pattern_id) ?? 0) + 1);
    const movementEquipment = new Set(mv[e.movement_pattern_id]?.equipment_vocab ?? []);
    const movementJoints = new Set(mv[e.movement_pattern_id]?.joint_stress_tags_vocab ?? []);
    for (const field of ["equipment_requirements", "equipment_alternatives"]) for (const equipmentId of e[field] ?? []) {
      if (!eq[equipmentId]) push(errors, "EQUIPMENT_FK", { exercise_id: key, field, equipment_id: equipmentId });
      if (!movementEquipment.has(equipmentId)) push(errors, "EQUIPMENT_SCOPED_FK", { exercise_id: key, movement_pattern_id: e.movement_pattern_id, equipment_id: equipmentId });
    }
    for (const tag of e.joint_stress_tags ?? []) if (!movementJoints.has(tag)) push(errors, "JOINT_SCOPED_VOCAB", { exercise_id: key, movement_pattern_id: e.movement_pattern_id, tag });
    if (e.stimulus_intent !== "strength") push(errors, "STIMULUS_INTENT", { exercise_id: key, actual: e.stimulus_intent });
    if (!["eligible", "restricted"].includes(e.substitution_eligibility)) push(errors, "SUBSTITUTION_METADATA", { exercise_id: key, actual: e.substitution_eligibility });
    if (e.template_eligibility !== "eligible") push(errors, "TEMPLATE_METADATA", { exercise_id: key, actual: e.template_eligibility });
    const lowerValues = [key, e.display_label, e.movement_pattern_id].map(v => String(v).toLowerCase());
    for (const marker of FALLBACK_MARKERS) if (lowerValues.some(v => v === marker || v.includes(`_${marker}`) || v.includes(`${marker}_`))) push(errors, "FALLBACK_RECORD", { exercise_id: key, marker });

    const acts = activityIds(e);
    if (!REQUIRED_ACTIVITIES.includes(e.primary_activity_applicability)) push(errors, "ACTIVITY_FK", { exercise_id: key, activity_id: e.primary_activity_applicability });
    if (new Set(acts).size !== acts.length) push(errors, "ACTIVITY_DUPLICATE", key);
    for (const a of acts) {
      if (!ac[a]) push(errors, "ACTIVITY_FK", { exercise_id: key, activity_id: a });
      if (!(mv[e.movement_pattern_id]?.activity_applicability ?? []).includes(a)) push(errors, "MOVEMENT_ACTIVITY_COMPATIBILITY", { exercise_id: key, activity_id: a, movement_pattern_id: e.movement_pattern_id });
      if (activityCounts[a] !== undefined) { activityCounts[a]++; activityPatterns[a].add(e.movement_pattern_id); }
      for (const ctx of REQUIRED_CONTEXTS) requiredApplicability.add(`${key}__${a}__${ctx}`);
    }

    // Exercise tokens are a separate controlled naming vocabulary, not a one-token-per-exercise projection.
    // REG-FULL-03 closes the historical front_plank omission while preserving the three S-REG-31 tokens.
  }

  const requiredTokens = {
    back_squat_token: { exercise_id: "back_squat", movement_pattern_id: "squat" },
    deadlift_token: { exercise_id: "deadlift", movement_pattern_id: "hinge" },
    bench_press_token: { exercise_id: "bench_press", movement_pattern_id: "horizontal_push" },
    front_plank_token: { exercise_id: "front_plank", movement_pattern_id: "core_anti_extension" }
  };
  for (const [tokenId, expected] of Object.entries(requiredTokens)) {
    const t = tk[tokenId]; const e = ex[expected.exercise_id];
    if (!t || t.exercise_token_id !== tokenId || t.movement_pattern_id !== expected.movement_pattern_id) push(errors, "TOKEN_CLOSURE", { token_id: tokenId });
    if (t && e) {
      const expectedActivities = activityIds(e);
      if (JSON.stringify([...(t.activity_ids ?? [])].sort()) !== JSON.stringify([...expectedActivities].sort())) push(errors, "TOKEN_ACTIVITY_CLOSURE", { token_id: tokenId });
    }
  }

  for (const [movementId, count] of movementCoverage) if (count < 1) push(errors, "MOVEMENT_COVERAGE", movementId);
  for (const a of REQUIRED_ACTIVITIES) {
    if (activityCounts[a] !== EXPECTED_ACTIVITY_COUNTS[a]) push(errors, "ACTIVITY_EXERCISE_COUNT", { activity_id: a, expected: EXPECTED_ACTIVITY_COUNTS[a], actual: activityCounts[a] });
    if (activityPatterns[a].size !== EXPECTED_ACTIVITY_PATTERN_COUNTS[a]) push(errors, "ACTIVITY_MOVEMENT_COVERAGE", { activity_id: a, expected: EXPECTED_ACTIVITY_PATTERN_COUNTS[a], actual: activityPatterns[a].size });
  }

  const seenAppKeys = new Set();
  for (const [key, a] of Object.entries(ap)) {
    if (a.applicability_id !== key) push(errors, "APPLICABILITY_PRIMARY_KEY", { key, applicability_id: a.applicability_id });
    const expectedKey = `${a.exercise_id}__${a.activity_id}__${a.activity_context}`;
    if (expectedKey !== key) push(errors, "APPLICABILITY_KEY", { key, expected: expectedKey });
    if (seenAppKeys.has(expectedKey)) push(errors, "APPLICABILITY_DUPLICATE", expectedKey); else seenAppKeys.add(expectedKey);
    const e = ex[a.exercise_id];
    if (!e) push(errors, "APPLICABILITY_EXERCISE_FK", { key, exercise_id: a.exercise_id });
    else if (!activityIds(e).includes(a.activity_id)) push(errors, "APPLICABILITY_UNDECLARED_ACTIVITY", { key, activity_id: a.activity_id });
    if (!REQUIRED_CONTEXTS.includes(a.activity_context)) push(errors, "APPLICABILITY_CONTEXT", { key, context: a.activity_context });
    const shouldAllow = a.activity_context === "training" || (a.activity_context === "testing" && TESTABLE_MOVEMENTS.has(e?.movement_pattern_id)) || (a.activity_context === "competition" && a.activity_id === "powerlifting" && COMPETITION_LIFTS.has(a.exercise_id));
    const expectedState = shouldAllow ? "allowed" : "prohibited";
    if (a.applicability_state !== expectedState) push(errors, "APPLICABILITY_STATE", { key, expected: expectedState, actual: a.applicability_state });
    if (!Array.isArray(a.conditions) || a.conditions.length !== 0 || a.tier_cap !== null) push(errors, "APPLICABILITY_CONDITIONS", key);
    const expectedTemplate = shouldAllow ? "eligible" : "not_eligible";
    if (a.template_applicability !== expectedTemplate) push(errors, "APPLICABILITY_TEMPLATE", { key, expected: expectedTemplate, actual: a.template_applicability });
    const expectedSub = shouldAllow && e?.substitution_eligibility === "eligible" ? "eligible" : "not_eligible";
    if (a.substitution_applicability !== expectedSub) push(errors, "APPLICABILITY_SUBSTITUTION", { key, expected: expectedSub, actual: a.substitution_applicability });
  }
  for (const key of requiredApplicability) if (!ap[key]) push(errors, "APPLICABILITY_CLOSURE", key);
  for (const key of Object.keys(ap)) if (!requiredApplicability.has(key)) push(errors, "APPLICABILITY_EXTRA", key);

  return { ok: errors.length === 0, errors, counts: { exercises: exerciseIds.length, tokens: Object.keys(tk).length, applicability: Object.keys(ap).length, movement_patterns: [...movementCoverage.values()].filter(n => n > 0).length, activity_exercises: activityCounts, activity_patterns: Object.fromEntries(REQUIRED_ACTIVITIES.map(a => [a, activityPatterns[a].size])) } };
}

export function loadRegFull03Documents(root = process.cwd()) {
  return {
    exercise: readJson(root, "registries/exercise/exercise.registry.json"),
    movement: readJson(root, "registries/movement/movement.registry.json"),
    equipment: readJson(root, "registries/equipment/equipment.registry.json"),
    activity: readJson(root, "registries/activity/activity.registry.json"),
    token: readJson(root, "registries/exercise_token/exercise_token.registry.json"),
    applicability: readJson(root, "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json")
  };
}

export function auditRegFull03(root = process.cwd()) { return auditRegFull03Documents(loadRegFull03Documents(root)); }
export { clone };

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("reg_full_03_exercise_registry_production.mjs")) {
  const result = auditRegFull03(process.cwd());
  if (!result.ok) {
    console.error(`${TOKEN}: FAIL`);
    for (const e of result.errors) console.error(`${e.code}: ${typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)}`);
    process.exit(1);
  }
  const c = result.counts;
  console.log(`${TOKEN}: PASS exercises=${c.exercises} movements=${c.movement_patterns} tokens=${c.tokens} applicability=${c.applicability} powerlifting=${c.activity_exercises.powerlifting} general_strength=${c.activity_exercises.general_strength} rugby_union=${c.activity_exercises.rugby_union} strongman=${c.activity_exercises.strongman}`);
}
