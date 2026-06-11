
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

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

function projectRuntimeStateForClosure(state) {
  return {
    started: state.started === true,
    remaining_ids: asArray(state.remaining_ids),
    completed_ids: asArray(state.completed_ids).sort(),
    skipped_ids: asArray(state.skipped_ids).sort(),
    dropped_ids: asArray(state.dropped_ids).sort(),
    return_decision_required: state.return_decision_required === true,
    return_decision_options: asArray(state.return_decision_options).sort()
  };
}

function replayEvents(runtime, ids, events) {
  const { makeRuntimeState, applyRuntimeEvent } = runtime;
  return events.reduce((state, event) => applyRuntimeEvent(state, event), makeRuntimeState(ids));
}

test("Phase6 runtime reducer: start state is derived from planned ids only", async () => {
  const runtime = await loadRuntime();
  const state = runtime.makeRuntimeState(["A", "B", "C"]);

  assert.deepEqual(projectRuntimeStateForClosure(state), {
    started: true,
    remaining_ids: ["A", "B", "C"],
    completed_ids: [],
    skipped_ids: [],
    dropped_ids: [],
    return_decision_required: false,
    return_decision_options: []
  });
});

test("Phase6 runtime reducer: repeated read projection does not mutate state", async () => {
  const runtime = await loadRuntime();
  const events = [
    { type: "COMPLETE_EXERCISE", exercise_id: "A" },
    { type: "SPLIT_SESSION" },
    { type: "RETURN_CONTINUE" },
    { type: "COMPLETE_EXERCISE", exercise_id: "B" }
  ];

  const state = replayEvents(runtime, ["A", "B", "C"], events);
  const p1 = projectRuntimeStateForClosure(state);
  const p2 = projectRuntimeStateForClosure(state);
  const p3 = projectRuntimeStateForClosure(state);

  assert.deepEqual(p2, p1);
  assert.deepEqual(p3, p1);
});

test("Phase6 runtime reducer: reload replay matches incremental event append", async () => {
  const runtime = await loadRuntime();
  const ids = ["A", "B", "C"];
  const events = [
    { type: "COMPLETE_EXERCISE", exercise_id: "A" },
    { type: "SPLIT_SESSION" },
    { type: "RETURN_SKIP" }
  ];

  let incremental = runtime.makeRuntimeState(ids);
  incremental = runtime.applyRuntimeEvent(incremental, events[0]);
  incremental = runtime.applyRuntimeEvent(incremental, events[1]);
  incremental = runtime.applyRuntimeEvent(incremental, events[2]);

  const replayed = replayEvents(runtime, ids, events);

  assert.deepEqual(
    projectRuntimeStateForClosure(replayed),
    projectRuntimeStateForClosure(incremental)
  );
});

test("Phase6 runtime reducer: terminal completed state is stable and ungated", async () => {
  const runtime = await loadRuntime();
  const state = replayEvents(runtime, ["A", "B"], [
    { type: "COMPLETE_EXERCISE", exercise_id: "A" },
    { type: "COMPLETE_EXERCISE", exercise_id: "B" }
  ]);

  assert.deepEqual(projectRuntimeStateForClosure(state), {
    started: true,
    remaining_ids: [],
    completed_ids: ["A", "B"],
    skipped_ids: [],
    dropped_ids: [],
    return_decision_required: false,
    return_decision_options: []
  });

  assert.throws(
    () => runtime.applyRuntimeEvent(state, { type: "SPLIT_SESSION" }),
    /PHASE6_RUNTIME_INVALID_EVENT_ORDER/
  );
});

test("Phase6 runtime reducer: return decisions require an open split gate", async () => {
  const runtime = await loadRuntime();
  const state = runtime.makeRuntimeState(["A", "B"]);

  assert.throws(
    () => runtime.applyRuntimeEvent(state, { type: "RETURN_CONTINUE" }),
    /PHASE6_RUNTIME_INVALID_EVENT_ORDER/
  );

  assert.throws(
    () => runtime.applyRuntimeEvent(state, { type: "RETURN_SKIP" }),
    /PHASE6_RUNTIME_INVALID_EVENT_ORDER/
  );
});

