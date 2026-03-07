import test from "node:test";
import assert from "node:assert/strict";

async function loadPhase6Runtime() {
  try {
    return await import("../dist/engine/src/phases/phase6.runtime.js");
  } catch {
    return await import("../dist/src/phases/phase6.runtime.js");
  }
}

test("Phase6 runtime trace: split session emits explicit return decision contract only", async () => {
  const { phase6ApplyRuntimeEventsWithTrace } = await loadPhase6Runtime();

  const session = {
    session_id: "S1",
    status: "ready",
    exercises: [
      { exercise_id: "A", sets: 1, reps: 1 },
      { exercise_id: "B", sets: 1, reps: 1 },
      { exercise_id: "C", sets: 1, reps: 1 }
    ]
  };

  const events = [
    { type: "COMPLETE_EXERCISE", exercise_id: "A" },
    { type: "SPLIT_SESSION" }
  ];

  const { trace } = phase6ApplyRuntimeEventsWithTrace(session, events);

  assert.equal(trace.return_decision_required, true);
  assert.deepEqual(trace.return_decision_options, ["RETURN_CONTINUE", "RETURN_SKIP"]);
  assert.equal(Object.prototype.hasOwnProperty.call(trace, "split_active"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(trace, "remaining_at_split_ids"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(trace, "return_gate_required"), false);
});

test("Phase6 runtime trace: return_continue clears explicit return decision contract", async () => {
  const { phase6ApplyRuntimeEventsWithTrace } = await loadPhase6Runtime();

  const session = {
    session_id: "S1",
    status: "ready",
    exercises: [
      { exercise_id: "A", sets: 1, reps: 1 },
      { exercise_id: "B", sets: 1, reps: 1 }
    ]
  };

  const events = [
    { type: "SPLIT_SESSION" },
    { type: "RETURN_CONTINUE" }
  ];

  const { trace } = phase6ApplyRuntimeEventsWithTrace(session, events);

  assert.equal(trace.return_decision_required, false);
  assert.deepEqual(trace.return_decision_options, []);
  assert.equal(Object.prototype.hasOwnProperty.call(trace, "split_active"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(trace, "remaining_at_split_ids"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(trace, "return_gate_required"), false);
});
