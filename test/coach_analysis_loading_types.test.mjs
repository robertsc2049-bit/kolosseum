// Coach Analysis across every way a programme can load an exercise: a fixed
// weight and a weight range, a % of max (and a % range), an RPE, Borg or
// CR10 target, bodyweight, and timed or distance work - and every way an
// athlete rates effort (RPE, Borg, CR10).
import assert from "node:assert/strict";
import test from "node:test";

import { analyseAthlete, findings } from "../dist/src/api/coach_analysis_metrics.js";
import { athleteReport, summariseReport } from "../dist/src/api/coach_report_periods.js";

const TODAY = "2026-10-11"; // a Sunday: 3 whole weeks from 21 Sep
const at = (date, minutes = 0) => new Date(Date.parse(`${date}T09:00:00Z`) + minutes * 60_000).toISOString();
const dates = ["2026-09-21", "2026-09-23", "2026-09-28", "2026-09-30", "2026-10-05", "2026-10-07"];

// A hybrid athlete's sessions: back squat at 70-75% of a 200 kg max, a fixed
// 100-110 kg row range, a bench press at RPE 8, a sled push rated on Borg
// (target 13), pull-ups on bodyweight (8 reps rising to 11), a 60 s plank and
// 4 x 20 m sled pushes - the last of them skipped in the final session.
function hybridAthlete() {
  return dates.map((date, n) => {
    const late = n >= 3;
    const pullups = 8 + Math.floor(n / 2) + (n === 5 ? 1 : 0);
    return {
      session_id: `s${n}`, status: "completed", created_at: at(date),
      planned: [
        { exercise_id: "back_squat", segment: "working", role: "primary", sets: 3, reps_target: 5, load_kg: 140, load_kg_max: 150, one_rep_max_kg: 200, intensity_type: "percent_1rm", dose: "reps" },
        { exercise_id: "barbell_row", segment: "working", sets: 3, reps_target: 8, load_kg: 100, load_kg_max: 110, intensity_type: "load", dose: "reps" },
        { exercise_id: "bench_press", segment: "working", sets: 3, reps_target: 5, load_kg: null, intensity_type: "rpe", target_effort: 8, dose: "reps" },
        { exercise_id: "pull_up", segment: "working", sets: 3, reps_target: null, load_kg: null, intensity_type: "bodyweight", dose: "reps" },
        { exercise_id: "plank", segment: "working", sets: 3, reps_target: null, load_kg: null, intensity_type: "bodyweight", dose: "time", duration_s: 60 },
        { exercise_id: "sled_push", segment: "working", sets: 4, reps_target: null, load_kg: null, intensity_type: "borg", target_effort: 13, dose: "distance", distance_m: 20 }
      ],
      events: [
        { type: "START_SESSION", at: at(date) },
        ...[1, 2, 3].map((set) => ({ type: "SET_LOG_REPORT", at: at(date, 5), exercise_id: "back_squat", set_index: set, reps: 5, load_kg: 150 })),
        ...[1, 2, 3].map((set) => ({ type: "SET_LOG_REPORT", at: at(date, 15), exercise_id: "barbell_row", set_index: set, reps: 8, load_kg: set === 3 ? 115 : 105 })),
        ...[1, 2, 3].map((set) => ({ type: "SET_LOG_REPORT", at: at(date, 25), exercise_id: "bench_press", set_index: set, reps: 5, load_kg: 90 })),
        { type: "RPE_REPORT", at: at(date, 26), exercise_id: "bench_press", rpe: late ? 9.5 : 9 },
        ...[1, 2, 3].map((set) => ({ type: "SET_LOG_REPORT", at: at(date, 35), exercise_id: "pull_up", set_index: set, reps: pullups })),
        { type: "COMPLETE_EXERCISE", at: at(date, 40), exercise_id: "plank" },
        ...(n === 5
          ? [{ type: "SKIP_EXERCISE", at: at(date, 45), exercise_id: "sled_push", reason_code: "equipment" }]
          : [{ type: "COMPLETE_EXERCISE", at: at(date, 45), exercise_id: "sled_push" }, { type: "BORG_REPORT", at: at(date, 46), exercise_id: "sled_push", borg: 17 }]),
        { type: "CR10_REPORT", at: at(date, 50), exercise_id: "back_squat", cr10: late ? 8 : 6 }
      ]
    };
  });
}

const analyse = (sessions) => analyseAthlete({
  today: TODAY, weeks: 3, closed: true, sessions, readiness: [], checkins: [], planned_days_per_week: 2,
  exercise_name: (id) => id.replaceAll("_", " "), is_strength_lift: (id) => ["back_squat", "barbell_row", "bench_press", "pull_up"].includes(id),
  pattern_of: (id) => ({ back_squat: "squat", barbell_row: "horizontal_pull", bench_press: "horizontal_push", pull_up: "vertical_pull" })[id]
});

test("a weight range or a % range: inside the range is on plan, above it is measured from the top", () => {
  const a = analyse(hybridAthlete());
  // Squat 150 kg against 140-150 (70-75% of 200): on plan. Row 105, 105, 115 against 100-110: 115 is 4.5% over the top.
  const week = a.execution.rows[0];
  assert.equal(week.load_vs_plan_pct, Math.round(((0 * 3 + 0 * 2 + (115 / 110 - 1)) / 6) * 1000) / 10);
});

