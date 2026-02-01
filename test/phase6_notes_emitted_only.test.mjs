import test from "node:test";
import assert from "node:assert/strict";
import { phase6ProduceSessionOutput } from "../dist/engine/src/phases/phase6.js";

test("Phase6 notes: substitutions are claimed only if a substituted exercise is emitted", () => {
  // planned_items: first item already dumbbell_bench_press.
  // second item bench_press is substituted -> dumbbell_bench_press, but dedupe drops it.
  // Therefore: no emitted exercise should have substituted_from, and notes must NOT claim substitutions.
  const program = {
    planned_items: [
      { block_id: "B0", item_id: "B0_I0", exercise_id: "dumbbell_bench_press", sets: 3, reps: 5 },
      { block_id: "B0", item_id: "B0_I1", exercise_id: "bench_press", sets: 3, reps: 5 }
    ]
  };

  const p5 = {
    ok: true,
    adjustments: [
      {
        adjustment_id: "SUBSTITUTE_EXERCISE",
        applied: true,
        details: { target_exercise_id: "bench_press", substitute_exercise_id: "dumbbell_bench_press" }
      }
    ]
  };

  const res = phase6ProduceSessionOutput(program, {}, p5);
  assert.equal(res.ok, true);

  assert.equal(res.session.session_id, "SESSION_V1");
  assert.equal(Array.isArray(res.session.exercises), true);
  assert.equal(res.session.exercises.length, 1);
  assert.equal(res.session.exercises[0].exercise_id, "dumbbell_bench_press");
  assert.ok(!("substituted_from" in res.session.exercises[0]), "substituted_from must not exist on emitted exercise");

  assert.deepEqual(res.notes, ["PHASE_6: emitted session from planned_items (deduped)"]);
});