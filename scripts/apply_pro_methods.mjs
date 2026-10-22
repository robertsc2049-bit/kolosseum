// DEV NOTE: Repository automation script. A pro's programme is not the
// amateur's with more sets: this rewrites every pro level variant in the
// program registry (the sport's session and week, its competition events and
// its position groups) with the advanced methods an elite coach uses, each
// for a reason:
// - reactive plyometrics: landing competence is assumed by pro level, so
//   stick-the-landing and countermovement drills become rebound work (depth
//   jumps, hurdle hops, repeated broad jumps, lateral bounds);
// - contrast pairs: the day's heavy lower-body lift (squat/hinge at 70%+) then
//   its jump 30 s later, as one superset rested fully after the pair, to use
//   the post-activation potentiation;
// - heavier primaries: a rep fewer on % work (strength, not more volume);
// - each strength sport's own advanced variations (pin squats and deficit
//   pulls; the full clean, snatch pulls and the split jerk; muscle-ups and
//   archer pull-ups; Hercules holds and rope climbs; pistols in CrossFit).
// It edits the registry's current pro variants in place (they carry later
// hand-fixes the level generator doesn't reproduce) and records each pro
// variant it has done in scripts/apply_pro_methods.done.json, so a second run
// changes nothing and a newly added one (a new position group) is done next
// time. Run from repo root.
import fs from "node:fs";

const R = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const FILE = "registries/program/program.registry.json";
const prog = R(FILE);
const ex = R("registries/exercise/exercise.registry.json").entries;
const ap = R("registries/exercise_activity_applicability/exercise_activity_applicability.registry.json").entries;
const allowed = (exercise, activity) => ap[`${exercise}__${activity}__training`]?.applicability_state === "allowed";
const DONE_FILE = "scripts/apply_pro_methods.done.json";
const doneKeys = new Set(fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE, "utf8")) : []);

const STRENGTH = new Set(["powerlifting", "olympic_weightlifting", "strongman", "street_lifting"]);
// Endurance athletes keep their minimum-effective-dose volume: the pro
// version changes what the sets are, never how many.
const ENDURANCE = new Set(["athletics", "swimming", "cycling", "rowing", "kayaking", "triathlon"]);
const PRO_SWAPS = {
  countermovement_jump: "depth_jump", box_jump: "depth_jump", broad_jump_to_stick: "repeated_broad_jump",
  drop_to_stick: "hurdle_hop", pogo_jump: "hurdle_hop", lateral_lunge: "lateral_bound"
};
const PRO_SWAPS_BY_ACTIVITY = {
  powerlifting: { paused_back_squat: "pin_squat", romanian_deadlift: "deficit_deadlift" },
  olympic_weightlifting: { power_clean: "clean", snatch_grip_deadlift: "snatch_pull", push_jerk: "split_jerk" },
  strongman: { romanian_deadlift: "deficit_deadlift" },
  street_lifting: { dumbbell_curl: "muscle_up", single_arm_dumbbell_row: "archer_pull_up" },
  grip_sport: { hammer_curl: "hercules_hold", barbell_row: "rope_climb" },
  crossfit: { power_clean: "clean", air_squat: "pistol_squat" },
  // General strength pros train the barbell and bodyweight versions.
  general_strength: { goblet_squat: "back_squat", dumbbell_bench_press: "bench_press", lat_pulldown: "pull_up", split_squat: "bulgarian_split_squat" },
  rugby_sevens: { sprint_to_stick: "hurdle_hop", split_squat: "bulgarian_split_squat" },
  rowing: { split_squat: "bulgarian_split_squat" },
  kayaking: { dumbbell_bench_press: "bench_press" },
  // HYROX pros train the race implement, not a stand-in.
  hyrox: { walking_lunge: "sandbag_lunge" }
};
// Position groups with no jump to make reactive get their own pro step up.
const PRO_SWAPS_BY_ROLE = {
  "athletics/throws": { bulgarian_split_squat: "pin_squat", chest_supported_row: "pendlay_row" },
  "swimming/distance": { split_squat: "bulgarian_split_squat", chin_up: "pull_up" },
  "rowing/sweep": { cable_woodchop: "medicine_ball_rotational_throw" },
  "triathlon/long_course": { split_squat: "bulgarian_split_squat", chin_up: "pull_up" }
};
// The competition movements stay named (fixed), as the level generator does.
const FIXED_AFTER_SWAP = new Set(["clean", "split_jerk", "muscle_up"]);
// Swapped-in reactive work: low, high-quality contacts.
const REACTIVE_DOSE = { depth_jump: [4, 3], hurdle_hop: [4, 5], repeated_broad_jump: [4, 3], lateral_bound: [4, 4] };
// Other swaps take their own dose, never the dose of what they replace (a
// curl's 5x10 is not a muscle-up's): [sets, reps or seconds, RPE, timed].
const SWAP_DOSE = {
  muscle_up: [4, 3, 8], archer_pull_up: [4, 5, 8], pull_up: [4, 8, 8],
  hercules_hold: [3, 30, 8, true], rope_climb: [4, 2, 8]
};
const LOWER_STRENGTH = new Set(["squat", "hinge", "single_leg_squat", "single_leg_hinge"]);

