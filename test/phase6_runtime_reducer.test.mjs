// test/phase6_runtime_reducer.test.mjs
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

function asArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (v instanceof Set) return Array.from(v);
  if (typeof v[Symbol.iterator] === "function") return Array.from(v);
  return [];
}

test("Phase6 runtime reducer: determinism for identical event sequences", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const ids = ["A", "B", "C"];
  const events = [
    { type: "COMPLETE_EXERCISE", exercise_id: "A" },

    // Split introduces an explicit return gate. No progress events allowed until RETURN_*.
    { type: "SPLIT_SESSION" },
    { type: "RETURN_CONTINUE" },

    { type: "COMPLETE_EXERCISE", exercise_id: "B" }
  ];

  const s1 = events.reduce((s, e) => applyRuntimeEvent(s, e), makeRuntimeState(ids));
  const s2 = events.reduce((s, e) => applyRuntimeEvent(s, e), makeRuntimeState(ids));

  assert.deepEqual(asArray(s1.remaining_ids), asArray(s2.remaining_ids));
  assert.deepEqual(asArray(s1.completed_ids).sort(), asArray(s2.completed_ids).sort());
  assert.deepEqual(asArray(s1.skipped_ids).sort(), asArray(s2.skipped_ids).sort());
});

test("Phase6 runtime reducer: idempotent complete/skip never resurrects", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const ids = ["A", "B"];
  let s = makeRuntimeState(ids);

  s = applyRuntimeEvent(s, { type: "COMPLETE_EXERCISE", exercise_id: "A" });
  s = applyRuntimeEvent(s, { type: "COMPLETE_EXERCISE", exercise_id: "A" });
  s = applyRuntimeEvent(s, { type: "SKIP_EXERCISE", exercise_id: "A" });

  assert.equal(asArray(s.remaining_ids).includes("A"), false);
  assert.equal(asArray(s.completed_ids).includes("A"), true);
  assert.equal(asArray(s.skipped_ids).includes("A"), false); // complete wins over later skip
});

test("Phase6 runtime reducer: split return skip drops remaining at split", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const ids = ["A", "B", "C"];
  let s = makeRuntimeState(ids);

  // Complete A first. Then split captures remaining at split time (B,C).
  s = applyRuntimeEvent(s, { type: "COMPLETE_EXERCISE", exercise_id: "A" });

  s = applyRuntimeEvent(s, { type: "SPLIT_SESSION" });

  // RETURN_SKIP should drop whatever remained at split time (B,C).
  s = applyRuntimeEvent(s, { type: "RETURN_SKIP" });

  assert.deepEqual(asArray(s.remaining_ids), []);
});

test("Phase6 runtime reducer: unknown event hard fails", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const ids = ["A"];
  const s = makeRuntimeState(ids);

  assert.throws(() => applyRuntimeEvent(s, { type: "NOPE" }), /PHASE6_RUNTIME_UNKNOWN_EVENT/);
});