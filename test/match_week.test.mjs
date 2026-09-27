// DEV NOTE: Human-maintained repo surface. Match-week rules: a strength session
// around the athlete's matches, the way a head of S&C plans the microcycle.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { applyMatchWeek, matchContextFor, validateMatchWeek } from "../dist/src/api/match_week.js";

const REGISTRY = JSON.parse(fs.readFileSync("registries/exercise/exercise.registry.json", "utf8")).entries;
const patternOf = (id) => REGISTRY[id]?.movement_pattern_id ?? REGISTRY[id]?.pattern;
const on = (iso) => new Date(`${iso}T08:00:00Z`);
// A rugby union amateur's in-season session.
const rugby = [
  { exercise_id: "countermovement_jump", sets: 3, reps: 3, intensity: { type: "bodyweight" } },
  { exercise_id: "trap_bar_deadlift", sets: 3, reps: 4, intensity: { type: "percent_1rm", value: 82.5 } },
  { exercise_id: "bulgarian_split_squat", sets: 2, reps: 6, intensity: { type: "rpe", value: 9 } },
  { exercise_id: "nordic_curl", sets: 2, reps: 4, intensity: { type: "bodyweight" } },
  { exercise_id: "bench_press", sets: 3, reps: 5, intensity: { type: "percent_1rm", value: 80 } },
  { exercise_id: "pallof_press", sets: 2, reps: 10, intensity: { type: "rpe", value: 8 } }
];
const saturdays = { match_days: ["sat"], fixtures: [] };

test("match week: a rugby player's Friday session before a Saturday match has no heavy leg work - just a primer", () => {
  const context = matchContextFor(saturdays, on("2026-10-02"));
  assert.deepEqual(context, { role: "day_before", match_date: "2026-10-03", label: "Match day" });
  const friday = applyMatchWeek(rugby, context, patternOf);
  const ids = friday.map((e) => e.exercise_id);
  for (const legs of ["trap_bar_deadlift", "bulgarian_split_squat", "nordic_curl"]) assert.ok(!ids.includes(legs), `${legs} is out on MD-1`);
  const jump = friday.find((e) => e.exercise_id === "countermovement_jump");
  assert.equal(jump.sets, 2, "jumps kept as a short primer");
  const bench = friday.find((e) => e.exercise_id === "bench_press");
  assert.deepEqual([bench.sets, bench.intensity.value], [2, 75], "upper body a notch lighter");
  assert.ok(friday.every((e) => e.match_week.role === "day_before"));
});

test("match week: the Sunday after is recovery - half the sets, easy effort, no jumps", () => {
  const sunday = applyMatchWeek(rugby, matchContextFor(saturdays, on("2026-10-04")), patternOf);
  assert.ok(!sunday.some((e) => e.exercise_id === "countermovement_jump"), "no jumps the day after");
  const deadlift = sunday.find((e) => e.exercise_id === "trap_bar_deadlift");
  assert.deepEqual([deadlift.sets, deadlift.intensity.value], [2, 67.5]);
  const split = sunday.find((e) => e.exercise_id === "bulgarian_split_squat");
  assert.equal(split.intensity.value, 5, "RPE capped at 5");
});

test("match week: early in the week (MD-4) the session is untouched; a midweek fixture and match day itself are handled", () => {
  assert.equal(matchContextFor(saturdays, on("2026-09-30")), null, "Wednesday before a Saturday match");
  assert.equal(applyMatchWeek(rugby, null, patternOf), rugby);
  const midweek = { match_days: ["sat"], fixtures: [{ date: "2026-10-07", label: "Cup tie" }] };
  assert.deepEqual(matchContextFor(midweek, on("2026-10-06")), { role: "day_before", match_date: "2026-10-07", label: "Cup tie" });
  assert.equal(matchContextFor(saturdays, on("2026-10-03")).role, "match_day");
});

test("match week: a cyclist's all-leg session the day before a race leaves nothing - the caller refuses it rather than prescribe legs", () => {
  const legs = [
    { exercise_id: "trap_bar_deadlift", sets: 4, reps: 4, intensity: { type: "percent_1rm", value: 80.5 } },
    { exercise_id: "bulgarian_split_squat", sets: 3, reps: 6, intensity: { type: "rpe", value: 9 } }
  ];
  const race = { match_days: [], fixtures: [{ date: "2026-10-11", label: "Road race" }] };
  assert.deepEqual(applyMatchWeek(legs, matchContextFor(race, on("2026-10-10")), patternOf), []);
});

test("match week: saved match days and fixtures are validated; fixtures more than a week old are dropped", () => {
  const today = on("2026-09-27");
  const ok = validateMatchWeek({ match_days: ["sat", "wed"], fixtures: [{ date: "2026-10-07", label: " Cup  tie " }, { date: "2026-09-01", label: "Old" }] }, today);
  assert.deepEqual(ok, { ok: true, week: { match_days: ["wed", "sat"], fixtures: [{ date: "2026-10-07", label: "Cup tie" }] } });
  assert.equal(validateMatchWeek({ match_days: ["funday"], fixtures: [] }, today).ok, false);
  assert.equal(validateMatchWeek({ match_days: [], fixtures: [{ date: "2026-02-30" }] }, today).ok, false);
  assert.equal(validateMatchWeek({ match_days: [], fixtures: [], extra: 1 }, today).ok, false);
});
