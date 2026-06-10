import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_EVENT_SEQUENCE_TOKENS,
  validateNextSessionEventSequence,
  assertNextSessionEventSequence,
  reconstructSessionStateFromEvents,
} from "../src/domain/session_event_sequence.js";

test("validateNextSessionEventSequence accepts the exact next seq_no", () => {
  assert.deepEqual(
    validateNextSessionEventSequence(0, 1),
    { ok: true, expectedSeqNo: 1 }
  );

  assert.deepEqual(
    validateNextSessionEventSequence(4, 5),
    { ok: true, expectedSeqNo: 5 }
  );
});

test("validateNextSessionEventSequence rejects a seq gap", () => {
  const result = validateNextSessionEventSequence(1, 3);

  assert.equal(result.ok, false);
  assert.equal(result.token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_GAP);
  assert.equal(result.expectedSeqNo, 2);
  assert.match(result.details, /expected 2/i);
});

test("validateNextSessionEventSequence rejects a seq duplicate", () => {
  const result = validateNextSessionEventSequence(2, 2);

  assert.equal(result.ok, false);
  assert.equal(result.token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_DUPLICATE);
  assert.equal(result.expectedSeqNo, 3);
  assert.match(result.details, /duplicate/i);
});

test("validateNextSessionEventSequence rejects a seq rewind", () => {
  const result = validateNextSessionEventSequence(5, 3);

  assert.equal(result.ok, false);
  assert.equal(result.token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_REWIND);
  assert.equal(result.expectedSeqNo, 6);
  assert.match(result.details, /rewound/i);
});

test("assertNextSessionEventSequence throws with the emitted token", () => {
  assert.throws(
    () => assertNextSessionEventSequence(7, 9),
    (err) => {
      assert.equal(err.name, "SessionEventSequenceError");
      assert.equal(err.token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_GAP);
      assert.equal(err.expectedSeqNo, 8);
      return true;
    }
  );
});

test("reconstructSessionStateFromEvents reduces factual state deterministically", () => {
  const events = [
    { seq_no: 1, event_type: "session_started" },
    { seq_no: 2, event_type: "exercise_completed" },
    { seq_no: 3, event_type: "exercise_completed" },
    { seq_no: 4, event_type: "session_finished" },
  ];

  const a = reconstructSessionStateFromEvents(events);
  const b = reconstructSessionStateFromEvents(events);

  assert.deepEqual(a, b);
  assert.deepEqual(a, {
    last_seq_no: 4,
    event_count: 4,
    event_type_counts: {
      session_started: 1,
      exercise_completed: 2,
      session_finished: 1,
    },
    latest_event_type: "session_finished",
  });
});

test("reconstructSessionStateFromEvents rejects out-of-order supplied events", () => {
  const events = [
    { seq_no: 1, event_type: "session_started" },
    { seq_no: 3, event_type: "exercise_completed" },
  ];

  assert.throws(
    () => reconstructSessionStateFromEvents(events),
    (err) => {
      assert.equal(err.name, "SessionEventSequenceError");
      assert.equal(err.token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_GAP);
      return true;
    }
  );
});

test("reconstructSessionStateFromEvents rejects invalid event payload shape", () => {
  assert.throws(
    () => reconstructSessionStateFromEvents([{ seq_no: 1, event_type: "" }]),
    (err) => {
      assert.equal(err.name, "SessionEventSequenceError");
      assert.equal(err.token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_INVALID);
      return true;
    }
  );
});