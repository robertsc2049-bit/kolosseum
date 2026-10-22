// A strength coach's top end: a weightlifter's heavy snatch session against
// Prilepin, a powerlifter's squat getting faster at 140 kg, and attempts
// for a meet in 5 weeks.
import assert from "node:assert/strict";
import test from "node:test";

import { attemptPlan, prilepinCheck, velocitySummary } from "../dist/src/api/strength_top_end.js";

const name = (id) => ({ snatch: "Snatch", back_squat: "Back squat", bench_press: "Bench press", deadlift: "Deadlift" })[id] ?? id;

test("Prilepin: 12 singles at 90%+ is above the range; 15 reps at 80-89% is right on optimal", () => {
  const sets = [
    ...Array.from({ length: 12 }, () => ({ session_id: "s1", date: "2026-10-14", exercise_id: "snatch", pct: 92, reps: 1 })),
    ...Array.from({ length: 5 }, () => ({ session_id: "s2", date: "2026-10-16", exercise_id: "snatch", pct: 85, reps: 3 })),
    { session_id: "s3", date: "2026-10-17", exercise_id: "snatch", pct: 60, reps: 5 }
  ];
  const rows = prilepinCheck(sets, name);
  assert.equal(rows.length, 2, "a light-only session isn't checked");
  assert.deepEqual(rows[0].zones, [{ zone: "80-89%", reps: 15, optimal: 15, range: "10-20", verdict: "within" }]);
  assert.deepEqual(rows[1].zones, [{ zone: "90%+", reps: 12, optimal: 4, range: "1-10", verdict: "above" }]);
});

test("bar speed: faster at the same weight, and the speed lost across a session's sets", () => {
  const sets = [];
  const add = (session, date, speeds) => speeds.forEach((velocity, i) => sets.push({ session_id: session, date, exercise_id: "back_squat", load_kg: 140, velocity, set_index: i + 1 }));
  add("a", "2026-09-01", [0.62, 0.58, 0.5]);
  add("b", "2026-09-08", [0.6, 0.56, 0.48]);
  add("c", "2026-10-06", [0.7, 0.66, 0.58]);
  add("d", "2026-10-13", [0.71, 0.67, 0.6]);
  const [lift] = velocitySummary(sets, name, "2026-09-20");
  assert.equal(lift.common_load_kg, 140);
  assert.deepEqual([lift.speed_before, lift.speed_after, lift.speed_change], [0.56, 0.65, 0.1]);
  assert.equal(lift.velocity_loss_pct, 18, "about a fifth of the speed lost from the first set to the last");
  assert.deepEqual(lift.latest, { date: "2026-10-13", load_kg: 140, velocity: 0.6 });
});

test("meet attempts for a powerlifter 5 weeks out, in 2.5 kg steps; none for a rugby player or without a date", () => {
  const lifts = [
    { exercise_id: "back_squat", name: "Back squat", latest: 200, tested_max: { value_kg: 205, date: "2026-09-01" } },
    { exercise_id: "bench_press", name: "Bench press", latest: 130, tested_max: { value_kg: 140, date: "2025-11-01" } },
    { exercise_id: "deadlift", name: "Deadlift", latest: 240.4 }
  ];
  const plan = attemptPlan("powerlifting", lifts, "2026-11-22", "2026-10-18");
  assert.equal(plan.days_out, 35);
  assert.deepEqual(plan.rows.map((row) => [row.name, row.projected_max, row.opener, row.second, row.third, row.third_good_day]), [
    ["Back squat", 205, 185, 195, 205, 207.5],
    ["Bench press", 130, 117.5, 122.5, 130, 132.5],
    ["Deadlift", 240.4, 217.5, 230, 240, 245]
  ], "the old tested bench max (over 4 months) isn't trusted over the current estimate");
  assert.equal(attemptPlan("rugby_union", lifts, "2026-11-22", "2026-10-18"), null);
  assert.equal(attemptPlan("powerlifting", lifts, null, "2026-10-18"), null);
  assert.equal(attemptPlan("powerlifting", lifts, "2027-06-01", "2026-10-18"), null, "more than 16 weeks out");
  const wl = attemptPlan("olympic_weightlifting", [{ exercise_id: "snatch", name: "Snatch", latest: 101.3 }], "2026-11-01", "2026-10-18");
  assert.deepEqual([wl.rows[0].opener, wl.rows[0].second, wl.rows[0].third], [92, 97, 101], "weightlifting in 1 kg");
});
