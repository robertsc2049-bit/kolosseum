// Quick build goals for people not training for a sport: build muscle,
// general fitness and lose fat, laid over the engine's general sessions.
import assert from "node:assert/strict";
import test from "node:test";

import { percentForRpe, shapeGeneralSession } from "../dist/src/api/general_training_goals.js";

const item = (exercise_id, role, extra = {}) => ({
  exercise_id, role, planned_sets: 3, prescription_mode: "reps", rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
  load_mode: "percent_1rm", percent_1rm: 75, rpe_value: 7, rest_seconds: 180, ...extra
});
const session = [item("back_squat", "primary"), item("lat_pulldown", "accessory"), item("push_up", "accessory", { load_mode: "bodyweight" }), item("side_plank", "accessory", { prescription_mode: "duration", load_mode: "bodyweight" })];
const context = (extra) => ({ shape: "muscle", blockIndex: 0, week: 1, sessionIndex: 0, level: "amateur", weights: "percent_1rm", equipment: "full_gym", percentLift: (id) => id === "back_squat", ...extra });

test("% of max leaves the right reps in reserve at the top of the range", () => {
  assert.equal(percentForRpe(8, 8), 75);
  assert.equal(percentForRpe(7, 12), 65);
  assert.equal(percentForRpe(10, 1), 85);
});

test("build muscle: more sets in the 6-12 range, heavier every other block, a deload in week 4", () => {
  const [squat, pulldown, pushUp, plank] = shapeGeneralSession(session, context());
  assert.deepEqual([squat.planned_sets, squat.rep_min, squat.rep_max, squat.load_mode], [4, 8, 12, "percent_1rm"]);
  assert.deepEqual([pulldown.planned_sets, pulldown.rep_min, pulldown.rep_max, pulldown.load_mode, pulldown.rpe_value], [3, 10, 15, "rpe", 7]);
  assert.equal(pushUp.load_mode, "bodyweight");
  const goblet = shapeGeneralSession([item("goblet_squat", "primary")], context())[0];
  assert.deepEqual([goblet.load_mode, goblet.rpe_value], ["rpe", 7], "% of max only for barbell lifts");
  assert.deepEqual([plank.prescription_mode, plank.planned_sets], ["duration", 3]);
  const heavier = shapeGeneralSession(session, context({ blockIndex: 1, week: 3 }))[0];
  assert.deepEqual([heavier.rep_min, heavier.rep_max], [6, 8]);
  assert.ok(heavier.percent_1rm > squat.percent_1rm);
  assert.equal(shapeGeneralSession(session, context({ week: 4 }))[0].planned_sets, 2);
  assert.equal(shapeGeneralSession(session, context()).length, 4, "no conditioning added");
});

test("beginners: no % of max, nothing above RPE 7, at most 3 sets", () => {
  for (const shape of ["muscle", "fitness", "fat_loss"]) {
    for (const week of [1, 2, 3, 4]) {
      const shaped = shapeGeneralSession(session, context({ shape, week, level: "beginner" }));
      assert.ok(shaped.every((w) => w.load_mode !== "percent_1rm"), `${shape} week ${week}`);
      assert.ok(shaped.filter((w) => w.load_mode === "rpe").every((w) => w.rpe_value <= 7), `${shape} week ${week}`);
      assert.ok(shaped.filter((w) => w.prescription_mode === "reps").every((w) => w.planned_sets <= 3), `${shape} week ${week}`);
    }
  }
});

test("fitness and fat loss end every session with conditioning: intervals, then steady work", () => {
  const last = (extra) => shapeGeneralSession(session, context(extra)).at(-1);
  assert.deepEqual([last({ shape: "fitness" }).exercise_id, last({ shape: "fitness" }).planned_sets, last({ shape: "fitness" }).planned_duration_seconds], ["rowing_ergometer", 6, 30]);
  assert.deepEqual([last({ shape: "fitness", sessionIndex: 1 }).exercise_id, last({ shape: "fitness", sessionIndex: 1 }).planned_duration_seconds], ["bike_ergometer", 720]);
  assert.ok(last({ shape: "fat_loss", sessionIndex: 1 }).planned_duration_seconds > last({ shape: "fitness", sessionIndex: 1 }).planned_duration_seconds, "more for fat loss");
  assert.equal(last({ shape: "fitness", equipment: "bodyweight" }).exercise_id, "burpee");
  assert.equal(last({ shape: "fitness", equipment: "home_gym", level: "beginner" }).exercise_id, "jumping_jack");
  assert.equal(last({ shape: "fat_loss", equipment: "home_gym", sessionIndex: 3 }).exercise_id, "brisk_walk");
  assert.ok(last({ shape: "fitness", week: 4 }).planned_sets < last({ shape: "fitness", week: 3 }).planned_sets, "deload week");
});
