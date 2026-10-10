// Every exercise in the library is filed under the muscles it trains, so a
// coach can pick exercises by muscle group (src/api/exercise_muscles.ts).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { EXERCISE_MUSCLES, MUSCLES, MUSCLE_GROUPS, PATTERN_MUSCLES, exerciseMuscleFields, exerciseMuscleSummary } from "../dist/src/api/exercise_muscles.js";

const REGISTRY = JSON.parse(fs.readFileSync("registries/exercise/exercise.registry.json", "utf8")).entries;
const groupsOf = (id) => exerciseMuscleSummary(id, REGISTRY[id]?.movement_pattern_id).muscle_groups;

test("every exercise in the library has target muscles, and every muscle belongs to a muscle group", () => {
  const groupIds = new Set(MUSCLE_GROUPS.map((g) => g.id));
  for (const muscle of Object.values(MUSCLES)) assert.ok(groupIds.has(muscle.group), muscle.label);
  for (const [id, entry] of Object.entries(REGISTRY)) {
    const summary = exerciseMuscleSummary(id, entry.movement_pattern_id);
    assert.ok(summary.target_muscles.length > 0, `${id} has no target muscles`);
    for (const muscle of [...summary.target_muscles, ...summary.secondary_muscles]) assert.ok(MUSCLES[muscle], `${id}: unknown muscle ${muscle}`);
    assert.ok(summary.muscle_groups.length > 0, `${id} is in no muscle group`);
  }
  for (const [pattern, muscles] of Object.entries(PATTERN_MUSCLES)) {
    for (const muscle of [...muscles.target, ...muscles.secondary]) assert.ok(MUSCLES[muscle], `${pattern}: unknown muscle ${muscle}`);
  }
  for (const id of Object.keys(EXERCISE_MUSCLES)) assert.ok(REGISTRY[id], `${id} has muscles but isn't in the exercise registry`);
});

test("a coach looking for quad, hamstring, chest, back and rear-delt work finds the exercises they'd expect", () => {
  for (const id of ["back_squat", "front_squat", "leg_press", "hack_squat", "leg_extension", "bulgarian_split_squat"]) assert.ok(groupsOf(id).includes("quads"), `${id} is quad work`);
  for (const id of ["romanian_deadlift", "nordic_curl", "seated_leg_curl", "glute_ham_raise", "good_morning"]) assert.ok(groupsOf(id).includes("hamstrings"), `${id} is hamstring work`);
  for (const id of ["bench_press", "dumbbell_bench_press", "push_up", "dip"]) assert.ok(groupsOf(id).includes("chest"), `${id} is chest work`);
  for (const id of ["pull_up", "chin_up", "lat_pulldown", "barbell_row", "seated_cable_row"]) assert.ok(groupsOf(id).includes("back"), `${id} is back work`);
  for (const id of ["face_pull", "dumbbell_reverse_fly"]) assert.ok(groupsOf(id).includes("shoulders"), `${id} trains the rear delts`);
  assert.deepEqual(groupsOf("hammer_curl"), ["forearms_grip", "biceps"], "a hammer curl leads with brachioradialis and brachialis");
  assert.ok(groupsOf("close_grip_bench_press").includes("triceps"), "close-grip bench is a triceps lift");
  assert.ok(groupsOf("seated_calf_raise").includes("calves_shins"));
  assert.ok(groupsOf("copenhagen_plank").includes("adductors"));
});

test("a quad filter doesn't list a deadlift or a row, and conditioning stays out of the muscle groups", () => {
  assert.ok(!groupsOf("romanian_deadlift").includes("quads"));
  assert.ok(!groupsOf("barbell_row").includes("quads"));
  assert.deepEqual(groupsOf("bike_ergometer"), ["conditioning"], "a bike erg is conditioning, not a quad exercise");
  assert.deepEqual(groupsOf("rowing_ergometer"), ["conditioning"]);
});

test("a repeat of an exercise in a session has the same muscles; an athlete's own exercise has none unless its slot's pattern is known", () => {
  assert.deepEqual(exerciseMuscleSummary("back_squat__r2", "squat"), exerciseMuscleSummary("back_squat", "squat"));
  assert.deepEqual(exerciseMuscleSummary("custom_zercher_lunge", undefined).muscle_groups, []);
  assert.ok(exerciseMuscleSummary("custom_zercher_lunge", "single_leg_squat").muscle_groups.includes("quads"));
});

test("pickers show muscles by name", () => {
  const fields = exerciseMuscleFields("romanian_deadlift", "hinge");
  assert.deepEqual(fields.target_muscles, ["Hamstrings", "Glute max"]);
  assert.ok(fields.secondary_muscles.includes("Spinal erectors"));
});

test("the app's muscle-group list matches the server's", () => {
  const source = fs.readFileSync("public/app-src/utils/muscleGroups.ts", "utf8");
  const client = [...source.matchAll(/\{ id: "([a-z_]+)", label: "([^"]+)" \}/g)].map(([, id, label]) => ({ id, label }));
  assert.deepEqual(client, MUSCLE_GROUPS.map((g) => ({ id: g.id, label: g.label })));
});

test("coaches see each exercise by its real name - 'Romanian deadlift', 'Cable fly (crossover)' - not one built from its id", async () => {
  const { listActiveExerciseOptions } = await import("../dist/src/api/beta18_programme_template_service.js");
  const byId = Object.fromEntries(listActiveExerciseOptions().exercises.map((e) => [e.exercise_id, e.display_name]));
  assert.equal(byId.romanian_deadlift, "Romanian deadlift");
  assert.equal(byId.cable_fly, "Cable fly (crossover)");
  assert.equal(byId.worlds_greatest_stretch, "World's greatest stretch");
  assert.equal(byId.pull_up, REGISTRY.pull_up.display_label);
  for (const [id, name] of Object.entries(byId)) assert.equal(name, REGISTRY[id].display_label, id);
});