test("Phase6 runtime reducer: duplicate split while gated is rejected", async () => {
  const runtime = await loadRuntime();
  let state = runtime.makeRuntimeState(["A", "B"]);
  state = runtime.applyRuntimeEvent(state, { type: "SPLIT_SESSION" });

  assert.equal(state.return_decision_required, true);

  assert.throws(
    () => runtime.applyRuntimeEvent(state, { type: "SPLIT_SESSION" }),
    /PHASE6_RUNTIME_INVALID_EVENT_ORDER/
  );
});

test("Phase6 runtime reducer: progress while split is gated is rejected", async () => {
  const runtime = await loadRuntime();
  let state = runtime.makeRuntimeState(["A", "B"]);
  state = runtime.applyRuntimeEvent(state, { type: "SPLIT_SESSION" });

  assert.throws(
    () => runtime.applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "A" }),
    /PHASE6_RUNTIME_AWAIT_RETURN_DECISION/
  );

  assert.throws(
    () => runtime.applyRuntimeEvent(state, { type: "SKIP_EXERCISE", exercise_id: "A" }),
    /PHASE6_RUNTIME_AWAIT_RETURN_DECISION/
  );
});

test("Phase6 runtime reducer: unknown work item cannot mutate session truth", async () => {
  const runtime = await loadRuntime();
  const state = runtime.makeRuntimeState(["A"]);

  assert.throws(
    () => runtime.applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "Z" }),
    /PHASE6_RUNTIME_UNKNOWN_WORK_ITEM/
  );

  assert.deepEqual(projectRuntimeStateForClosure(state), {
    started: true,
    remaining_ids: ["A"],
    completed_ids: [],
    skipped_ids: [],
    dropped_ids: [],
    return_decision_required: false,
    return_decision_options: []
  });
});

function sV014Ids(value) {
  if (value instanceof Set) return Array.from(value.values()).sort();
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && typeof item.exercise_id === "string") return item.exercise_id;
      return null;
    }).filter(Boolean).sort();
  }
  return [];
}

function sV014Projection(state) {
  return {
    remaining_ids: sV014Ids(state.remaining_ids),
    completed_ids: sV014Ids(state.completed_ids),
    skipped_ids: sV014Ids(state.skipped_ids),
    dropped_ids: sV014Ids(state.dropped_ids),
    remaining_at_split_ids: sV014Ids(state.remaining_at_split_ids),
    return_decision_required: state.return_decision_required,
    return_decision_options: Array.isArray(state.return_decision_options) ? [...state.return_decision_options].sort() : [],
  };
}

function sV014Session(ids = ["exA", "exB", "exC"]) {
  return { planned_items: ids.map((exercise_id) => ({ exercise_id })) };
}

test("S-V0-14: split opens explicit return decision gate with stable options and no default decision", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  let state = makeRuntimeState(sV014Session());
  state = applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "exA" });
  state = applyRuntimeEvent(state, { type: "SPLIT_SESSION" });

  assert.deepEqual(sV014Projection(state), {
    remaining_ids: ["exB", "exC"],
    completed_ids: ["exA"],
    skipped_ids: [],
    dropped_ids: [],
    remaining_at_split_ids: ["exB", "exC"],
    return_decision_required: true,
    return_decision_options: ["RETURN_CONTINUE", "RETURN_SKIP"],
  });

  assert.equal(Object.prototype.hasOwnProperty.call(state, "return_decision"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(state, "split_return_decision"), false);
});

test("S-V0-14: progress is blocked until an explicit return decision resolves split", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  let state = makeRuntimeState(sV014Session());
  state = applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "exA" });
  state = applyRuntimeEvent(state, { type: "SPLIT_SESSION" });

  const before = sV014Projection(state);

  assert.throws(
    () => applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "exB" }),
    /PHASE6_RUNTIME_AWAIT_RETURN_DECISION/
  );

  assert.throws(
    () => applyRuntimeEvent(state, { type: "SKIP_EXERCISE", exercise_id: "exB" }),
    /PHASE6_RUNTIME_AWAIT_RETURN_DECISION/
  );

  assert.deepEqual(sV014Projection(state), before, "blocked progress must not mutate split state");
});

