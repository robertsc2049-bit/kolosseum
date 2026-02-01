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
