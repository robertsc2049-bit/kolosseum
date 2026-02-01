import test from "node:test";
import assert from "node:assert/strict";
import { phase6ProduceSessionOutput } from "../dist/engine/src/phases/phase6.js";

test("Phase6 legacy exercises[] preserve prescription metadata (DEPRECATED PATH: now forbidden)", () => {
  // This test used to assert legacy support. Phase6 is now planned_items-only.
  const program = {
    exercises: [
      { exercise_id: "bench_press", sets: 3, reps: 5, rest_seconds: 120 }
    ]
  };
  const r = phase6ProduceSessionOutput(program, {}, undefined);
  assert.equal(r.ok, false);
  assert.equal(r.failure_token, "phase6_requires_planned_items");
  assert.deepEqual(r.details, { required: "planned_items", saw: "exercises" });
});

test("Phase6 planned_items preserves prescription metadata deterministically", () => {
  const program = {
    planned_items: [
      {
        block_id: "B0",
        item_id: "B0_I0",
        exercise_id: "bench_press",
        sets: 3,
        reps: 5,
        rest_seconds: 120,
        intensity: { type: "percent_1rm", value: 75 }
      }
    ]
  };

  const r = phase6ProduceSessionOutput(program, {}, undefined);
  assert.equal(r.ok, true);
  const ex = r.session.exercises[0];
  assert.equal(ex.exercise_id, "bench_press");
  assert.equal(ex.sets, 3);
  assert.equal(ex.reps, 5);
  assert.equal(ex.rest_seconds, 120);
  assert.deepEqual(ex.intensity, { type: "percent_1rm", value: 75 });
});