function swapItems(ids, items, activity, role = null) {
  const used = new Set(ids);
  const outIds = [];
  const outItems = [];
  ids.forEach((id, i) => {
    const p = items[i];
    const target = (role ? PRO_SWAPS_BY_ROLE[`${activity}/${role}`]?.[id] : undefined) ?? PRO_SWAPS_BY_ACTIVITY[activity]?.[id] ?? (STRENGTH.has(activity) || activity === "general_strength" ? undefined : PRO_SWAPS[id]);
    if (!target || used.has(target) || !allowed(target, activity) || !ex[target] || p.group) { outIds.push(id); outItems.push(p); return; }
    used.add(target);
    const q = structuredClone(p);
    const dose = REACTIVE_DOSE[target];
    if (dose) {
      q.sets = ENDURANCE.has(activity) ? p.sets : dose[0]; q.reps = dose[1]; q.intensity = { type: "bodyweight" };
      delete q.distance_m; delete q.duration_seconds;
      q.rest_seconds = Math.max(q.rest_seconds ?? 0, 90);
    }
    const own = SWAP_DOSE[target];
    if (own) {
      q.sets = ENDURANCE.has(activity) ? p.sets : own[0]; q.intensity = { type: "rpe", value: own[2] };
      delete q.distance_m; delete q.duration_seconds;
      if (own[3]) { q.reps = 1; q.duration_seconds = own[1]; } else q.reps = own[1];
      q.rest_seconds = Math.max(q.rest_seconds ?? 0, 120);
    }
    if (FIXED_AFTER_SWAP.has(target)) q.fixed = true;
    outIds.push(target);
    outItems.push(q);
  });
  return [outIds, outItems];
}

// A rep fewer on the % primaries (the first four, outside groups) - not for
// strength sports, whose pro sessions are hand-tuned already.
function heavier(ids, items, activity) {
  if (STRENGTH.has(activity)) return items;
  return items.map((p, i) => {
    if (i >= 4 || p.group || p.intensity?.type !== "percent_1rm" || p.distance_m || p.duration_seconds) return p;
    return { ...p, reps: Math.max(2, p.reps - 1) };
  });
}

function contrast(ids, items, dayId, activity) {
  if (STRENGTH.has(activity) || ["crossfit", "hyrox", "grip_sport"].includes(activity)) return [ids, items];
  const lift = ids.findIndex((id, i) => LOWER_STRENGTH.has(ex[id]?.movement_pattern_id) && items[i].intensity?.type === "percent_1rm" && items[i].intensity.value >= 70 && !items[i].group);
  const jump = ids.findIndex((id, i) => /^jump_/u.test(ex[id]?.movement_pattern_id ?? "") && !items[i].group && !items[i].distance_m && !items[i].duration_seconds);
  if (lift < 0 || jump < 0) return [ids, items];
  const outIds = ids.slice();
  const outItems = items.slice();
  const [jumpId] = outIds.splice(jump, 1);
  const [jumpItem] = outItems.splice(jump, 1);
  const at = outIds.indexOf(ids[lift]);
  const group = { group_id: `contrast_${dayId}`, group_type: "superset", time_cap_seconds: 0 };
  const heavy = { ...structuredClone(outItems[at]), group, rest_seconds: 30 };
  const pop = { ...structuredClone(jumpItem), group, sets: ENDURANCE.has(activity) ? jumpItem.sets : heavy.sets, reps: Math.min(jumpItem.reps, 3), rest_seconds: Math.max(outItems[at].rest_seconds ?? 0, 180) };
  outItems[at] = heavy;
  outIds.splice(at + 1, 0, jumpId);
  outItems.splice(at + 1, 0, pop);
  return [outIds, outItems];
}

function upgrade(target, activity, dayId, role = null) {
  if (!target?.exercise_eligibility || !target.item_prescriptions) return;
  let [ids, items] = swapItems(target.exercise_eligibility, target.item_prescriptions, activity, role);
  items = heavier(ids, items, activity);
  if (dayId) [ids, items] = contrast(ids, items, dayId, activity);
  if (new Set(ids).size !== ids.length) throw new Error(`${activity}/${dayId ?? "session"}: duplicate exercise after pro methods`);
  target.exercise_eligibility = ids;
  target.item_prescriptions = items;
}

let done = 0;
function upgradeVariant(pro, activity, key, role = null) {
  if (!pro || doneKeys.has(key)) return;
  upgrade(pro, activity, null, role);
  for (const day of pro.microcycle ?? []) upgrade(day, activity, day.day_id, role);
  doneKeys.add(key);
  done += 1;
}

for (const entry of prog.entries) {
  const activity = entry.activity_id;
  upgradeVariant(entry.level_variants?.pro, activity, activity);
  for (const [name, event] of Object.entries(entry.event_variants ?? {})) upgradeVariant(event.level_variants?.pro, activity, `${activity}/event:${name}`);
  for (const [name, variant] of Object.entries(entry.role_variants ?? {})) upgradeVariant(variant.level_variants?.pro, activity, `${activity}/role:${name}`, name);
}
fs.writeFileSync(FILE, JSON.stringify(prog, null, 2) + "\n");
fs.writeFileSync(DONE_FILE, JSON.stringify([...doneKeys].sort(), null, 1) + "\n");
console.log("pro methods applied to", done, "pro variants");
