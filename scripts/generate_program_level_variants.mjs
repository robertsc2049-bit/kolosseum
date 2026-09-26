// DEV NOTE: Repository automation script. Generates beginner/pro level_variants for every program registry entry (run from repo root; REPORT=<path> optional).
// The base entry is the amateur session. Strength sports are hand-tuned; the
// other activities use explicit coaching rules (documented below). Run from repo root.
import fs from "node:fs";
import { EVENT_MICROCYCLES, MICROCYCLES } from "./program_microcycles.mjs";

const R = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const prog = R("registries/program/program.registry.json");
const ex = R("registries/exercise/exercise.registry.json").entries;
const ap = R("registries/exercise_activity_applicability/exercise_activity_applicability.registry.json").entries;
const sub = Object.values(R("registries/substitution/substitution.registry.json").entries);

const allowed = (exercise, activity) => ap[`${exercise}__${activity}__training`]?.applicability_state === "allowed";
const TIER = { beginner: 0, intermediate: 1, advanced: 2 };
const pct = (value) => ({ type: "percent_1rm", value });
const rpe = (value) => ({ type: "rpe", value });
const bw = { type: "bodyweight" };
const P = (sets, reps, intensity, rest_seconds) => ({ sets, reps, intensity, rest_seconds });
// Distance-prescribed work (carries, sleds): one rep is one length of distance_m.
const D = (sets, distance_m, intensity, rest_seconds) => ({ ...P(sets, 1, intensity, rest_seconds), distance_m });
// Reactive plyometrics need landing competence first (skill: athlete-levels, beginner).
const REACTIVE = new Set(["pogo_jump", "depth_jump", "repeated_broad_jump", "lateral_bound", "box_jump"]);
const REACTIVE_REGRESSION = "drop_to_stick";
// Beginner swaps a coach would make regardless of the tier label, each with the
// dose that suits the regression (isolation and assisted work need more reps).
const BEGINNER_SWAPS = {
  nordic_curl: ["band_leg_curl", P(2, 12, rpe(7), 60)],
  chin_up: ["band_assisted_pull_up", null],
  pull_up: ["band_assisted_pull_up", null],
  // Every max-velocity sprint is an advanced drill; beginners build speed with
  // accelerations first (lower hamstring risk, easier to coach alone).
  flying_twenty_sprint: ["twenty_metre_acceleration", D(3, 20, bw, 150)]
};
// Landing drills are low-rep quality work.
const LANDING_DOSE = P(3, 5, bw, 60);
// Olympic lifts are technique-limited: a beginner learns them in doubles and
// triples, never in fives or eights (fatigue breaks the technique first).
const OLYMPIC_LIFT = /^(snatch|power_snatch|hang_snatch|power_clean|hang_clean|hang_power_clean|clean|clean_and_jerk|push_jerk|split_jerk|jerk)$/;
const BEGINNER_OLYMPIC_MAX_REPS = 3;
const beginnerReps = (id, reps, floor) => OLYMPIC_LIFT.test(id) ? Math.min(reps, BEGINNER_OLYMPIC_MAX_REPS) : Math.max(reps, floor);