test("% of max: the % lifted and the sets by intensity zone", () => {
  const a = analyse(hybridAthlete());
  assert.equal(a.execution.rows[0].intensity_pct, 75, "150 kg of a 200 kg max");
  const zones = Object.fromEntries(a.execution.intensity.zones.map((zone) => [zone.zone, zone.sets]));
  assert.equal(zones["70-80%"], 18, "6 sessions x 3 squat sets");
  assert.equal(a.execution.intensity.sets, 18);
  assert.deepEqual(a.execution.intensity.by_exercise[0], { exercise_id: "back_squat", name: "back squat", sets: 18, average_pct: 75, top_pct: 75, zones: [{ zone: "under 60%", sets: 0 }, { zone: "60-70%", sets: 0 }, { zone: "70-80%", sets: 18 }, { zone: "80-90%", sets: 0 }, { zone: "90% +", sets: 0 }] });
});

test("an RPE target and a Borg target: the athlete's ratings against them, each in its own scale", () => {
  const a = analyse(hybridAthlete());
  const bench = a.execution.effort_targets.find((row) => row.exercise_id === "bench_press");
  assert.deepEqual([bench.scale, bench.target, bench.rated_average, bench.diff], ["rpe", 8, 9.3, 1.3]);
  const sled = a.execution.effort_targets.find((row) => row.exercise_id === "sled_push");
  assert.deepEqual([sled.scale, sled.target, sled.rated_average, sled.diff, sled.diff_10], ["borg", 13, 17, 4, 2.9]);
  const text = findings(a).map((finding) => finding.text).join(" | ");
  assert.match(text, /sled push is rated harder than prescribed: Borg 13 set, rated 17 on average/);
});

test("effort rated on CR10 or Borg counts: creep at the same weight, and the effort spread", () => {
  const a = analyse(hybridAthlete());
  const squat = a.execution.effort_creep.find((row) => row.exercise_id === "back_squat");
  assert.deepEqual([squat.scale_label, squat.early, squat.late], ["CR10", 6, 8]);
  assert.match(findings(a).map((finding) => finding.text).join(" | "), /feels harder at the same weight: CR10 6 → 8 at about 150 kg/);
  assert.deepEqual(a.exercises.rated_by, { rpe: 6, cr10: 6, borg: 5 });
  assert.equal(a.exercises.effort_bands.reduce((sum, band) => sum + band.ratings, 0), 17);
});

test("bodyweight work: best reps week by week, and its reps in the volume", () => {
  const a = analyse(hybridAthlete());
  const pullups = a.strength.bodyweight.find((row) => row.exercise_id === "pull_up");
  assert.deepEqual(pullups.series.map((point) => point.best_reps), [8, 9, 11]);
  assert.equal(pullups.change, 3);
  assert.match(findings(a).map((finding) => finding.text).join(" | "), /pull up best set up from 8 to 11 reps/);
  assert.equal(a.volume.rows[0].bodyweight_reps, 2 * 3 * 8 + 0, "week 1: two sessions of 3 x 8... ");
  assert.equal(a.strength.lifts.some((lift) => lift.exercise_id === "pull_up"), false, "no estimated max from unweighted sets");
});

test("timed and distance work: done by completing it, counted as prescribed - a skipped sled push is missed sets, not a logging gap", () => {
  const a = analyse(hybridAthlete());
  assert.deepEqual(a.volume.rows.map((row) => row.timed_minutes), [6, 6, 6], "2 sessions x 3 x 60 s a week");
  assert.deepEqual(a.volume.rows.map((row) => row.distance_m), [160, 160, 80], "4 x 20 m, skipped in the last session");
  // Week 1: all 34 prescribed sets done (3+3+3+3 logged, 3 plank + 4 sled completed) per session.
  assert.equal(a.execution.rows[0].sets_logged_pct, 100);
  assert.equal(a.execution.rows[2].sets_logged_pct, Math.round(((19 + 15) / 38) * 100));
  const plank = a.exercises.rows.find((row) => row.exercise_id === "plank");
  assert.equal(plank.minutes, 18);
  const missed = a.execution.most_missed.find((row) => row.exercise_id === "sled_push");
  assert.equal(missed.missed_sets, 4);
});

test("the athlete's copy shows what they did in every form - weight x reps, bodyweight reps, minutes, metres - and never a % of max", () => {
  const a = analyse(hybridAthlete());
  const summary = summariseReport(a);
  assert.equal(summary.training.timed_minutes, 18);
  assert.equal(summary.training.distance_m, 400);
  const copy = athleteReport({ type: "custom", id: "x", label: "3 weeks", start: "2026-09-21", end: "2026-10-11", complete: true }, summary, a, { name: "Coach", message: "" });
  const byName = Object.fromEntries(copy.exercises.map((row) => [row.name, row]));
  assert.deepEqual(byName["back squat"].best_set, { load_kg: 150, reps: 5 });
  assert.equal(byName["pull up"].best_bodyweight_reps, 11);
  assert.equal(byName["plank"].minutes, 18);
  assert.equal(byName["sled push"].distance_m, 400);
  assert.equal(JSON.stringify(copy).includes("intensity"), false, "no % of max");
  assert.equal(JSON.stringify(copy).includes("one_rep_max"), false);
});
