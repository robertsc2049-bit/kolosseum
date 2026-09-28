// Workout scores the way a CrossFit coach keeps them: the same workout over
// time, Rx and scaled never mixed.
import test from "node:test";
import assert from "node:assert/strict";

import { workoutHistories, workoutKey } from "../dist/src/api/workout_scores.js";

const cindy = { group_type: "amrap", time_cap_seconds: 1200, round_seconds: 0, total_rounds: 0,
  exercises: [{ exercise_id: "pull_up", reps: 5, distance_m: null, duration_seconds: null }, { exercise_id: "push_up", reps: 10, distance_m: null, duration_seconds: null }, { exercise_id: "air_squat", reps: 15, distance_m: null, duration_seconds: null }] };
const chipper = { group_type: "for_time", time_cap_seconds: 900, round_seconds: 0, total_rounds: 0,
  exercises: [{ exercise_id: "rowing_ergometer", reps: 1, distance_m: 500, duration_seconds: null }, { exercise_id: "thruster", reps: 15, distance_m: null, duration_seconds: null }] };
const r = (workout, date, event, session_id = date) => ({ ...workout, session_id, date, event });

test("an athlete's Cindy scores stay separate by Rx and scaled, with a best for each", () => {
  const [history] = workoutHistories([
    r(cindy, "2026-09-01", { rounds_completed: 14, extra_reps: 3, scaled: true }),
    r(cindy, "2026-09-08", { rounds_completed: 12, extra_reps: 10 }),
    r(cindy, "2026-09-15", { rounds_completed: 13, extra_reps: 2, scaled: false })
  ]);
  assert.deepEqual(history.results.map((s) => s.date), ["2026-09-15", "2026-09-08", "2026-09-01"], "newest first");
  assert.equal(history.best_rx.label, "13 rounds + 2 reps");
  assert.equal(history.best_scaled.label, "14 rounds + 3 reps", "the scaled 14 rounds is never the Rx best");
  assert.deepEqual(history.results.map((s) => s.scaled), [false, false, true]);
});

test("for time: finishing under the cap beats capping out; faster beats slower", () => {
  const [history] = workoutHistories([
    r(chipper, "2026-09-01", { elapsed_seconds: 900, hit_time_cap: true }),
    r(chipper, "2026-09-08", { elapsed_seconds: 612, hit_time_cap: false }),
    r(chipper, "2026-09-15", { elapsed_seconds: 575, hit_time_cap: false })
  ]);
  assert.equal(history.best_rx.label, "9:35");
  assert.equal(history.results.find((s) => s.hit_time_cap).label, "Time cap (15:00)");
});

test("a workout with a different cap or dose is a different workout", () => {
  const shorter = { ...cindy, time_cap_seconds: 600 };
  const heavier = { ...chipper, exercises: [chipper.exercises[0], { ...chipper.exercises[1], reps: 21 }] };
  assert.notEqual(workoutKey(cindy), workoutKey(shorter));
  assert.notEqual(workoutKey(chipper), workoutKey(heavier));
  const histories = workoutHistories([r(cindy, "2026-09-01", { rounds_completed: 10, extra_reps: 0 }), r(shorter, "2026-09-02", { rounds_completed: 6, extra_reps: 0 })]);
  assert.equal(histories.length, 2);
  assert.equal(histories[0].time_cap_seconds, 600, "most recent workout first");
});

test("EMOM: more rounds done, then fewer missed; malformed results are ignored", () => {
  const emom = { group_type: "emom", time_cap_seconds: 0, round_seconds: 60, total_rounds: 10, exercises: [{ exercise_id: "kettlebell_swing", reps: 15, distance_m: null, duration_seconds: null }] };
  const [history] = workoutHistories([
    r(emom, "2026-09-01", { rounds_completed: 10, rounds_missed: 0 }),
    r(emom, "2026-09-08", { rounds_completed: 8, rounds_missed: 2 }),
    r(emom, "2026-09-09", { rounds_completed: "lots" })
  ]);
  assert.equal(history.results.length, 2);
  assert.equal(history.best_rx.label, "10 rounds, 0 missed");
});
