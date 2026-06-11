
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";

test("neutral aggregation runtime: derives neutral counts totals and explicit status from authoritative source facts", async () => {
  const mod = await import(`../dist/src/api/session_state_read_model.js?case=neutral_aggregation_counts`);

  const source = {
    trace: {
      completed_ids: ["ex_back_squat", "ex_bench_press", "ex_back_squat"],
      dropped_ids: ["ex_deadlift"],
      remaining_ids: ["ex_row", "ex_press"],
      event_count: 7,
      event_type_counts: {
        START_SESSION: 1,
        COMPLETE_EXERCISE: 2,
        SPLIT_SESSION: 1,
        RETURN_SKIP: 1,
        COMPLETE_SESSION: 1,
        NOOP: 1
      },
      last_seq_no: 7,
      return_decision_required: false
    },
    runtime: {
      execution_status: "partial"
    },
    execution_status: "partial",
    event_log: [
      { seq_no: 1, event_type: "START_SESSION" },
      { seq_no: 2, event_type: "COMPLETE_EXERCISE" },
      { seq_no: 3, event_type: "COMPLETE_EXERCISE" },
      { seq_no: 4, event_type: "SPLIT_SESSION" },
      { seq_no: 5, event_type: "RETURN_SKIP" },
      { seq_no: 6, event_type: "COMPLETE_SESSION" },
      { seq_no: 7, event_type: "NOOP" }
    ]
  };

  const result = mod.buildNeutralSessionAggregation(source);

  assert.deepEqual(result, {
    total_events: 7,
    total_completed_exercises: 2,
    total_dropped_exercises: 1,
    split_count: 1,
    has_return_decision: false,
    last_event_seq: 7,
    completed_ids_count: 2,
    dropped_ids_count: 1,
    remaining_ids_count: 2,
    execution_status: "partial"
  });
});

test("neutral aggregation runtime: same authoritative input stays deterministic and source payload is not mutated", async () => {
  const mod = await import(`../dist/src/api/session_state_read_model.js?case=neutral_aggregation_determinism`);

  const source = {
    trace: {
      completed_ids: ["ex_a", "ex_a", "ex_b"],
      dropped_ids: ["ex_c"],
      remaining_ids: ["ex_d"],
      event_type_counts: {
        SPLIT_SESSION: 2
      },
      last_seq_no: 9
    },
    runtime: {
      return_decision_required: true
    },
    execution_status: "in_progress",
    event_log: new Array(9).fill({ event_type: "x" })
  };

  const before = JSON.stringify(source);
  const first = mod.buildNeutralSessionAggregation(source);
  const second = mod.buildNeutralSessionAggregation(source);
  const after = JSON.stringify(source);

  assert.deepEqual(first, second);
  assert.equal(after, before);
  assert.deepEqual(first, {
    total_events: 9,
    total_completed_exercises: 2,
    total_dropped_exercises: 1,
    split_count: 2,
    has_return_decision: true,
    last_event_seq: 9,
    completed_ids_count: 2,
    dropped_ids_count: 1,
    remaining_ids_count: 1,
    execution_status: "in_progress"
  });
});

test("neutral aggregation runtime: missing facts are not upgraded into invented status or sequence claims", async () => {
  const mod = await import(`../dist/src/api/session_state_read_model.js?case=neutral_aggregation_missing_facts`);

  const result = mod.buildNeutralSessionAggregation({
    trace: {
      completed_ids: [],
      dropped_ids: [],
      remaining_ids: []
    },
    runtime: {}
  });

  assert.deepEqual(result, {
    total_events: 0,
    total_completed_exercises: 0,
    total_dropped_exercises: 0,
    split_count: 0,
    has_return_decision: false,
    last_event_seq: null,
    completed_ids_count: 0,
    dropped_ids_count: 0,
    remaining_ids_count: 0,
    execution_status: null
  });
});

test("S-V0-15 neutral aggregation runtime: partial completion remains factual counts plus explicit status", async () => {
  const mod = await import(`../dist/src/api/session_state_read_model.js?case=s_v0_15_partial_counts`);

  const source = {
    trace: {
      completed_ids: ["exA", "exC"],
      dropped_ids: ["exB"],
      remaining_ids: [],
      event_type_counts: {
        COMPLETE_EXERCISE: 2,
        SKIP_EXERCISE: 1
      },
      last_seq_no: 3
    },
    runtime: {
      return_decision_required: false
    },
    execution_status: "partial",
    event_log: [
      { event_type: "COMPLETE_EXERCISE" },
      { event_type: "SKIP_EXERCISE" },
      { event_type: "COMPLETE_EXERCISE" }
    ]
  };

  const before = JSON.stringify(source);
  const first = mod.buildNeutralSessionAggregation(source);
  const second = mod.buildNeutralSessionAggregation(JSON.parse(JSON.stringify(source)));

  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(second, first);
  assert.deepEqual(first, {
    total_events: 3,
    total_completed_exercises: 2,
    total_dropped_exercises: 1,
    split_count: 0,
    has_return_decision: false,
    last_event_seq: 3,
    completed_ids_count: 2,
    dropped_ids_count: 1,
    remaining_ids_count: 0,
    execution_status: "partial"
  });

  assert.equal(Object.prototype.hasOwnProperty.call(first, "adherence"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first, "readiness"), false);
});

test("S-V0-15 neutral aggregation runtime: unended session remains factual in-progress counts", async () => {
  const mod = await import(`../dist/src/api/session_state_read_model.js?case=s_v0_15_unended_counts`);

  const result = mod.buildNeutralSessionAggregation({
    trace: {
      completed_ids: ["exA"],
      dropped_ids: [],
      remaining_ids: ["exB", "exC"],
      event_count: 1,
      last_seq_no: 1
    },
    runtime: {
      return_decision_required: false
    },
    execution_status: "in_progress",
    event_log: [
      { event_type: "COMPLETE_EXERCISE" }
    ]
  });

  assert.deepEqual(result, {
    total_events: 1,
    total_completed_exercises: 1,
    total_dropped_exercises: 0,
    split_count: 0,
    has_return_decision: false,
    last_event_seq: 1,
    completed_ids_count: 1,
    dropped_ids_count: 0,
    remaining_ids_count: 2,
    execution_status: "in_progress"
  });

  assert.equal(Object.prototype.hasOwnProperty.call(result, "stopped_reason"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "fatigue"), false);
});
