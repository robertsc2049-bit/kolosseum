import test from "node:test";
import assert from "node:assert/strict";

const mod = await import("../src/api/session_summary_read_model.ts");
const {
  buildNeutralSessionSummary,
  getNeutralSessionSummaryAllowedKeys,
  getNeutralSessionSummaryBannedSemanticKeys,
} = mod;

test("buildNeutralSessionSummary derives a factual deterministic single-session summary", () => {
  const sessionState = {
    session_id: "session_001",
    run_id: "run_001",
    execution_status: "partial",
    trace: {
      completed_ids: ["w1", "w2"],
      dropped_ids: ["w3"],
      remaining_ids: ["w4"],
      event_count: 6,
    },
    planned_work_item_ids: ["w1", "w2", "w3", "w4"],
  };

  const runtimeEvents = [
    { event_type: "START_SESSION", timestamp_utc: "2026-04-04T12:00:00Z" },
    { event_type: "EXTRA_WORK", timestamp_utc: "2026-04-04T12:10:00Z" },
    { event_type: "SPLIT_SESSION", timestamp_utc: "2026-04-04T12:15:00Z" },
    { event_type: "RETURN_CONTINUE", timestamp_utc: "2026-04-04T12:20:00Z" },
    { event_type: "RETURN_SKIP", timestamp_utc: "2026-04-04T12:25:00Z" },
    { event_type: "EXTRA_WORK_RECORDED", timestamp_utc: "2026-04-04T12:30:00Z" },
  ];

  const actual = buildNeutralSessionSummary(sessionState, runtimeEvents);

  assert.deepEqual(actual, {
    session_id: "session_001",
    run_id: "run_001",
    status: "partial",
    prescribed_items_total: 4,
    prescribed_items_completed: 2,
    prescribed_items_skipped: 1,
    prescribed_items_remaining: 1,
    extra_work_event_count: 2,
    split_event_count: 1,
    return_continue_count: 1,
    return_skip_count: 1,
    runtime_event_count: 6,
    started_at_utc: "2026-04-04T12:00:00Z",
    completed_at_utc: null,
  });
});

test("buildNeutralSessionSummary is stable for identical inputs", () => {
  const sessionState = {
    session_id: "session_002",
    run_id: "run_002",
    execution_status: "completed",
    trace: {
      completed_ids: ["a", "b"],
      dropped_ids: [],
      remaining_ids: [],
      event_count: 2,
    },
    planned_work_item_ids: ["a", "b"],
    completed_at_utc: "2026-04-04T12:45:00Z",
  };

  const runtimeEvents = [
    { event_type: "START_SESSION", timestamp_utc: "2026-04-04T12:00:00Z" },
    { event_type: "COMPLETE_SESSION", timestamp_utc: "2026-04-04T12:45:00Z" },
  ];

  const first = buildNeutralSessionSummary(sessionState, runtimeEvents);
  const second = buildNeutralSessionSummary(sessionState, runtimeEvents);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("Neutral session summary allowed keys are exact and pinned", () => {
  assert.deepEqual(getNeutralSessionSummaryAllowedKeys(), [
    "session_id",
    "run_id",
    "status",
    "prescribed_items_total",
    "prescribed_items_completed",
    "prescribed_items_skipped",
    "prescribed_items_remaining",
    "extra_work_event_count",
    "split_event_count",
    "return_continue_count",
    "return_skip_count",
    "runtime_event_count",
    "started_at_utc",
    "completed_at_utc",
  ]);
});

test("Neutral session summary banned semantic keys are pinned", () => {
  assert.deepEqual(getNeutralSessionSummaryBannedSemanticKeys(), [
    "score",
    "quality",
    "adherence",
    "compliance",
    "performance",
    "trend",
    "insight",
    "recommendation",
    "next_action",
    "warning",
    "risk",
    "readiness",
    "fatigue",
    "improvement",
    "regression",
    "summary_text",
    "interpretation",
    "reason",
    "explanation",
  ]);
});

test("Neutral session summary shape rejects extra semantic fields", () => {
  const sessionState = {
    session_id: "session_003",
    run_id: "run_003",
    execution_status: "ready",
    trace: {
      completed_ids: [],
      dropped_ids: [],
      remaining_ids: [],
      event_count: 0,
    },
    planned_work_item_ids: [],
  };

  const runtimeEvents = [];
  const summary = buildNeutralSessionSummary(sessionState, runtimeEvents);

  for (const key of getNeutralSessionSummaryBannedSemanticKeys()) {
    assert.equal(Object.prototype.hasOwnProperty.call(summary, key), false);
  }
});