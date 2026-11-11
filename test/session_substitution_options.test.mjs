// The session screen's swap choices (substitutionOptions in
// session_substitution_registry.ts) against the real registries: the kit an
// exercise actually needs, so a busy cable stack or a missing bench can be
// said - not just barbell/dumbbell/kettlebell - and main lifts say why
// they're never swapped.
import assert from "node:assert/strict";
import test from "node:test";

import { buildV1SubstitutionInput, exerciseDisplayLabel, substitutionOptions } from "../dist/src/api/session_substitution_registry.js";

const swapFor = (exerciseId, activityId, busy) =>
  buildV1SubstitutionInput(exerciseId, busy, activityId, null)?.substitution_edges.map((edge) => edge.target_exercise_id);

test("a lat pulldown with the cable stack taken is swapped to a machine pulldown", () => {
  const options = substitutionOptions("lat_pulldown", "general_strength");
  assert.deepEqual(options.equipment, [{ equipment_id: "cable_machine", label: "Cable machine" }]);
  assert.equal(options.has_substitutes, true);
  assert.deepEqual(swapFor("lat_pulldown", "general_strength", ["cable_machine"]), ["machine_pulldown"]);
  assert.equal(exerciseDisplayLabel("machine_pulldown"), "Machine pulldown");
});

test("paused bench with no free bench is a floor press; with the rack taken, dumbbells", () => {
  const options = substitutionOptions("paused_bench_press", "powerlifting");
  assert.deepEqual(options.equipment.map((entry) => entry.label), ["Barbell", "Bench", "Rack"]);
  assert.deepEqual(swapFor("paused_bench_press", "powerlifting", ["bench"]), ["floor_press"]);
  assert.deepEqual(swapFor("paused_bench_press", "powerlifting", ["rack"]), ["dumbbell_bench_press"]);
});

test("no pull-up bar: ring pull-ups", () => {
  assert.deepEqual(substitutionOptions("pull_up", "general_strength").equipment.map((entry) => entry.label), ["Pull-up bar"]);
  assert.deepEqual(swapFor("pull_up", "general_strength", ["pull_up_bar"]), ["ring_pull_up"]);
});

test("the main lifts are never swapped, in any sport, and say so", () => {
  for (const [exerciseId, activityId] of [["back_squat", "powerlifting"], ["bench_press", "powerlifting"], ["deadlift", "rugby_union"]]) {
    assert.deepEqual(substitutionOptions(exerciseId, activityId), { equipment: [], has_substitutes: false, main_lift: true }, `${exerciseId} ${activityId}`);
  }
});

test("an athlete's own exercise or an unknown id has nothing to swap", () => {
  assert.deepEqual(substitutionOptions("custom_sled_drag", "powerlifting"), { equipment: [], has_substitutes: false });
  assert.deepEqual(substitutionOptions("", "powerlifting"), { equipment: [], has_substitutes: false });
});
