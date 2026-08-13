
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

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

test("Phase 6 emits group_id/group_type only for items that actually belong to a group", () => {
  const program = {
    planned_items: [
      { block_id: "B0", item_id: "B0_I0", exercise_id: "back_squat", sets: 3, reps: 5 },
      {
        block_id: "B0",
        item_id: "B0_I1",
        exercise_id: "bench_press",
        sets: 3,
        reps: 8,
        group_id: "group_1",
        group_type: "superset"
      },
      {
        block_id: "B0",
        item_id: "B0_I2",
        exercise_id: "overhead_press",
        sets: 3,
        reps: 8,
        group_id: "group_1",
        group_type: "superset"
      },
      { block_id: "B0", item_id: "B0_I3", exercise_id: "push_up", sets: 3, reps: 10, group_id: "group_2", group_type: "circuit" }
    ]
  };
  const r = phase6ProduceSessionOutput(program, {}, undefined);
  assert.equal(r.ok, true);
  assert.equal(r.session.exercises.length, 4);

  assert.equal(r.session.exercises[0].group_id, undefined, "ungrouped item must not carry group_id");
  assert.equal(r.session.exercises[0].group_type, undefined, "ungrouped item must not carry group_type");

  assert.equal(r.session.exercises[1].group_id, "group_1");
  assert.equal(r.session.exercises[1].group_type, "superset");
  assert.equal(r.session.exercises[2].group_id, "group_1");
  assert.equal(r.session.exercises[2].group_type, "superset");

  assert.equal(r.session.exercises[3].group_id, "group_2");
  assert.equal(r.session.exercises[3].group_type, "circuit");
});
