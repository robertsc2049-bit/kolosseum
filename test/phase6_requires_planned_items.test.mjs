import test from "node:test";
import assert from "node:assert/strict";

import { phase6ProduceSessionOutput } from "../dist/engine/src/phases/phase6.js";

test("Phase6: empty plan returns deterministic empty shell", async () => {
  const res = phase6ProduceSessionOutput({}, {}, undefined);
  assert.equal(res.ok, true);
  assert.equal(res.session.session_id, "SESSION_STUB");
  assert.deepEqual(res.session.exercises, []);
  assert.deepEqual(res.notes, ["PHASE_6_STUB: deterministic empty session shell"]);
});

test("Phase6: legacy plan is forbidden (planned_exercise_ids)", async () => {
  const program = { planned_exercise_ids: ["bench_press"] };
  const res = phase6ProduceSessionOutput(program, {}, undefined);

  assert.equal(res.ok, false);
  assert.equal(res.failure_token, "phase6_requires_planned_items");
  assert.deepEqual(res.details, { required: "planned_items", saw: "planned_exercise_ids" });
});

test("Phase6: planned_items plan is accepted", async () => {
  const program = {
    planned_items: [
      {
        block_id: "B0",
        item_id: "B0_I0",
        exercise_id: "bench_press",
        sets: 3,
        reps: 5,
        rest_seconds: 180
      }
    ]
  };

  const res = phase6ProduceSessionOutput(program, {}, undefined);
  assert.equal(res.ok, true);
  assert.equal(res.session.session_id, "SESSION_V1");
  assert.equal(Array.isArray(res.session.exercises), true);
  assert.equal(res.session.exercises.length, 1);
  assert.equal(res.session.exercises[0].exercise_id, "bench_press");
});

test("Phase6: substitution note appears only when an actual id changes", async () => {
  const program = {
    planned_items: [
      { block_id: "B0", item_id: "B0_I0", exercise_id: "bench_press", sets: 3, reps: 5 },
      { block_id: "B0", item_id: "B0_I1", exercise_id: "back_squat", sets: 3, reps: 5 }
    ]
  };

  // Phase5-like object that substitutes bench_press -> dumbbell_bench_press
  const p5 = {
    ok: true,
    adjustments: [
      {
        adjustment_id: "SUBSTITUTE_EXERCISE",
        applied: true,
        details: {
          target_exercise_id: "bench_press",
          substitute_exercise_id: "dumbbell_bench_press"
        }
      }
    ]
  };

  const res = phase6ProduceSessionOutput(program, {}, p5);

  assert.equal(res.ok, true);
  assert.equal(res.session.session_id, "SESSION_V1");

  // Note must reflect real substitution
  assert.deepEqual(res.notes, ["PHASE_6: emitted session from planned_items with Phase5 substitutions (deduped)"]);

  // bench_press must be swapped and traced
  assert.equal(res.session.exercises[0].exercise_id, "dumbbell_bench_press");
  assert.equal(res.session.exercises[0].substituted_from, "bench_press");

  // back_squat remains unchanged
  assert.equal(res.session.exercises[1].exercise_id, "back_squat");
  assert.ok(!("substituted_from" in res.session.exercises[1]));
});
