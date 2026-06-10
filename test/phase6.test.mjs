import test from "node:test";
import assert from "node:assert/strict";
import { phase6ProduceSessionOutput } from "../dist/engine/src/phases/phase6.js";

test("Phase 6 emits deterministic empty session shell (baseline)", () => {
  const r = phase6ProduceSessionOutput({}, {}, undefined);
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.session.exercises));
  assert.equal(r.session.session_id, "SESSION_STUB");
  assert.deepEqual(r.session.exercises, []);
  assert.deepEqual(r.notes, ["PHASE_6_STUB: deterministic empty session shell"]);
});

test("Phase 6 legacy program.exercises[] is forbidden (planned_items only)", () => {
  const program = { exercises: [{ exercise_id: "bench_press" }] };
  const r = phase6ProduceSessionOutput(program, {}, undefined);
  assert.equal(r.ok, false);
  assert.equal(r.failure_token, "phase6_requires_planned_items");
  assert.deepEqual(r.details, { required: "planned_items", saw: "exercises" });
});

test("Phase 6 planned_items emits session exercises deterministically", () => {
  const program = {
    planned_items: [
      { block_id: "B0", item_id: "B0_I0", exercise_id: "bench_press", sets: 3, reps: 5 }
    ]
  };
  const r = phase6ProduceSessionOutput(program, {}, undefined);
  assert.equal(r.ok, true);
  assert.equal(r.session.session_id, "SESSION_V1");
  assert.equal(r.session.exercises.length, 1);
  assert.equal(r.session.exercises[0].exercise_id, "bench_press");
  assert.deepEqual(r.notes, ["PHASE_6: emitted session from planned_items (deduped)"]);
});