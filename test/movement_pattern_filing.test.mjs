// Exercises are filed under the movement a coach would put them in - the
// pattern decides what a programme slot recommends and what substitutes for it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const REGISTRY = JSON.parse(fs.readFileSync("registries/exercise/exercise.registry.json", "utf8")).entries;
const SUBS = Object.values(JSON.parse(fs.readFileSync("registries/substitution/substitution.registry.json", "utf8")).entries);
const pattern = (id) => REGISTRY[id].movement_pattern_id;
const subsOf = (id) => SUBS.filter((e) => e.source_exercise_id === id).map((e) => e.target_exercise_id);

test("an upright row is side-delt and trap work, so it never stands in for a pull-up or a pulldown", () => {
  for (const id of ["upright_row", "cable_upright_row", "dumbbell_upright_row"]) assert.equal(pattern(id), "shoulder_abduction_isolation", id);
  for (const id of ["pull_up", "chin_up", "lat_pulldown"]) assert.ok(!subsOf(id).some((t) => t.includes("upright_row")), `${id} substitutes`);
});

test("split squats are single-leg work: they swap with lunges, not with a back squat", () => {
  for (const id of ["split_squat", "smith_machine_split_squat", "single_leg_press"]) assert.equal(pattern(id), "single_leg_squat", id);
  assert.ok(subsOf("split_squat").includes("reverse_lunge"));
  assert.ok(!subsOf("back_squat").includes("split_squat"));
});

test("jumping jacks, high knees, butt kicks and mountain climbers are conditioning, so a plyometric jump slot never gets them", () => {
  for (const id of ["jumping_jack", "high_knees", "butt_kicks", "mountain_climber"]) assert.equal(pattern(id), "conditioning_cyclical", id);
  for (const id of ["box_jump", "countermovement_jump", "depth_jump"]) assert.ok(!subsOf(id).some((t) => ["jumping_jack", "high_knees", "butt_kicks", "mountain_climber"].includes(t)), id);
});

test("an inverted shrug pulls the shoulder blades back", () => {
  assert.equal(pattern("inverted_shrug"), "scapular_retraction");
});