// Hand-tuned strength sports: level matters most here, and generic regressions
// would be wrong (a beginner powerlifter still learns the competition lifts).
const HAND = {
  powerlifting: {
    beginner: [["back_squat", P(3, 5, rpe(6), 150)], ["bench_press", P(3, 5, rpe(6), 150)], ["deadlift", P(2, 5, rpe(6), 180)],
      ["barbell_row", P(3, 8, rpe(7), 90)], ["romanian_deadlift", P(3, 8, rpe(6), 90)], ["cable_triceps_pressdown", P(3, 12, rpe(7), 60)]],
    pro: [["back_squat", P(5, 2, pct(85), 240)], ["paused_bench_press", P(5, 3, pct(80), 180)], ["deadlift", P(4, 2, pct(87), 300)],
      ["close_grip_bench_press", P(4, 5, pct(75), 120)], ["barbell_row", P(4, 8, rpe(8), 90)], ["cable_triceps_pressdown", P(3, 12, rpe(8), 60)]]
  },
  olympic_weightlifting: {
    beginner: [["snatch", P(5, 2, rpe(6), 120)], ["power_clean", P(4, 3, rpe(6), 120)], ["push_jerk", P(3, 3, rpe(6), 120)],
      ["front_squat", P(3, 5, rpe(7), 150)], ["snatch_grip_deadlift", P(3, 4, rpe(6), 120)]],
    pro: [["snatch", P(6, 2, pct(82), 180)], ["power_clean", P(5, 2, pct(82), 180)], ["push_jerk", P(5, 2, pct(82), 180)],
      ["front_squat", P(5, 3, pct(85), 210)], ["snatch_grip_deadlift", P(4, 3, pct(85), 180)]]
  },
  strongman: {
    beginner: [["strongman_log_press", P(4, 5, rpe(6), 150)], ["deadlift", P(3, 5, rpe(6), 150)], ["yoke_walk", D(3, 20, rpe(6), 150)],
      ["goblet_squat", P(3, 8, rpe(7), 90)], ["farmers_carry", D(3, 30, rpe(7), 120)], ["romanian_deadlift", P(3, 8, rpe(6), 90)]],
    pro: [["strongman_log_press", P(6, 2, pct(85), 210)], ["deadlift", P(5, 2, pct(87), 240)], ["yoke_walk", D(5, 20, rpe(9), 210)],
      ["zercher_squat", P(4, 4, pct(78), 180)], ["farmers_carry", D(4, 30, rpe(9), 180)], ["romanian_deadlift", P(3, 6, pct(70), 120)]]
  },
  street_lifting: {
    beginner: [["band_assisted_pull_up", P(4, 6, rpe(7), 120)], ["push_up", P(4, 8, rpe(7), 90)], ["goblet_squat", P(3, 8, rpe(7), 90)],
      ["single_arm_dumbbell_row", P(3, 10, rpe(7), 90)], ["face_pull", P(3, 15, rpe(7), 60)], ["dip", P(3, 5, rpe(6), 120)]],
    pro: [["pull_up", P(6, 2, rpe(9), 240)], ["dip", P(6, 2, rpe(9), 240)], ["back_squat", P(5, 3, pct(85), 210)],
      ["barbell_row", P(4, 6, rpe(8), 120)], ["face_pull", P(3, 15, rpe(7), 60)], ["close_grip_bench_press", P(4, 5, rpe(8), 120)]]
  }
};