test("S-V0-14: RETURN_CONTINUE clears gate and preserves remaining terminal path", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  let state = makeRuntimeState(sV014Session());
  state = applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "exA" });
  state = applyRuntimeEvent(state, { type: "SPLIT_SESSION" });

  const atSplit = sV014Projection(state);
  state = applyRuntimeEvent(state, { type: "RETURN_CONTINUE" });

  assert.deepEqual(sV014Projection(state), {
    remaining_ids: atSplit.remaining_ids,
    completed_ids: ["exA"],
    skipped_ids: [],
    dropped_ids: [],
    remaining_at_split_ids: [],
    return_decision_required: false,
    return_decision_options: [],
  });

  state = applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "exB" });
  state = applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "exC" });

  assert.deepEqual(sV014Projection(state), {
    remaining_ids: [],
    completed_ids: ["exA", "exB", "exC"],
    skipped_ids: [],
    dropped_ids: [],
    remaining_at_split_ids: [],
    return_decision_required: false,
    return_decision_options: [],
  });
});

test("S-V0-14: RETURN_SKIP clears gate and preserves partial terminal invariants", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  let state = makeRuntimeState(sV014Session());
  state = applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "exA" });
  state = applyRuntimeEvent(state, { type: "SPLIT_SESSION" });
  state = applyRuntimeEvent(state, { type: "RETURN_SKIP" });

  assert.deepEqual(sV014Projection(state), {
    remaining_ids: [],
    completed_ids: ["exA"],
    skipped_ids: ["exB", "exC"],
    dropped_ids: ["exB", "exC"],
    remaining_at_split_ids: [],
    return_decision_required: false,
    return_decision_options: [],
  });

  assert.throws(
    () => applyRuntimeEvent(state, { type: "RETURN_SKIP" }),
    /PHASE6_RUNTIME_INVALID_EVENT_ORDER/
  );

  assert.deepEqual(sV014Projection(state), {
    remaining_ids: [],
    completed_ids: ["exA"],
    skipped_ids: ["exB", "exC"],
    dropped_ids: ["exB", "exC"],
    remaining_at_split_ids: [],
    return_decision_required: false,
    return_decision_options: [],
  });
});

test("S-V0-14: return decisions without an open split are rejected predictably", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  const state = makeRuntimeState(sV014Session());

  assert.throws(
    () => applyRuntimeEvent(state, { type: "RETURN_CONTINUE" }),
    /PHASE6_RUNTIME_INVALID_EVENT_ORDER/
  );

  assert.throws(
    () => applyRuntimeEvent(state, { type: "RETURN_SKIP" }),
    /PHASE6_RUNTIME_INVALID_EVENT_ORDER/
  );

  assert.deepEqual(sV014Projection(state), {
    remaining_ids: ["exA", "exB", "exC"],
    completed_ids: [],
    skipped_ids: [],
    dropped_ids: [],
    remaining_at_split_ids: [],
    return_decision_required: false,
    return_decision_options: [],
  });
});

test("S-V0-14: invalid return decision event type is rejected without state mutation", async () => {
  const { makeRuntimeState, applyRuntimeEvent } = await loadRuntime();

  let state = makeRuntimeState(sV014Session());
  state = applyRuntimeEvent(state, { type: "COMPLETE_EXERCISE", exercise_id: "exA" });
  state = applyRuntimeEvent(state, { type: "SPLIT_SESSION" });

  const before = sV014Projection(state);

  assert.throws(
    () => applyRuntimeEvent(state, { type: "RETURN_AUTO" }),
    /PHASE6_RUNTIME_UNKNOWN_EVENT/
  );

  assert.deepEqual(sV014Projection(state), before);
});
