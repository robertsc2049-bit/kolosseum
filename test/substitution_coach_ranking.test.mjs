// A missing piece of equipment swaps an exercise for the one a coach would
// pick: the same kind of training, the closest variation, then the lighter kit
// (registries/substitution ordering + src/api/session_substitution_registry.ts).
import test from "node:test";
import assert from "node:assert/strict";

import { buildV1SubstitutionInput } from "../dist/src/api/session_substitution_registry.js";
import { tryBuildV1SubstitutionResult } from "../src/v1SubstitutionEngineContract.mjs";

const swap = (exerciseId, unavailable, activity = "general_strength") => {
  const input = buildV1SubstitutionInput(exerciseId, unavailable, activity);
  if (!input) return null;
  const outcome = tryBuildV1SubstitutionResult(input);
  return outcome.ok ? JSON.parse(outcome.result.canonical_json).target_exercise_id : null;
};

test("no barbell: an overhead press becomes a dumbbell overhead press - not a cable press or a pike push-up", () => {
  assert.equal(swap("overhead_press", ["barbell"]), "dumbbell_overhead_press");
});

test("no barbell: an incline press becomes an incline dumbbell press, an RDL a dumbbell RDL, a barbell row a dumbbell row", () => {
  assert.equal(swap("incline_bench_press", ["barbell"]), "incline_dumbbell_press");
  assert.equal(swap("romanian_deadlift", ["barbell"]), "dumbbell_romanian_deadlift");
  assert.match(swap("barbell_row", ["barbell"]) ?? "", /dumbbell_row|chest_supported_row/u);
});

test("no cable machine: a lat pulldown becomes another machine pulldown before anything else", () => {
  assert.equal(swap("lat_pulldown", ["cable_machine"]), "machine_pulldown");
});
