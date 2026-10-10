// A self-directed athlete's own sessions warm up for what they train and cool
// down after it (src/api/session_bookends.ts, shared/session-bookends).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { sessionBookends } from "../shared/session-bookends/sessionBookends.mjs";

const REGISTRY = JSON.parse(fs.readFileSync("registries/exercise/exercise.registry.json", "utf8")).entries;
const patternOf = (id) => REGISTRY[id]?.movement_pattern_id ?? "";
const ids = (items) => items.map((i) => i.exercise_id);

test("a squat-and-deadlift day warms the hips and hamstrings and stretches them after; a bench-and-row day the shoulders, chest and lats", () => {
  const lower = sessionBookends(["back_squat", "deadlift", "walking_lunge"], patternOf);
  assert.deepEqual(ids(lower.warm_up), ["worlds_greatest_stretch", "leg_swing", "open_close_gate"]);
  assert.deepEqual(ids(lower.cool_down), ["kneeling_hip_flexor_stretch", "lying_hamstring_stretch"]);
  const upper = sessionBookends(["bench_press", "barbell_row", "overhead_press"], patternOf);
  assert.deepEqual(ids(upper.warm_up), ["arm_circles", "quadruped_thoracic_rotation", "cat_cow"]);
  assert.deepEqual(ids(upper.cool_down), ["doorway_chest_stretch", "kneeling_lat_stretch"]);
});

test("a rugby speed day opens the hamstrings before sprinting and stretches the calves after; a grip day stretches the wrists", () => {
  const speed = sessionBookends(["ten_metre_acceleration", "box_jump", "trap_bar_deadlift"], patternOf);
  assert.ok(ids(speed.warm_up).includes("walking_straight_leg_kick"));
  assert.ok(ids(speed.cool_down).includes("wall_calf_stretch"));
  const grip = sessionBookends(["gripper_close", "pinch_block_hold", "deadlift"], patternOf);
  assert.ok(ids(grip.cool_down).includes("wrist_flexor_stretch"));
});

test("every drill and stretch is unloaded mobility work, the warm-up ramps into the first set, and a long session stays within 12", () => {
  const { warm_up, cool_down } = sessionBookends(["back_squat", "bench_press"], patternOf);
  for (const item of [...warm_up, ...cool_down]) assert.equal(REGISTRY[item.exercise_id].movement_pattern_id, "mobility", item.exercise_id);
  assert.match(warm_up.at(-1).note, /build up to your first working set/u);
  assert.ok(cool_down.every((i) => i.seconds === 45));
  const nine = ["back_squat", "bench_press", "deadlift", "barbell_row", "overhead_press", "pull_up", "dip", "lunge", "front_plank"];
  const long = sessionBookends(nine, patternOf);
  assert.ok(nine.length + long.warm_up.length + long.cool_down.length <= 12);
  assert.ok(long.warm_up.length >= 1 && long.cool_down.length >= 1);
  assert.deepEqual(sessionBookends(["arm_circles", "bench_press"], patternOf).warm_up.map((i) => i.exercise_id).includes("arm_circles"), false, "never an exercise already in the session");
});