// Powerlifting competition events (hand-tuned; full power is the base entry).
// Each event trains its competition lift(s) as the primaries - timebox pruning
// only drops accessories, so the event lifts always survive a short session.
// Bench only: paused bench + Spoto/close-grip, upper back and triceps, legs kept
//   as low-volume support. Deadlift only: competition pull + paused/deficit/
//   block variations, squat for leg drive, grip holds. Push-pull: bench and
//   deadlift, squat demoted to an accessory. Squat only: competition squat +
//   paused/pin variations, hinge and bench as support. Beginners learn the
//   event lift(s) by effort (no tested max) and keep some work on the others.
const T = (sets, duration_seconds, intensity, rest_seconds) => ({ ...P(sets, 1, intensity, rest_seconds), duration_seconds });
const EVENTS = {
  powerlifting: {
    bench_only: {
      beginner: [["bench_press", P(4, 5, rpe(6), 150)], ["dumbbell_bench_press", P(3, 8, rpe(7), 90)], ["barbell_row", P(3, 8, rpe(7), 90)],
        ["goblet_squat", P(3, 8, rpe(7), 90)], ["cable_triceps_pressdown", P(3, 12, rpe(7), 60)], ["face_pull", P(3, 15, rpe(7), 60)]],
      amateur: [["paused_bench_press", P(5, 3, pct(80), 180)], ["spoto_press", P(4, 5, pct(70), 150)], ["close_grip_bench_press", P(3, 6, pct(72), 120)],
        ["barbell_row", P(4, 8, rpe(8), 90)], ["back_squat", P(3, 5, rpe(6), 150)], ["overhead_cable_triceps_extension", P(3, 12, rpe(8), 60)], ["face_pull", P(3, 15, rpe(7), 60)]],
      pro: [["paused_bench_press", P(6, 2, pct(85), 210)], ["spoto_press", P(4, 4, pct(75), 180)], ["close_grip_bench_press", P(4, 5, pct(75), 150)],
        ["pendlay_row", P(4, 6, rpe(8), 120)], ["pin_press", P(3, 3, rpe(8), 150)], ["back_squat", P(2, 5, rpe(6), 150)],
        ["overhead_cable_triceps_extension", P(3, 12, rpe(8), 60)], ["face_pull", P(3, 15, rpe(7), 60)]]
    },
    deadlift_only: {
      beginner: [["deadlift", P(3, 5, rpe(6), 180)], ["goblet_squat", P(3, 8, rpe(7), 90)], ["romanian_deadlift", P(3, 8, rpe(6), 90)],
        ["barbell_row", P(3, 8, rpe(7), 90)], ["dumbbell_bench_press", P(3, 8, rpe(7), 90)], ["dumbbell_static_hold", T(3, 20, rpe(7), 60)], ["back_extension", P(3, 12, rpe(7), 60)]],
      amateur: [["deadlift", P(4, 3, pct(82), 240)], ["paused_deadlift", P(3, 3, pct(70), 180)], ["back_squat", P(3, 5, pct(72), 150)],
        ["barbell_row", P(4, 8, rpe(8), 90)], ["romanian_deadlift", P(3, 8, rpe(7), 90)], ["barbell_static_hold", T(3, 20, rpe(8), 90)], ["back_extension", P(3, 12, rpe(7), 60)]],
      pro: [["deadlift", P(5, 2, pct(87), 300)], ["deficit_deadlift", P(4, 3, pct(75), 210)], ["block_pull", P(3, 3, rpe(8), 210)],
        ["back_squat", P(3, 5, pct(75), 180)], ["pendlay_row", P(4, 6, rpe(8), 120)], ["barbell_static_hold", T(3, 20, rpe(9), 90)], ["reverse_hyper", P(3, 12, rpe(7), 60)]]
    },
    push_pull: {
      beginner: [["bench_press", P(3, 5, rpe(6), 150)], ["deadlift", P(3, 5, rpe(6), 180)], ["barbell_row", P(3, 8, rpe(7), 90)],
        ["goblet_squat", P(3, 8, rpe(7), 90)], ["dumbbell_bench_press", P(3, 10, rpe(7), 90)], ["cable_triceps_pressdown", P(3, 12, rpe(7), 60)]],
      amateur: [["paused_bench_press", P(5, 3, pct(77), 180)], ["deadlift", P(4, 3, pct(82), 240)], ["close_grip_bench_press", P(3, 6, pct(70), 120)],
        ["barbell_row", P(3, 8, rpe(8), 90)], ["back_squat", P(3, 5, pct(70), 150)], ["cable_triceps_pressdown", P(3, 12, rpe(8), 60)]],
      pro: [["paused_bench_press", P(6, 2, pct(85), 210)], ["deadlift", P(5, 2, pct(87), 300)], ["close_grip_bench_press", P(4, 5, pct(75), 150)],
        ["deficit_deadlift", P(3, 3, pct(75), 210)], ["pendlay_row", P(4, 6, rpe(8), 120)], ["back_squat", P(3, 4, pct(75), 180)], ["cable_triceps_pressdown", P(3, 12, rpe(8), 60)]]
    },
    squat_only: {
      beginner: [["back_squat", P(3, 5, rpe(6), 150)], ["goblet_squat", P(3, 8, rpe(7), 90)], ["romanian_deadlift", P(3, 8, rpe(6), 90)],
        ["barbell_row", P(3, 8, rpe(7), 90)], ["dumbbell_bench_press", P(3, 8, rpe(7), 90)], ["front_plank", T(3, 30, rpe(6), 60)]],
      amateur: [["back_squat", P(5, 3, pct(80), 210)], ["paused_back_squat", P(3, 4, pct(70), 180)], ["romanian_deadlift", P(3, 8, rpe(7), 120)],
        ["barbell_row", P(3, 8, rpe(8), 90)], ["bulgarian_split_squat", P(3, 8, rpe(8), 90)], ["bench_press", P(3, 6, rpe(7), 120)], ["cable_crunch", P(3, 12, rpe(8), 60)]],
      pro: [["back_squat", P(6, 2, pct(85), 240)], ["pin_squat", P(4, 3, pct(75), 180)], ["paused_back_squat", P(3, 3, pct(75), 180)],
        ["romanian_deadlift", P(3, 6, pct(70), 120)], ["barbell_row", P(4, 8, rpe(8), 90)], ["bulgarian_split_squat", P(3, 8, rpe(8), 90)], ["bench_press", P(3, 5, rpe(7), 120)]]
    }
  }
};

