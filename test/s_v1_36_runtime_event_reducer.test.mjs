import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  appendV1RuntimeEventLog,
  applyV1RuntimeEvent,
  initialiseV1RuntimeState,
  replayV1RuntimeEvents,
  stableRuntimeReducerJson,
  tryReplayV1RuntimeEvents,
  v1RuntimeEventReducerContract
} from "../src/v1RuntimeEventReducer.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let current = target;

  for (const part of parts.slice(0, -1)) {
    if (part === "events") {
      current = current.valid_events;
      continue;
    }

    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }

    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

const fixture = readJson("ci/fixtures/v1_runtime_event_reducer/s_v1_36_runtime_event_reducer_cases.json");

test("S-V1-36 exposes a closed v1 runtime event reducer contract", () => {
  assert.equal(v1RuntimeEventReducerContract.surface_id, "v1_runtime_event_reducer");
  assert.equal(v1RuntimeEventReducerContract.slice_id, "S-V1-36");
  assert.equal(v1RuntimeEventReducerContract.append_policy, "append_only_exact_next_seq");
  assert.equal(v1RuntimeEventReducerContract.event_types.includes("SESSION_START"), true);
  assert.equal(v1RuntimeEventReducerContract.event_types.includes("COMPLETE_WORK_ITEM"), true);
  assert.equal(v1RuntimeEventReducerContract.event_types.includes("RETURN_SKIP"), true);
});

test("S-V1-36 reduces accepted events deterministically without mutating input", () => {
  const session = clone(fixture.session);
  const events = clone(fixture.valid_events);
  const beforeSession = clone(session);
  const beforeEvents = clone(events);

  const first = replayV1RuntimeEvents(session, events);
  const second = replayV1RuntimeEvents(clone(session), clone(events));

  assert.equal(first.session_id, "session_s_v1_36_001");
  assert.equal(first.status, "partially_completed");
  assert.equal(first.last_seq, 6);
  assert.deepEqual(first.counts, {
    total: 3,
    completed: 1,
    skipped: 1,
    partial: 1,
    pending: 0
  });
  assert.deepEqual(first.accepted_event_ids, [
    "event_001",
    "event_002",
    "event_003",
    "event_004",
    "event_005",
    "event_006"
  ]);
  assert.deepEqual(first.event_type_counts, {
    SESSION_START: 1,
    COMPLETE_WORK_ITEM: 1,
    PARTIAL_COMPLETE_WORK_ITEM: 1,
    SPLIT_SESSION: 1,
    RETURN_CONTINUE: 1,
    SKIP_WORK_ITEM: 1
  });

  assert.equal(stableRuntimeReducerJson(first), stableRuntimeReducerJson(second));
  assert.deepEqual(session, beforeSession);
  assert.deepEqual(events, beforeEvents);
});

test("S-V1-36 append helper enforces exact append-only event log", () => {
  const prior = clone(fixture.valid_events.slice(0, 2));
  const next = clone(fixture.valid_events[2]);
  const before = clone(prior);

  const appended = appendV1RuntimeEventLog(prior, next);

  assert.equal(appended.length, 3);
  assert.deepEqual(appended.map((event) => event.seq), [1, 2, 3]);
  assert.deepEqual(prior, before);

  const duplicate = clone(next);
  duplicate.event_id = prior[0].event_id;
  assert.throws(
    () => appendV1RuntimeEventLog(prior, duplicate),
    (error) => error?.reason === "duplicate_event_id"
  );

  const gap = clone(next);
  gap.seq = 4;
  assert.throws(
    () => appendV1RuntimeEventLog(prior, gap),
    (error) => error?.reason === "event_seq_gap"
  );
});

test("S-V1-36 invalid events fail closed and preserve previous state", () => {
  for (const testCase of fixture.negative_cases) {
    const mutatedFixture = clone(fixture);
    setPath(mutatedFixture, testCase.mutation_path, testCase.mutation_value);

    if (testCase.case_id === "work_before_start") {
      mutatedFixture.valid_events[0].work_item_id = "work_001";
    }

    const result = tryReplayV1RuntimeEvents(mutatedFixture.session, mutatedFixture.valid_events);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
  }

  const state = initialiseV1RuntimeState(clone(fixture.session));
  const before = stableRuntimeReducerJson(state);
  const invalidEvent = clone(fixture.valid_events[1]);
  invalidEvent.seq = 1;

  assert.throws(
    () => applyV1RuntimeEvent(state, invalidEvent),
    (error) => error?.reason === "event_order_invalid"
  );

  assert.equal(stableRuntimeReducerJson(state), before);
});

test("S-V1-36 replay returns the same state as incremental reduction", () => {
  const session = clone(fixture.session);
  const events = clone(fixture.valid_events);

  let incremental = initialiseV1RuntimeState(session);
  for (const event of events) {
    incremental = applyV1RuntimeEvent(incremental, event);
  }

  const replayed = replayV1RuntimeEvents(clone(session), clone(events));

  assert.equal(stableRuntimeReducerJson(replayed), stableRuntimeReducerJson(incremental));
});

test("S-V1-36 split return skip produces a stable factual partial state", () => {
  const state = replayV1RuntimeEvents(clone(fixture.session), clone(fixture.return_skip_events));

  assert.equal(state.status, "partially_completed");
  assert.deepEqual(state.counts, {
    total: 3,
    completed: 1,
    skipped: 2,
    partial: 0,
    pending: 0
  });
  assert.equal(state.split.active, false);
  assert.deepEqual(state.split.remaining_at_split_ids, []);
  assert.equal(state.work_items.work_002.status, "skipped");
  assert.equal(state.work_items.work_003.status, "skipped");

  const replayed = replayV1RuntimeEvents(clone(fixture.session), clone(fixture.return_skip_events));
  assert.equal(stableRuntimeReducerJson(replayed), stableRuntimeReducerJson(state));
});

test("S-V1-36 duplicate terminal work-item event is rejected idempotently", () => {
  const session = clone(fixture.session);
  let state = initialiseV1RuntimeState(session);

  state = applyV1RuntimeEvent(state, fixture.valid_events[0]);
  state = applyV1RuntimeEvent(state, fixture.valid_events[1]);

  const before = stableRuntimeReducerJson(state);
  const duplicateWork = {
    ...clone(fixture.valid_events[1]),
    event_id: "event_duplicate_terminal",
    seq: 3
  };

  assert.throws(
    () => applyV1RuntimeEvent(state, duplicateWork),
    (error) => error?.reason === "duplicate_work_item_terminal_event"
  );

  assert.equal(stableRuntimeReducerJson(state), before);
});
