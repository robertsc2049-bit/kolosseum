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
  assert.deepEqual(res.notes, ["PHASE_6: emitted session from planned_items with Phase5 substitutions (deduped)"]);

  assert.equal(res.session.exercises[0].exercise_id, "dumbbell_bench_press");
  assert.equal(res.session.exercises[0].substituted_from, "bench_press");

  assert.equal(res.session.exercises[1].exercise_id, "back_squat");
  assert.ok(!("substituted_from" in res.session.exercises[1]));
});

test("Phase6: multi-substitution is deterministic and order-dependent", async () => {
  const program = {
    planned_items: [{ block_id: "B0", item_id: "B0_I0", exercise_id: "bench_press", sets: 3, reps: 5 }]
  };

  // Order A: bench -> db, then db -> push_up  => final push_up
  const p5A = {
    ok: true,
    adjustments: [
      {
        adjustment_id: "SUBSTITUTE_EXERCISE",
        applied: true,
        details: { target_exercise_id: "bench_press", substitute_exercise_id: "dumbbell_bench_press" }
      },
      {
        adjustment_id: "SUBSTITUTE_EXERCISE",
        applied: true,
        details: { target_exercise_id: "dumbbell_bench_press", substitute_exercise_id: "push_up" }
      }
    ]
  };

  const resA = phase6ProduceSessionOutput(program, {}, p5A);
  assert.equal(resA.ok, true);
  assert.deepEqual(resA.notes, ["PHASE_6: emitted session from planned_items with Phase5 substitutions (deduped)"]);
  assert.equal(resA.session.exercises.length, 1);
  assert.equal(resA.session.exercises[0].exercise_id, "push_up");
  assert.equal(resA.session.exercises[0].substituted_from, "bench_press");

  // Order B: db -> push_up, then bench -> db  => final dumbbell_bench_press (first rule doesn't apply)
  const p5B = {
    ok: true,
    adjustments: [
      {
        adjustment_id: "SUBSTITUTE_EXERCISE",
        applied: true,
        details: { target_exercise_id: "dumbbell_bench_press", substitute_exercise_id: "push_up" }
      },
      {
        adjustment_id: "SUBSTITUTE_EXERCISE",
        applied: true,
        details: { target_exercise_id: "bench_press", substitute_exercise_id: "dumbbell_bench_press" }
      }
    ]
  };

  const resB = phase6ProduceSessionOutput(program, {}, p5B);
  assert.equal(resB.ok, true);
  assert.deepEqual(resB.notes, ["PHASE_6: emitted session from planned_items with Phase5 substitutions (deduped)"]);
  assert.equal(resB.session.exercises.length, 1);
  assert.equal(resB.session.exercises[0].exercise_id, "dumbbell_bench_press");
  assert.equal(resB.session.exercises[0].substituted_from, "bench_press");
});

test("Phase6: dedupe collisions are deterministic and preserve trace of the first item", async () => {
  const program = {
    planned_items: [
      { block_id: "B0", item_id: "B0_I0", exercise_id: "bench_press", sets: 3, reps: 5 },
      { block_id: "B0", item_id: "B0_I1", exercise_id: "dumbbell_bench_press", sets: 2, reps: 12 }
    ]
  };

  // bench_press -> dumbbell_bench_press creates a collision with the second planned item.
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
  assert.deepEqual(res.notes, ["PHASE_6: emitted session from planned_items with Phase5 substitutions (deduped)"]);

  // Dedupe: keep the FIRST occurrence deterministically.
  assert.equal(res.session.exercises.length, 1);
  assert.equal(res.session.exercises[0].exercise_id, "dumbbell_bench_press");

  // Trace must refer to the first item's original (bench_press), not the second item.
  assert.equal(res.session.exercises[0].substituted_from, "bench_press");

  // The preserved prescription fields must come from the first item (3x5), not the second (2x12).
  assert.equal(res.session.exercises[0].item_id, "B0_I0");
  assert.equal(res.session.exercises[0].sets, 3);
  assert.equal(res.session.exercises[0].reps, 5);
});