// Beginner regression for an advanced exercise: a substitution edge that keeps
// the movement pattern exactly, applies to this activity, is training-allowed
// for it, and lands on a lower difficulty tier. Deterministic: lowest tier, then id.
function regress(exercise, activity, used) {
  if (REACTIVE.has(exercise) && allowed(REACTIVE_REGRESSION, activity) && !used.has(REACTIVE_REGRESSION)) return REACTIVE_REGRESSION;
  if (ex[exercise]?.difficulty_tier !== "advanced") return exercise;
  const cands = sub
    .filter((e) => e.source_exercise_id === exercise && e.movement_pattern_preservation === "exact"
      && (e.activity_applicability ?? []).includes(activity) && allowed(e.target_exercise_id, activity)
      && TIER[ex[e.target_exercise_id]?.difficulty_tier] < TIER.advanced && !used.has(e.target_exercise_id))
    .map((e) => e.target_exercise_id)
    .sort((a, b) => TIER[ex[a].difficulty_tier] - TIER[ex[b].difficulty_tier] || a.localeCompare(b));
  return cands[0] ?? exercise;
}

// Rules (non-strength sports):
// beginner - regress advanced/reactive exercises (above); % 1RM becomes RPE 6
//   (no tested 1RM early on); RPE capped at 7; one fewer set (min 2) outside
//   timed groups; reps on low-rep loaded work raised to 6-8 for technique.
// pro - primaries only: +1 set (max 6; endurance keeps volume), % 1RM +5 (max 90), RPE +1 (max 8);
//   accessories and timed groups unchanged; same exercises.
function beginnerOf(entry) {
  const used = new Set();
  const out = [];
  entry.exercise_eligibility.forEach((id, i) => {
    const p = entry.item_prescriptions[i];
    const swap = BEGINNER_SWAPS[id];
    if (swap && allowed(swap[0], entry.activity_id) && !used.has(swap[0])) {
      used.add(swap[0]);
      out.push([swap[0], swap[1] ?? { ...JSON.parse(JSON.stringify(p)), intensity: rpe(7) }]);
      return;
    }
    const target = regress(id, entry.activity_id, used);
    used.add(target);
    if (target === REACTIVE_REGRESSION && id !== REACTIVE_REGRESSION) { out.push([target, LANDING_DOSE]); return; }
    const q = JSON.parse(JSON.stringify(p));
    if (!q.group) q.sets = Math.max(2, q.sets - 1);
    if (q.intensity.type === "percent_1rm") {
      q.intensity = rpe(6);
      q.reps = q.reps < 6 ? beginnerReps(target, q.reps, 8) : beginnerReps(target, q.reps, q.reps);
    } else if (q.intensity.type === "rpe" && q.intensity.value > 7) {
      q.intensity = rpe(7);
    }
    if (OLYMPIC_LIFT.test(target)) q.reps = Math.min(q.reps, BEGINNER_OLYMPIC_MAX_REPS);
    out.push([target, q]);
  });
  return out;
}

// Endurance athletes already carry huge sport volume, so pro raises intensity only.
const ENDURANCE = new Set(["athletics", "swimming", "cycling", "rowing", "kayaking", "triathlon"]);

function proOf(entry) {
  return entry.exercise_eligibility.map((id, i) => {
    const q = JSON.parse(JSON.stringify(entry.item_prescriptions[i]));
    if (i < 4 && !q.group) {
      if (!ENDURANCE.has(entry.activity_id)) q.sets = Math.min(6, q.sets + 1);
      if (q.intensity.type === "percent_1rm") q.intensity = pct(Math.min(90, q.intensity.value + 5));
      // Sport S&C primaries stay at or below RPE 8 even for pros (sport load comes first).
      else if (q.intensity.type === "rpe") q.intensity = rpe(Math.min(8, q.intensity.value + 1));
    }
    return [id, q];
  });
}

const variant = (items) => ({ exercise_eligibility: items.map(([id]) => id), item_prescriptions: items.map(([, p]) => p) });

// --- Microcycles (training weeks) ---
// "<id> <sets>x<reps|Nm|Ns> @<N%|rpeN|bw> r<rest> [g=<id>:<type>:<cap>]" -> [id, prescription]
function parseItem(text) {
  const m = /^([a-z0-9_]+) (\d+)x(\d+)(m|s)? @(\d+(?:\.\d+)?%|rpe\d+|bw) r(\d+)(?: g=([a-z0-9_]+):([a-z_]+):(\d+))?$/.exec(text);
  if (!m) throw new Error(`bad microcycle item: ${text}`);
  const [, id, sets, dose, unit, inten, rest, gid, gtype, cap] = m;
  const intensity = inten === "bw" ? bw : inten.startsWith("rpe") ? rpe(Number(inten.slice(3))) : pct(Number(inten.slice(0, -1)));
  const q = P(Number(sets), unit ? 1 : Number(dose), intensity, Number(rest));
  if (unit === "m") q.distance_m = Number(dose);
  if (unit === "s") q.duration_seconds = Number(dose);
  if (gid) q.group = { group_id: gid, group_type: gtype, time_cap_seconds: Number(cap) };
  return [id, q];
}
const parseDays = (days) => days.map(([day_id, focus, items]) => ({ day_id, focus, items: items.map(parseItem) }));
const dayOut = (d) => ({ day_id: d.day_id, focus: d.focus, ...variant(d.items) });

