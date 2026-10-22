// The sports-science layer: tests with their smallest worthwhile change,
// strength changes judged against the lift's own noise, strength relative to
// bodyweight next to the tested max, and planned vs done.
import assert from "node:assert/strict";
import test from "node:test";

import { analyseAthlete, findings } from "../dist/src/api/coach_analysis_metrics.js";

const TODAY = "2026-10-18"; // a Sunday
const at = (date, minutes = 0) => new Date(Date.parse(`${date}T17:00:00Z`) + minutes * 60_000).toISOString();
const mondays = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"];

// A rugby forward squatting 5s each Monday at the weight given, against a
// plan of 3 x 5 at 140 kg.
function week(date, load, sets = 3) {
  return {
    session_id: `s_${date}`, status: "completed", created_at: at(date),
    planned: [{ exercise_id: "back_squat", segment: "working", role: "primary", sets: 3, reps_target: 5, load_kg: 140, intensity_type: "load", dose: "reps" }],
    events: [
      { type: "START_SESSION", at: at(date) },
      ...Array.from({ length: sets }, (_, i) => ({ type: "SET_LOG_REPORT", at: at(date, 5 * (i + 1)), exercise_id: "back_squat", set_index: i + 1, reps: 5, load_kg: load }))
    ]
  };
}
const analyse = (sessions, extra = {}) => analyseAthlete({
  today: TODAY, weeks: 6, sessions, readiness: [], checkins: [], planned_days_per_week: 1,
  exercise_name: (id) => id.replaceAll("_", " "), is_strength_lift: () => true, ...extra
});

test("a noisy lift's +3% is within its normal variation - steady, not rising; a steady climber's +3% is real", () => {
  const noisy = analyse([140, 150, 138, 152, 140, 147.5].map((load, i) => week(mondays[i], load)));
  const noisyLift = noisy.strength.lifts[0];
  assert.ok(noisyLift.noise_pct > 3, `noise ${noisyLift.noise_pct}%`);
  assert.equal(noisyLift.status, "steady", "+3% inside a ±4%+ wobble is not a change");
  assert.equal(noisyLift.real_change, false);
  const steady = analyse([140, 141, 142.5, 143.5, 144.5, 145.5].map((load, i) => week(mondays[i], load)));
  const steadyLift = steady.strength.lifts[0];
  assert.equal(steadyLift.swc_pct, 2, "a smooth climber's noise is tiny - the 2% floor applies");
  assert.equal(steadyLift.status, "rising");
  assert.equal(steadyLift.real_change, true);
});

test("strength relative to bodyweight, and the max the coach tested beside the estimate", () => {
  const a = analyse(mondays.map((date) => week(date, 140)), { bodyweight_kg: 100, tested_maxes: [{ exercise_id: "back_squat", date: "2026-08-30", value_kg: 160 }, { exercise_id: "back_squat", date: "2026-09-20", value_kg: 165 }] });
  const lift = a.strength.lifts[0];
  assert.equal(lift.relative_to_bodyweight, Math.round((lift.latest / 100) * 100) / 100);
  assert.deepEqual(lift.tested_max, { value_kg: 165, date: "2026-09-20" });
});

test("a CMJ up 3 cm is a real improvement; a 10 m sprint 0.02 s slower is within its noise", () => {
  const a = analyse(mondays.map((date) => week(date, 140)), { tests: [
    { id: "t1", test_id: "cmj_cm", date: "2026-09-08", value: 41.5 },
    { id: "t2", test_id: "cmj_cm", date: "2026-10-13", value: 44.5 },
    { id: "t3", test_id: "sprint_10m_s", date: "2026-09-08", value: 1.71 },
    { id: "t4", test_id: "sprint_10m_s", date: "2026-10-13", value: 1.73 }
  ] });
  const byId = Object.fromEntries(a.testing.tests.map((row) => [row.test_id, row]));
  assert.deepEqual([byId.cmj_cm.change, byId.cmj_cm.verdict, byId.cmj_cm.unit], [3, "improved", "cm"]);
  assert.deepEqual([byId.sprint_10m_s.change, byId.sprint_10m_s.verdict, byId.sprint_10m_s.better], [0.02, "within_noise", "lower"]);
  const list = findings(a);
  assert.ok(list.some((f) => f.id === "test_cmj_cm" && f.level === "good" && /Countermovement jump improved to 44.5 cm \(from 41.5\) - a real change/u.test(f.text)));
  assert.equal(list.some((f) => f.id === "test_sprint_10m_s"), false, "noise is not a finding");
});

