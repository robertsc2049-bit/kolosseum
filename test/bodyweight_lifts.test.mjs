// A 75 kg street lifter's weighted pull-up moves 95 kg, not 20 kg: maxes,
// strength relative to bodyweight and meet attempts use bodyweight + added.
import assert from "node:assert/strict";
import test from "node:test";

import { setE1rmKg, computeTrainingE1rmTrends } from "../dist/src/api/training_e1rm.js";
import { isBodyweightLift, systemLoadKg } from "../dist/src/api/bodyweight_lifts.js";
import { analyseAthlete } from "../dist/src/api/coach_analysis_metrics.js";
import { attemptPlan } from "../dist/src/api/strength_top_end.js";

test("pull-ups, dips and chin-ups are bodyweight lifts; the back squat isn't", () => {
  assert.equal(isBodyweightLift("pull_up"), true);
  assert.equal(isBodyweightLift("dip"), true);
  assert.equal(isBodyweightLift("chin_up__r2"), true);
  assert.equal(isBodyweightLift("back_squat"), false);
  assert.equal(systemLoadKg(75, 20), 95);
  assert.equal(systemLoadKg(75, -15), 60, "band assistance takes weight off");
});

test("+20 kg x 4 at 75 kg bodyweight is a 107 kg pull-up max, not 22.7 kg", () => {
  const set = { exercise_id: "pull_up", reps: 4, load_value: 20, load_unit: "kg", date: "2026-10-12" };
  assert.equal(Math.round(setE1rmKg(set) * 10) / 10, 22.7, "without a bodyweight only the added weight is known");
  assert.equal(Math.round(setE1rmKg({ ...set, bodyweight_lift: true, bodyweight_kg: 75 }) * 10) / 10, 107.7);
  assert.equal(Math.round(setE1rmKg({ ...set, load_value: 0, bodyweight_lift: true, bodyweight_kg: 75 }) * 10) / 10, 85, "an unweighted set of 4 counts too");
  const [trend] = computeTrainingE1rmTrends([{ ...set, bodyweight_lift: true, bodyweight_kg: 75 }], "kg", 28, () => "vertical_pull");
  assert.equal(trend.includes_bodyweight, true);
});

const pullUpSession = (date, added, reps) => ({
  session_id: `s${date}`, status: "completed", created_at: `${date}T10:00:00Z`,
  planned: [{ exercise_id: "pull_up", segment: "working", sets: 3, reps_target: reps, load_kg: null, dose: "reps" }],
  events: [
    { type: "START_SESSION", at: `${date}T10:00:00Z` },
    ...[1, 2, 3].map((i) => ({ type: "SET_LOG_REPORT", at: `${date}T10:0${i}:00Z`, exercise_id: "pull_up", set_index: i, reps, load_kg: added })),
    { type: "COMPLETE_SESSION", at: `${date}T10:30:00Z` }
  ]
});

test("the coach's analysis: a street lifter's pull-up max and x bodyweight include their bodyweight", () => {
  const a = analyseAthlete({
    today: "2026-10-18", weeks: 4, readiness: [], checkins: [], planned_days_per_week: 3, exercise_name: (id) => id,
    sessions: [pullUpSession("2026-09-29", 15, 4), pullUpSession("2026-10-06", 17.5, 4), pullUpSession("2026-10-13", 20, 4)],
    is_strength_lift: (id) => id === "pull_up", is_bodyweight_lift: (id) => id === "pull_up", bodyweight_kg: 75
  });
  const lift = a.strength.lifts.find((entry) => entry.exercise_id === "pull_up");
  assert.equal(lift.latest, 107.7);
  assert.equal(lift.relative_to_bodyweight, 1.44);
  assert.equal(lift.includes_bodyweight, true);
  assert.match(lift.series.at(-1).from, /95 kg x 4 \(bodyweight \+ added\)/u);
});

test("street lifting attempts are the weight to add, in 1.25 kg, and need a bodyweight", () => {
  const lifts = [{ exercise_id: "pull_up", name: "Pull-up", latest: 107.7 }, { exercise_id: "dip", name: "Dip", latest: 140 }];
  const plan = attemptPlan("street_lifting", lifts, "2026-11-22", "2026-10-18", 75);
  assert.equal(plan.added_weight, true);
  assert.deepEqual(plan.rows.map((row) => [row.name, row.opener, row.second, row.third]), [["Pull-up", 22.5, 27.5, 32.5], ["Dip", 51.25, 58.75, 65]]);
  assert.equal(attemptPlan("street_lifting", lifts, "2026-11-22", "2026-10-18", null), null);
});