// Strength sports keep their competition lifts at every level (a beginner
// powerlifter still learns to squat, bench and deadlift):
// beginner - assisted pulling/nordic swaps only; % 1RM becomes RPE 6 with at
//   least 5 reps; one fewer set (min 2); RPE capped at 7.
// pro - primaries +1 set (max 6), % 1RM +5 (max 90), RPE +1 (max 9).
const STRENGTH = new Set(["powerlifting", "olympic_weightlifting", "strongman", "street_lifting"]);
function strengthBeginner(items, activity) {
  const used = new Set();
  return items.map(([id, p]) => {
    const swap = BEGINNER_SWAPS[id];
    if (swap && allowed(swap[0], activity) && !used.has(swap[0]) && !items.some(([x]) => x === swap[0])) {
      used.add(swap[0]);
      return [swap[0], swap[1] ?? { ...JSON.parse(JSON.stringify(p)), intensity: rpe(7) }];
    }
    used.add(id);
    const q = JSON.parse(JSON.stringify(p));
    if (!q.group) q.sets = Math.max(2, q.sets - 1);
    if (q.intensity.type === "percent_1rm") {
      q.intensity = rpe(6);
      if (!q.distance_m && !q.duration_seconds) q.reps = beginnerReps(id, q.reps, 5);
    } else if (q.intensity.type === "rpe" && q.intensity.value > 7) q.intensity = rpe(7);
    if (OLYMPIC_LIFT.test(id) && !q.group) q.reps = Math.min(q.reps, BEGINNER_OLYMPIC_MAX_REPS);
    return [id, q];
  });
}
function strengthPro(items) {
  return items.map(([id, p], i) => {
    const q = JSON.parse(JSON.stringify(p));
    if (i < 4 && !q.group) {
      q.sets = Math.min(6, q.sets + 1);
      if (q.intensity.type === "percent_1rm") q.intensity = pct(Math.min(90, q.intensity.value + 5));
      else if (q.intensity.type === "rpe") q.intensity = rpe(Math.min(9, q.intensity.value + 1));
    }
    return [id, q];
  });
}
// Other sports reuse the session rules above, applied day by day.
const asEntry = (activity, items) => ({ activity_id: activity, ...variant(items) });
function weekForLevels(activity, days) {
  const level = (fn) => days.map((d) => ({ ...d, items: fn(d.items) }));
  if (STRENGTH.has(activity)) {
    return { amateur: days, beginner: level((items) => strengthBeginner(items, activity)), pro: level(strengthPro) };
  }
  return {
    amateur: days,
    beginner: level((items) => beginnerOf(asEntry(activity, items))),
    pro: level((items) => proOf(asEntry(activity, items)))
  };
}
function checkWeek(label, activity, week) {
  for (const [lvl, days] of Object.entries(week)) {
    for (const d of days) {
      const ids = d.items.map(([id]) => id);
      if (new Set(ids).size !== ids.length) throw new Error(`${label}/${lvl}/${d.day_id}: duplicate exercise`);
      for (const id of ids) if (!ex[id]) throw new Error(`${label}/${lvl}/${d.day_id}: unknown exercise ${id}`);
      for (const id of ids) if (!allowed(id, activity)) throw new Error(`${label}/${lvl}/${d.day_id}: ${id} not training-allowed`);
    }
  }
}
const weekReport = [];
function attachWeek(label, activity, target, levelTargets, days) {
  const week = weekForLevels(activity, parseDays(days));
  checkWeek(label, activity, week);
  target.microcycle = week.amateur.map(dayOut);
  levelTargets.beginner.microcycle = week.beginner.map(dayOut);
  levelTargets.pro.microcycle = week.pro.map(dayOut);
  weekReport.push({ label, days: week.amateur.map((d) => d.focus), beginner: week.beginner.map((d) => d.items.map(([id]) => id).join(" ")) });
}
const report = [];
for (const entry of prog.entries) {
  const h = HAND[entry.activity_id];
  const beginner = h ? h.beginner : beginnerOf(entry);
  const pro = h ? h.pro : proOf(entry);
  for (const [id] of [...beginner, ...pro]) if (!allowed(id, entry.activity_id)) throw new Error(`${entry.activity_id}: ${id} not training-allowed`);
  entry.level_variants = { beginner: variant(beginner), pro: variant(pro) };
  const events = EVENTS[entry.activity_id];
  if (events) {
    entry.event_variants = {};
    for (const [event, lv] of Object.entries(events)) {
      for (const [id] of [...lv.beginner, ...lv.amateur, ...lv.pro]) if (!allowed(id, entry.activity_id)) throw new Error(`${entry.activity_id}/${event}: ${id} not training-allowed`);
      entry.event_variants[event] = { ...variant(lv.amateur), level_variants: { beginner: variant(lv.beginner), pro: variant(lv.pro) } };
    }
  }
  report.push({ activity: entry.activity_id, source: h ? "hand" : "rules", beginner: beginner.map(([id, p]) => `${id} ${p.sets}x${p.distance_m ? p.distance_m + "m" : p.duration_seconds ? p.duration_seconds + "s" : p.reps} ${p.intensity.type === "bodyweight" ? "BW" : p.intensity.type + ":" + p.intensity.value}`), pro: pro.map(([id, p]) => `${id} ${p.sets}x${p.distance_m ? p.distance_m + "m" : p.duration_seconds ? p.duration_seconds + "s" : p.reps} ${p.intensity.type === "bodyweight" ? "BW" : p.intensity.type + ":" + p.intensity.value}`) });
}
for (const entry of prog.entries) {
  const days = MICROCYCLES[entry.activity_id];
  if (!days) throw new Error(`${entry.activity_id}: no microcycle declared`);
  attachWeek(entry.activity_id, entry.activity_id, entry, entry.level_variants, days);
  for (const [event, eventDays] of Object.entries(EVENT_MICROCYCLES[entry.activity_id] ?? {})) {
    const v = entry.event_variants[event];
    attachWeek(`${entry.activity_id}/${event}`, entry.activity_id, v, v.level_variants, eventDays);
  }
}
// Fixed exercises: a sport's competition lifts (and HYROX's race stations and
// strongman's event implements) are named; every other item outside a timed
// group is an open slot the athlete or coach fills with their own choice.
const FIXED = {
  powerlifting: ["back_squat", "bench_press", "paused_bench_press", "deadlift"],
  olympic_weightlifting: ["snatch", "power_clean", "push_jerk"],
  strongman: ["yoke_walk", "farmers_carry", "sandbag_carry", "strongman_log_press", "axle_bar_press", "deadlift", "atlas_stone_carry", "tire_flip"],
  street_lifting: ["pull_up", "band_assisted_pull_up", "dip", "back_squat", "muscle_up"],
  hyrox: ["tempo_run", "sled_push", "sled_drag", "wall_ball", "burpee_broad_jump", "sandbag_lunge", "farmers_carry", "rowing_ergometer", "ski_erg"]
};
const markFixed = (target, activity) => {
  const fixed = new Set(FIXED[activity] ?? []);
  if (!target?.exercise_eligibility || !target.item_prescriptions) return;
  target.item_prescriptions = target.item_prescriptions.map((pr, i) => {
    const { fixed: _drop, ...rest } = pr;
    return fixed.has(target.exercise_eligibility[i]) ? { ...rest, fixed: true } : rest;
  });
};
for (const entry of prog.entries) {
  const targets = [entry, ...Object.values(entry.level_variants ?? {})];
  for (const ev of Object.values(entry.event_variants ?? {})) targets.push(ev, ...Object.values(ev.level_variants ?? {}));
  for (const t of targets) {
    markFixed(t, entry.activity_id);
    for (const day of t.microcycle ?? []) markFixed(day, entry.activity_id);
  }
}
fs.writeFileSync("registries/program/program.registry.json", JSON.stringify(prog, null, 2) + "\n");
if (process.env.WEEK_REPORT) fs.writeFileSync(process.env.WEEK_REPORT, JSON.stringify(weekReport, null, 1));
if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(report, null, 1));
console.log("variants written for", prog.entries.length, "activities");
