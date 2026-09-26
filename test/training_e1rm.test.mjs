// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import { computeTrainingE1rmTrends, epleyE1rm, isE1rmExercise, setE1rmKg } from "../dist/src/api/training_e1rm.js";

const REGISTRY = JSON.parse(fs.readFileSync("registries/exercise/exercise.registry.json", "utf8")).entries;
const patternOf = (id) => REGISTRY[id]?.movement_pattern_id;

const set = (exercise_id, reps, load_value, date = "2026-09-20", load_unit = "kg") => ({ exercise_id, reps, load_value, load_unit, date });

test("training e1RM: Epley, with a single as its own max", () => {
  assert.equal(epleyE1rm(140, 1), 140);
  assert.equal(Math.round(epleyE1rm(144, 3) * 10) / 10, 158.4, "powerlifter squat 3 @ 144 kg");
  assert.equal(Math.round(epleyE1rm(100, 10) * 10) / 10, 133.3);
});

test("training e1RM: failed sets, sets past 10 reps and assisted-only sets never estimate a max", () => {
  assert.equal(setE1rmKg(set("back_squat", 0, 150), null), null, "a failed set is not a max");
  assert.equal(setE1rmKg(set("goblet_squat", 15, 32), null), null, "15 reps is too far from a single");
  assert.equal(setE1rmKg(set("band_assisted_pull_up", 5, -20), null), null, "assistance with no bodyweight is not a max");
  assert.ok(setE1rmKg(set("back_squat", 10, 100), null));
});

test("training e1RM: street lifting weighted pull-ups and dips count bodyweight plus added load", () => {
  const pull = setE1rmKg(set("pull_up", 1, 40), 80);
  assert.deepEqual(pull, { e1rm_kg: 120, includes_bodyweight: true }, "80 kg athlete + 40 kg = 120 kg single");
  const noBw = setE1rmKg(set("pull_up", 1, 40), null);
  assert.deepEqual(noBw, { e1rm_kg: 40, includes_bodyweight: false }, "without bodyweight, only the added load (flagged)");
  const assisted = setE1rmKg(set("band_assisted_pull_up", 3, -20), 80);
  assert.equal(Math.round(assisted.e1rm_kg * 10) / 10, 66, "assistance reduces the system load");
  const squat = setE1rmKg(set("back_squat", 1, 180), 80);
  assert.deepEqual(squat, { e1rm_kg: 180, includes_bodyweight: false }, "barbell lifts never add bodyweight");
});

test("training e1RM: the best set of each day forms the trend, and the change is against 30+ days earlier", () => {
  const trends = computeTrainingE1rmTrends([
    set("back_squat", 5, 130, "2026-08-10"), set("back_squat", 3, 140, "2026-08-10"),
    set("back_squat", 3, 144, "2026-09-20"), set("back_squat", 0, 150, "2026-09-20"),
    set("bench_press", 5, 100, "2026-09-20")
  ], null, "kg", 30, patternOf);
  const squat = trends.find((t) => t.exercise_id === "back_squat");
  assert.deepEqual(squat.series.map((p) => [p.date, p.e1rm]), [["2026-08-10", 154], ["2026-09-20", 158.4]]);
  assert.equal(squat.current_e1rm, 158.4);
  assert.equal(squat.prior_e1rm, 154);
  assert.equal(squat.delta, 4.4);
  assert.equal(squat.delta_percentage, 2.9);
  assert.equal(squat.method, "epley");
  const bench = trends.find((t) => t.exercise_id === "bench_press");
  assert.equal(bench.has_prior_value, false, "no training 30+ days earlier");
});

test("training e1RM: pounds convert, and the display unit is the athlete's", () => {
  const [lb] = computeTrainingE1rmTrends([set("deadlift", 1, 500, "2026-09-20", "lb")], null, "kg", 30, patternOf);
  assert.equal(lb.current_e1rm, 226.8);
  const [kgInLb] = computeTrainingE1rmTrends([set("deadlift", 1, 200, "2026-09-20")], null, "lb", 30, patternOf);
  assert.equal(kgInLb.current_e1rm, 440.9);
  assert.equal(kgInLb.unit, "lb");
});

test("training e1RM: only strength lifts estimate a max - never jumps, sprints, throws, carries, swings or curls", () => {
  for (const id of ["back_squat", "deadlift", "snatch", "bench_press", "pull_up", "dip", "bulgarian_split_squat", "strongman_log_press", "barbell_row"]) {
    assert.equal(isE1rmExercise(id, patternOf), true, id);
  }
  for (const id of ["countermovement_jump", "ten_metre_acceleration", "medicine_ball_rotational_throw", "farmers_carry", "kettlebell_swing", "barbell_curl", "sled_push", "self_resisted_neck_isometric"]) {
    assert.equal(isE1rmExercise(id, patternOf), false, id);
  }
  const trends = computeTrainingE1rmTrends([set("countermovement_jump", 3, 150), set("back_squat", 3, 150)], null, "kg", 30, patternOf);
  assert.deepEqual(trends.map((t) => t.exercise_id), ["back_squat"]);
});
