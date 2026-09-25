// DEV NOTE: Repository automation script. Generates beginner/pro level_variants for every program registry entry (run from repo root; REPORT=<path> optional).
// The base entry is the amateur session. Strength sports are hand-tuned; the
// other activities use explicit coaching rules (documented below). Run from repo root.
import fs from "node:fs";

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
  pull_up: ["band_assisted_pull_up", null]
};
// Landing drills are low-rep quality work.
const LANDING_DOSE = P(3, 5, bw, 60);

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
      if (q.reps < 6) q.reps = 8;
    } else if (q.intensity.type === "rpe" && q.intensity.value > 7) {
      q.intensity = rpe(7);
    }
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
const report = [];
for (const entry of prog.entries) {
  const h = HAND[entry.activity_id];
  const beginner = h ? h.beginner : beginnerOf(entry);
  const pro = h ? h.pro : proOf(entry);
  for (const [id] of [...beginner, ...pro]) if (!allowed(id, entry.activity_id)) throw new Error(`${entry.activity_id}: ${id} not training-allowed`);
  entry.level_variants = { beginner: variant(beginner), pro: variant(pro) };
  report.push({ activity: entry.activity_id, source: h ? "hand" : "rules", beginner: beginner.map(([id, p]) => `${id} ${p.sets}x${p.distance_m ? p.distance_m + "m" : p.duration_seconds ? p.duration_seconds + "s" : p.reps} ${p.intensity.type === "bodyweight" ? "BW" : p.intensity.type + ":" + p.intensity.value}`), pro: pro.map(([id, p]) => `${id} ${p.sets}x${p.distance_m ? p.distance_m + "m" : p.duration_seconds ? p.duration_seconds + "s" : p.reps} ${p.intensity.type === "bodyweight" ? "BW" : p.intensity.type + ":" + p.intensity.value}`) });
}
fs.writeFileSync("registries/program/program.registry.json", JSON.stringify(prog, null, 2) + "\n");
if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(report, null, 1));
console.log("variants written for", prog.entries.length, "activities");
