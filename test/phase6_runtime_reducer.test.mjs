import test from "node:test";
import assert from "node:assert/strict";

async function loadRuntime() {
  // Try the expected layout first
  try {
    return await import("../dist/src/runtime/session_runtime.js");
  } catch (e1) {
    // Fallback layout (common when rootDir differs)
    return await import("../dist/engine/src/runtime/session_runtime.js");
  }
}

test("Phase6 runtime reducer: determinism for identical event sequences", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const ids = ["A", "B", "C"];
  const events = [
    { type: "complete_exercise", exercise_id: "A" },
    { type: "split_start" },
    { type: "complete_exercise", exercise_id: "B" },
    { type: "split_return_continue" }
  ];

  const s1 = events.reduce((s, e) => applyRuntimeEvent(s, e), makeRuntimeState(ids));
  const s2 = events.reduce((s, e) => applyRuntimeEvent(s, e), makeRuntimeState(ids));

  assert.deepEqual([...s1.remaining_ids], [...s2.remaining_ids]);
  assert.deepEqual([...s1.completed_ids].sort(), [...s2.completed_ids].sort());
  assert.deepEqual([...s1.skipped_ids].sort(), [...s2.skipped_ids].sort());
});

test("Phase6 runtime reducer: idempotent complete/skip never resurrects", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const ids = ["A", "B"];
  let s = makeRuntimeState(ids);

  s = applyRuntimeEvent(s, { type: "complete_exercise", exercise_id: "A" });
  s = applyRuntimeEvent(s, { type: "complete_exercise", exercise_id: "A" });
  s = applyRuntimeEvent(s, { type: "skip_exercise", exercise_id: "A" });

  assert.equal(s.remaining_ids.includes("A"), false);
  assert.equal(s.completed_ids.has("A"), true);
  assert.equal(s.skipped_ids.has("A"), false); // complete wins over later skip
});

test("Phase6 runtime reducer: split return skip drops remaining at split", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const ids = ["A", "B", "C"];
  let s = makeRuntimeState(ids);

  s = applyRuntimeEvent(s, { type: "split_start" });
  s = applyRuntimeEvent(s, { type: "complete_exercise", exercise_id: "A" });

  // At split time remaining was A,B,C. Now remaining is B,C. Skip should drop B,C.
  s = applyRuntimeEvent(s, { type: "split_return_skip" });

  assert.deepEqual(s.remaining_ids, []);
});

test("Phase6 runtime reducer: unknown event hard fails", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const ids = ["A"];
  const s = makeRuntimeState(ids);

  assert.throws(() => applyRuntimeEvent(s, { type: "nope" }), /PHASE6_RUNTIME_UNKNOWN_EVENT/);
});
