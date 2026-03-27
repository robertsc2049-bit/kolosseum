import test from "node:test";
import assert from "node:assert/strict";

test("live capture validation v1 runtime: matching capture and expected streams produce clean audit and reconciliation", async () => {
  const mod = await import(`../dist/src/api/live_capture_validation_v1.js?case=capture_validation_clean`);

  const events = [
    { seq_no: 1, event_type: "START_SESSION", session_id: "s1" },
    { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_a" },
    { seq_no: 3, event_type: "SPLIT_SESSION", session_id: "s1" }
  ];

  const audit = mod.buildCaptureAuditLogV1({
    captured_events: events,
    expected_events: events
  });

  const recon = mod.buildCaptureReconciliationV1({
    captured_events: events,
    expected_events: events
  });

  assert.deepEqual(audit, {
    version: "v1",
    captured_count: 3,
    expected_count: 3,
    issues: []
  });

  assert.deepEqual(recon, {
    version: "v1",
    integrity_ok: true,
    captured_count: 3,
    expected_count: 3,
    missing_seq_nos: [],
    mutated_seq_nos: [],
    reordered_seq_nos: []
  });
});

test("live capture validation v1 runtime: missing and mutated events are surfaced explicitly", async () => {
  const mod = await import(`../dist/src/api/live_capture_validation_v1.js?case=capture_validation_missing_mutated`);

  const audit = mod.buildCaptureAuditLogV1({
    captured_events: [
      { seq_no: 1, event_type: "START_SESSION", session_id: "s1" },
      { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_WRONG" }
    ],
    expected_events: [
      { seq_no: 1, event_type: "START_SESSION", session_id: "s1" },
      { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_a" },
      { seq_no: 3, event_type: "SPLIT_SESSION", session_id: "s1" }
    ]
  });

  const recon = mod.buildCaptureReconciliationV1({
    captured_events: [
      { seq_no: 1, event_type: "START_SESSION", session_id: "s1" },
      { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_WRONG" }
    ],
    expected_events: [
      { seq_no: 1, event_type: "START_SESSION", session_id: "s1" },
      { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_a" },
      { seq_no: 3, event_type: "SPLIT_SESSION", session_id: "s1" }
    ]
  });

  assert.deepEqual(audit, {
    version: "v1",
    captured_count: 2,
    expected_count: 3,
    issues: [
      {
        kind: "mutated_event",
        seq_no: 2,
        captured_event: { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_WRONG" },
        expected_event: { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_a" }
      },
      {
        kind: "missing_event",
        seq_no: 3,
        captured_event: null,
        expected_event: { seq_no: 3, event_type: "SPLIT_SESSION", session_id: "s1" }
      }
    ]
  });

  assert.deepEqual(recon, {
    version: "v1",
    integrity_ok: false,
    captured_count: 2,
    expected_count: 3,
    missing_seq_nos: [3],
    mutated_seq_nos: [2],
    reordered_seq_nos: []
  });
});

test("live capture validation v1 runtime: reordered capture stream is flagged without manufacturing missing events", async () => {
  const mod = await import(`../dist/src/api/live_capture_validation_v1.js?case=capture_validation_reordered`);

  const captured = [
    { seq_no: 1, event_type: "START_SESSION", session_id: "s1" },
    { seq_no: 3, event_type: "SPLIT_SESSION", session_id: "s1" },
    { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_a" }
  ];

  const expected = [
    { seq_no: 1, event_type: "START_SESSION", session_id: "s1" },
    { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_a" },
    { seq_no: 3, event_type: "SPLIT_SESSION", session_id: "s1" }
  ];

  const audit = mod.buildCaptureAuditLogV1({
    captured_events: captured,
    expected_events: expected
  });

  const recon = mod.buildCaptureReconciliationV1({
    captured_events: captured,
    expected_events: expected
  });

  assert.deepEqual(audit, {
    version: "v1",
    captured_count: 3,
    expected_count: 3,
    issues: [
      {
        kind: "reordered_event",
        seq_no: 2,
        captured_event: { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_a" },
        expected_event: { seq_no: 2, event_type: "COMPLETE_EXERCISE", exercise_id: "ex_a" }
      }
    ]
  });

  assert.deepEqual(recon, {
    version: "v1",
    integrity_ok: false,
    captured_count: 3,
    expected_count: 3,
    missing_seq_nos: [],
    mutated_seq_nos: [],
    reordered_seq_nos: [2]
  });
});