test("planned vs done: two weeks of 2 sets of the planned 3 is 67% of the planned tonnage", () => {
  const sessions = mondays.map((date, i) => week(date, 140, i >= 4 ? 2 : 3));
  const a = analyse(sessions);
  const last = a.plan.rows.at(-1);
  assert.deepEqual([last.planned_sessions, last.done_sessions, last.planned_sets, last.done_sets], [1, 1, 3, 2]);
  assert.deepEqual([last.planned_tonnage_kg, last.done_tonnage_kg, last.tonnage_pct], [2100, 1400, 67]);
  const under = findings(analyse(sessions, { today: "2026-10-25" })).find((f) => f.id === "plan_under");
  assert.ok(under, "doing two-thirds of the plan is flagged");
  assert.match(under.text, /Did 67% of the planned tonnage over the last 2 weeks/u);
});

test("a forward who misses reps on his top squat sets at RPE 10 twice gets an alert; at RPE 8 a missed rep is no grind", () => {
  const grind = (date, rpe, reps) => ({
    ...week(date, 150),
    events: [
      { type: "START_SESSION", at: at(date) },
      ...[5, 5, reps].map((r, i) => ({ type: "SET_LOG_REPORT", at: at(date, 5 * (i + 1)), exercise_id: "back_squat", set_index: i + 1, reps: r, load_kg: 150 })),
      { type: "RPE_REPORT", at: at(date, 16), exercise_id: "back_squat", rpe }
    ]
  });
  const twice = findings(analyse([week("2026-09-21", 140), grind("2026-10-05", 10, 3), grind("2026-10-12", 10, 2)])).find((f) => f.id === "grind_back_squat");
  assert.equal(twice.level, "alert");
  assert.equal(twice.text, "back squat: reps missed at RPE 10 (2 of 5) in 2 sessions, the last on 12 Oct.");
  assert.match(twice.action, /take 5-10% off/u);
  assert.equal(findings(analyse([week("2026-09-21", 140), grind("2026-10-12", 8, 4)])).find((f) => f.id === "grind_back_squat"), undefined);
});

test("bar speed lost 36% across a session's sets is flagged; 18% is not", () => {
  const vbt = (date, speeds) => ({
    ...week(date, 140),
    events: [{ type: "START_SESSION", at: at(date) }, ...speeds.map((velocity, i) => ({ type: "SET_LOG_REPORT", at: at(date, 5 * (i + 1)), exercise_id: "back_squat", set_index: i + 1, reps: 5, load_kg: 140, velocity }))]
  });
  const heavy = findings(analyse([vbt("2026-10-05", [0.7, 0.6, 0.45]), vbt("2026-10-12", [0.7, 0.58, 0.45])])).find((f) => f.id === "vloss_back_squat");
  assert.equal(heavy.text, "back squat: bar speed drops 36% from the fastest set to the last - over 30%, the sets are close to failure.");
  assert.equal(findings(analyse([vbt("2026-10-05", [0.62, 0.58, 0.5]), vbt("2026-10-12", [0.71, 0.67, 0.6])])).find((f) => f.id === "vloss_back_squat"), undefined);
});

test("a powerlifter with tested maxes but few logged sessions still gets meet attempts", () => {
  const a = analyse([week("2026-10-12", 140)], {
    activity_id: "powerlifting", competition_date: "2026-11-22",
    tested_maxes: [{ exercise_id: "back_squat", date: "2026-09-20", value_kg: 180 }, { exercise_id: "bench_press", date: "2026-09-20", value_kg: 120 }, { exercise_id: "deadlift", date: "2025-01-10", value_kg: 220 }]
  });
  assert.deepEqual(a.attempts.rows.map((row) => [row.exercise_id, row.opener, row.second, row.third]), [["back_squat", 162.5, 172.5, 180], ["bench_press", 107.5, 115, 120]], "the deadlift's year-old max isn't used");
});
