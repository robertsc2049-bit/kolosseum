import test from "node:test";
import assert from "node:assert/strict";
import { phase6ProduceSessionOutput } from "../dist/engine/src/phases/phase6.js";

test("Phase 6 emits deterministic empty session shell (baseline)", () => {
  const r = phase6ProduceSessionOutput({}, {});
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.session.session_id, "SESSION_STUB");
    assert.equal(r.session.status, "ready");
    assert.ok(Array.isArray(r.session.exercises));
  }
});

test("Phase 6 emits session exercises from program.exercises[] (v1)", () => {
  const program = {
    exercises: [
      { exercise_id: "bench_press" },
      { exercise_id: "dumbbell_bench_press" }
    ]
  };

  const r = phase6ProduceSessionOutput(program, {});
  assert.equal(r.ok, true);

  if (r.ok) {
    assert.deepEqual(r.session.exercises, [
      { exercise_id: "bench_press", source: "program" },
      { exercise_id: "dumbbell_bench_press", source: "program" }
    ]);
  }
});
