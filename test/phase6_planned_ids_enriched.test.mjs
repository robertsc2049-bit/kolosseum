import test from "node:test";
import assert from "node:assert/strict";
import { phase6ProduceSessionOutput } from "../dist/engine/src/phases/phase6.js";

test("Phase6 planned_exercise_ids enriched from exercises[] metadata (DEPRECATED PATH: now forbidden)", () => {
  // This test used to assert an enrichment bridge. Phase6 is now planned_items-only.
  const program = {
    planned_exercise_ids: ["squat"],
    exercises: [{ exercise_id: "squat", sets: 5, reps: 5 }]
  };
  const r = phase6ProduceSessionOutput(program, {}, undefined);
  assert.equal(r.ok, false);
  assert.equal(r.failure_token, "phase6_requires_planned_items");
  assert.deepEqual(r.details, { required: "planned_items", saw: "planned_exercise_ids" });
});

test("Phase6 planned_items accepts rich items directly (no enrichment needed)", () => {
  const program = {
    planned_items: [{ block_id: "B0", item_id: "B0_I0", exercise_id: "squat", sets: 5, reps: 5 }]
  };
  const r = phase6ProduceSessionOutput(program, {}, undefined);
  assert.equal(r.ok, true);
  assert.equal(r.session.exercises.length, 1);
  assert.equal(r.session.exercises[0].exercise_id, "squat");
  assert.equal(r.session.exercises[0].sets, 5);
  assert.equal(r.session.exercises[0].reps, 5);
});