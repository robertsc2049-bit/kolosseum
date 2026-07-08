// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_EVENT_SEQUENCE_TOKENS,
  assertNextSessionEventSequence,
  reconstructSessionStateFromEvents,
  validateNextSessionEventSequence,
} from "../dist/src/domain/session_event_sequence.js";

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
});

test("validateNextSessionEventSequence rejects a seq duplicate", () => {
  const result = validateNextSessionEventSequence(2, 2);

  assert.equal(result.ok, false);
  assert.equal(result.token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_DUPLICATE);
  assert.equal(result.expectedSeqNo, 3);
});

test("validateNextSessionEventSequence rejects a seq rewind", () => {
  const result = validateNextSessionEventSequence(5, 3);

  assert.equal(result.ok, false);
  assert.equal(result.token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_REWIND);
  assert.equal(result.expectedSeqNo, 6);
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
    { seq_no: 1, event_type: "START_SESSION" },
    { seq_no: 2, event_type: "COMPLETE_EXERCISE" },
    { seq_no: 3, event_type: "SPLIT_SESSION" },
  ];

  const a = reconstructSessionStateFromEvents(events);
  const b = reconstructSessionStateFromEvents(JSON.parse(JSON.stringify(events)));

  assert.deepEqual(a, b);
  assert.deepEqual(a, {
    last_seq_no: 3,
    event_count: 3,
    event_type_counts: {
      START_SESSION: 1,
      COMPLETE_EXERCISE: 1,
      SPLIT_SESSION: 1,
    },
    latest_event_type: "SPLIT_SESSION",
  });
});

test("reconstructSessionStateFromEvents rejects out-of-order supplied events", () => {
  const events = [
    { seq_no: 1, event_type: "START_SESSION" },
    { seq_no: 3, event_type: "COMPLETE_EXERCISE" },
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

test("S-V0-13: runtime event sequence reconstruction is deterministic across reloads", () => {
  const events = [
    { seq_no: 1, event_type: "START_SESSION", event_payload: { source: "api" } },
    { seq_no: 2, event_type: "COMPLETE_EXERCISE", event_payload: { exercise_id: "ex1" } },
    { seq_no: 3, event_type: "SPLIT_SESSION", event_payload: null },
    { seq_no: 4, event_type: "RETURN_CONTINUE", event_payload: null },
  ];

  const frozenInput = JSON.parse(JSON.stringify(events));

  const first = reconstructSessionStateFromEvents(events);
  const reload = reconstructSessionStateFromEvents(JSON.parse(JSON.stringify(events)));

  assert.deepEqual(first, {
    last_seq_no: 4,
    event_count: 4,
    event_type_counts: {
      START_SESSION: 1,
      COMPLETE_EXERCISE: 1,
      SPLIT_SESSION: 1,
      RETURN_CONTINUE: 1,
    },
    latest_event_type: "RETURN_CONTINUE",
  });

  assert.deepEqual(reload, first);
  assert.deepEqual(events, frozenInput, "reconstruction must not mutate supplied event rows");
});

test("S-V0-13: duplicate runtime seq is rejected and cannot rewrite reconstructed state", () => {
  const validPrefix = [
    { seq_no: 1, event_type: "START_SESSION" },
    { seq_no: 2, event_type: "COMPLETE_EXERCISE" },
  ];

  const before = reconstructSessionStateFromEvents(validPrefix);
  const duplicate = [
    ...validPrefix,
    { seq_no: 2, event_type: "SPLIT_SESSION" },
  ];

  assert.throws(
    () => reconstructSessionStateFromEvents(duplicate),
    (err) => err?.name === "SessionEventSequenceError" && err?.token === SESSION_EVENT_SEQUENCE_TOKENS.SEQ_DUPLICATE
  );

  assert.deepEqual(
    reconstructSessionStateFromEvents(validPrefix),
    before,
    "rejected duplicate replay must not mutate the last valid reconstruction"
  );
});

test("S-V0-13: gap and rewind runtime seq values are rejected predictably", () => {
  assert.throws(
    () => reconstructSessionStateFromEvents([
      { seq_no: 1, event_type: "START_SESSION" },
      { seq_no: 3, event_type: "COMPLETE_EXERCISE" },
    ]),
    (err) => err?.name === "SessionEventSequenceError" && err?.token === SESSION_EVENT_SEQUENCE_TOKENS.SEQ_GAP
  );

  assert.throws(
    () => reconstructSessionStateFromEvents([
      { seq_no: 1, event_type: "START_SESSION" },
      { seq_no: 2, event_type: "COMPLETE_EXERCISE" },
      { seq_no: 1, event_type: "RETURN_SKIP" },
    ]),
    (err) => err?.name === "SessionEventSequenceError" && err?.token === SESSION_EVENT_SEQUENCE_TOKENS.SEQ_REWIND
  );
});

test("S-V0-13: sequential append validation accepts only the exact next runtime seq", () => {
  const accepted = [
    validateNextSessionEventSequence(null, 1),
    validateNextSessionEventSequence(1, 2),
    validateNextSessionEventSequence(2, 3),
  ];

  assert.deepEqual(accepted, [
    { ok: true, expectedSeqNo: 1 },
    { ok: true, expectedSeqNo: 2 },
    { ok: true, expectedSeqNo: 3 },
  ]);

  assert.equal(validateNextSessionEventSequence(3, 3).token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_DUPLICATE);
  assert.equal(validateNextSessionEventSequence(3, 2).token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_REWIND);
  assert.equal(validateNextSessionEventSequence(3, 5).token, SESSION_EVENT_SEQUENCE_TOKENS.SEQ_GAP);
});