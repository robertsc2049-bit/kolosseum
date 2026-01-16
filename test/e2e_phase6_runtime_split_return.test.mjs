import assert from "node:assert/strict";
import test from "node:test";

import { phase6ProduceSessionOutput } from "../dist/engine/src/phases/phase6.js";
import { applyRuntimeEvents } from "../dist/engine/src/runtime/apply_runtime_event.js";

/**
 * Canonical Phase 6 runtime behaviour tests.
 *
 * These tests define runtime truth.
 * Reducer implementation must satisfy them exactly.
 *
 * Phase 4/5 outputs are treated as immutable input.
 */

function baseProgram() {
  return {
    planned_items: [
      { exercise_id: "sq", sets: 3, reps: 5 },
      { exercise_id: "bp", sets: 3, reps: 5 },
      { exercise_id: "dl", sets: 1, reps: 5 }
    ]
  };
}

function baseSession() {
  const r = phase6ProduceSessionOutput(baseProgram(), {}, undefined);
  assert.equal(r.ok, true);
  return r.session;
}

test("Phase6 runtime: split → return continue preserves remaining work", () => {
  const session = baseSession();

  const events = [
    { type: "COMPLETE_EXERCISE", exercise_id: "sq" },
    { type: "SPLIT_SESSION" },
    { type: "RETURN_CONTINUE" }
  ];

  const state = applyRuntimeEvents(session, events);

  assert.deepEqual(
    state.completed_exercises.map(e => e.exercise_id),
    ["sq"]
  );

  assert.deepEqual(
    state.remaining_exercises.map(e => e.exercise_id),
    ["bp", "dl"]
  );

  assert.equal(state.dropped_exercises.length, 0);
});

test("Phase6 runtime: split → return skip drops remaining work", () => {
  const session = baseSession();

  const events = [
    { type: "COMPLETE_EXERCISE", exercise_id: "sq" },
    { type: "SPLIT_SESSION" },
    { type: "RETURN_SKIP" }
  ];

  const state = applyRuntimeEvents(session, events);

  assert.deepEqual(
    state.completed_exercises.map(e => e.exercise_id),
    ["sq"]
  );

  assert.deepEqual(
    state.remaining_exercises,
    []
  );

  assert.deepEqual(
    state.dropped_exercises.map(e => e.exercise_id),
    ["bp", "dl"]
  );
});

test("Phase6 runtime: skipped exercise never reappears", () => {
  const session = baseSession();

  const events = [
    { type: "SKIP_EXERCISE", exercise_id: "bp" }
  ];

  const state = applyRuntimeEvents(session, events);

  assert.deepEqual(
    state.remaining_exercises.map(e => e.exercise_id),
    ["sq", "dl"]
  );

  assert.deepEqual(
    state.dropped_exercises.map(e => e.exercise_id),
    ["bp"]
  );
});

test("Phase6 runtime: completed exercise never reappears", () => {
  const session = baseSession();

  const events = [
    { type: "COMPLETE_EXERCISE", exercise_id: "bp" }
  ];

  const state = applyRuntimeEvents(session, events);

  assert.deepEqual(
    state.completed_exercises.map(e => e.exercise_id),
    ["bp"]
  );

  assert.deepEqual(
    state.remaining_exercises.map(e => e.exercise_id),
    ["sq", "dl"]
  );
});

test("Phase6 runtime: identical inputs + events are deterministic", () => {
  const session = baseSession();

  const events = [
    { type: "COMPLETE_EXERCISE", exercise_id: "sq" },
    { type: "SPLIT_SESSION" },
    { type: "RETURN_CONTINUE" }
  ];

  const a = applyRuntimeEvents(session, events);
  const b = applyRuntimeEvents(session, events);

  assert.deepEqual(a, b);
});

test("Phase6 runtime: unknown runtime event hard fails", () => {
  const session = baseSession();

  assert.throws(() => {
    applyRuntimeEvents(session, [{ type: "DO_SOMETHING_WEIRD" }]);
  });
});
