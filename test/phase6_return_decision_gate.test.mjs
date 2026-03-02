import test from "node:test";
import assert from "node:assert/strict";

import { applyRuntimeEvents } from "@kolosseum/engine/runtime/apply_runtime_event.js";

function mkSession(ids) {
  return { planned_items: ids.map((exercise_id) => ({ exercise_id })) };
}

test("Phase6 runtime: after SPLIT_SESSION, COMPLETE_EXERCISE is forbidden until RETURN decision", () => {
  const session = mkSession(["ex_a", "ex_b"]);

  assert.throws(() => {
    applyRuntimeEvents(session, [
      { type: "SPLIT_SESSION" },
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_a" },
    ]);
  }, (err) => {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("PHASE6_RUNTIME_AWAIT_RETURN_DECISION"));
    return true;
  });
});

test("Phase6 runtime: RETURN_CONTINUE clears gate and allows progress", () => {
  const session = mkSession(["ex_a", "ex_b"]);

  const st = applyRuntimeEvents(session, [
    { type: "SPLIT_SESSION" },
    { type: "RETURN_CONTINUE" },
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_a" },
  ]);

  assert.equal(st.return_decision_required, false);
  assert.deepEqual(st.completed_exercises, [{ exercise_id: "ex_a" }]);
});

test("Phase6 runtime: RETURN_SKIP drops remaining deterministically (Phase 1 fallback: drop all remaining)", () => {
  const session = mkSession(["ex_a", "ex_b"]);

  const st = applyRuntimeEvents(session, [
    { type: "SPLIT_SESSION" },
    { type: "RETURN_SKIP" },
  ]);

  assert.equal(st.return_decision_required, false);
  assert.deepEqual(st.remaining_exercises, []);
  // all planned become dropped in this fallback
  assert.deepEqual(st.dropped_exercises, [{ exercise_id: "ex_a" }, { exercise_id: "ex_b" }]);
});