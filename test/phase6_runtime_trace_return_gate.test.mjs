import test from "node:test";
import assert from "node:assert/strict";

async function loadPhase6Runtime() {
  // Try the expected layout first
  try {
    return await import("../dist/engine/src/phases/phase6.runtime.js");
  } catch (e1) {
    // Fallback layout (common when rootDir differs)
    return await import("../dist/src/phases/phase6.runtime.js");
  }
}

test("Phase6 runtime trace: split_active + remaining_at_split_ids drive return_gate_required", async () => {
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

  assert.equal(trace.split_active, true);
  assert.deepEqual(trace.remaining_at_split_ids, ["B", "C"]);
  assert.equal(trace.return_gate_required, true);
});

test("Phase6 runtime trace: return_continue clears return_gate_required", async () => {
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

  assert.equal(trace.split_active, false);
  assert.deepEqual(trace.remaining_at_split_ids, []);
  assert.equal(trace.return_gate_required, false);
});
