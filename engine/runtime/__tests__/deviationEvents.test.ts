
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalJson,
  compileFutureSessionIgnoringDeviationEvents,
  createInitialDeviationExecutionState,
  DeviationEventValidationError,
  reduceDeviationEvent,
  type DeviationRuntimeEvent,
  type Phase5OutputLike
} from "../deviationEvents";

function phase5Fixture(): Phase5OutputLike {
  return {
    canonical_input_hash: "phase2_hash_abc",
    selection_hash: "phase5_selection_hash_abc",
    program: {
      sessions: [
        {
          session_id: "session_1",
          work_items: [
            {
              work_item_id: "work_1",
              exercise_token_id: "exercise_token_back_squat",
              quantity: {
                sets: 3,
                reps: 5,
                load_value: 100,
                load_unit: "kg"
              }
            }
          ]
        }
      ]
    }
  };
}

test("extra_work_recorded appends factual artefact/history row without changing Phase 5 output", () => {
  const phase5 = phase5Fixture();
  const state = createInitialDeviationExecutionState(phase5);
  const beforePhase5 = canonicalJson(state.phase5_output);

  const event: DeviationRuntimeEvent = {
    event_id: "dev_evt_1",
    event_type: "extra_work_recorded",
    session_id: "session_1",
    work_item_id: null,
    actor_user_id: "athlete_1",
    occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
    recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
    monotonic_index: 1,
    payload: {
      extra_work_item_id: "extra_1",
      exercise_token_id: "exercise_token_push_up",
      quantity: {
        sets: 2,
        reps: 10
      },
      planned_item_effect: "none"
    }
  };

  const next = reduceDeviationEvent(state, event);

  assert.equal(next.runtime_events.length, 1);
  assert.equal(next.deviation_history.length, 1);
  assert.equal(next.deviation_history[0].neutral_copy_id, "EXTRA_WORK_RECORDED");
  assert.equal(canonicalJson(next.phase5_output), beforePhase5);
  assert.equal(next.phase5_output.program.sessions[0].work_items.length, 1);
  assert.equal(next.phase5_output.program.sessions[0].work_items[0].work_item_id, "work_1");
});

test("work_modified_recorded appends factual artefact/history row without rewriting planned work item", () => {
  const phase5 = phase5Fixture();
  const state = createInitialDeviationExecutionState(phase5);
  const beforeWorkItem = canonicalJson(state.phase5_output.program.sessions[0].work_items[0]);

  const event: DeviationRuntimeEvent = {
    event_id: "dev_evt_1",
    event_type: "work_modified_recorded",
    session_id: "session_1",
    work_item_id: "work_1",
    actor_user_id: "athlete_1",
    occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
    recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
    monotonic_index: 1,
    payload: {
      planned_work_item_id: "work_1",
      modification_type: "load_changed",
      before: {
        sets: 3,
        reps: 5,
        load_value: 100,
        load_unit: "kg"
      },
      after: {
        sets: 3,
        reps: 5,
        load_value: 90,
        load_unit: "kg"
      },
      planned_item_effect: "none"
    }
  };

  const next = reduceDeviationEvent(state, event);

  assert.equal(next.runtime_events.length, 1);
  assert.equal(next.deviation_history.length, 1);
  assert.equal(next.deviation_history[0].neutral_copy_id, "WORK_MODIFIED_RECORDED");
  assert.equal(canonicalJson(next.phase5_output.program.sessions[0].work_items[0]), beforeWorkItem);
});

test("future compile ignores deviation events when Phase 1 input is unchanged", () => {
  const phase1 = {
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "general_strength",
    consent_granted: true
  };

  const phase5 = phase5Fixture();
  const state = createInitialDeviationExecutionState(phase5);

  const beforeCompile = compileFutureSessionIgnoringDeviationEvents(phase1, []);

  const event: DeviationRuntimeEvent = {
    event_id: "dev_evt_1",
    event_type: "extra_work_recorded",
    session_id: "session_1",
    work_item_id: null,
    actor_user_id: "athlete_1",
    occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
    recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
    monotonic_index: 1,
    payload: {
      extra_work_item_id: "extra_1",
      exercise_token_id: "exercise_token_push_up",
      quantity: {
        reps: 20
      },
      planned_item_effect: "none"
    }
  };

  const next = reduceDeviationEvent(state, event);
  const afterCompile = compileFutureSessionIgnoringDeviationEvents(phase1, next.runtime_events);

  assert.equal(afterCompile, beforeCompile);
});

test("extra work cannot target or become a planned item", () => {
  const state = createInitialDeviationExecutionState(phase5Fixture());

  const event = {
    event_id: "dev_evt_1",
    event_type: "extra_work_recorded",
    session_id: "session_1",
    work_item_id: "work_1",
    actor_user_id: "athlete_1",
    occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
    recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
    monotonic_index: 1,
    payload: {
      extra_work_item_id: "extra_1",
      exercise_token_id: "exercise_token_push_up",
      quantity: {
        reps: 20
      },
      planned_item_effect: "none"
    }
  };

  assert.throws(
    () => reduceDeviationEvent(state, event as DeviationRuntimeEvent),
    (error) =>
      error instanceof DeviationEventValidationError &&
      error.code === "planned_item_mutation_attempt"
  );
});

test("work modification must resolve to an existing planned work item", () => {
  const state = createInitialDeviationExecutionState(phase5Fixture());

  const event: DeviationRuntimeEvent = {
    event_id: "dev_evt_1",
    event_type: "work_modified_recorded",
    session_id: "session_1",
    work_item_id: "missing_work",
    actor_user_id: "athlete_1",
    occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
    recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
    monotonic_index: 1,
    payload: {
      planned_work_item_id: "missing_work",
      modification_type: "reps_changed",
      before: {
        reps: 5
      },
      after: {
        reps: 3
      },
      planned_item_effect: "none"
    }
  };

  assert.throws(
    () => reduceDeviationEvent(state, event),
    (error) =>
      error instanceof DeviationEventValidationError &&
      error.code === "unknown_work_item"
  );
});

test("unknown event type fails closed", () => {
  const state = createInitialDeviationExecutionState(phase5Fixture());

  const event = {
    event_id: "dev_evt_1",
    event_type: "future_progression_trigger",
    session_id: "session_1",
    work_item_id: null,
    actor_user_id: "athlete_1",
    occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
    recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
    monotonic_index: 1,
    payload: {}
  };

  assert.throws(
    () => reduceDeviationEvent(state, event as DeviationRuntimeEvent),
    (error) =>
      error instanceof DeviationEventValidationError &&
      error.code === "unknown_event_type"
  );
});

test("non-monotonic event order fails closed", () => {
  const state = createInitialDeviationExecutionState(phase5Fixture());

  const event: DeviationRuntimeEvent = {
    event_id: "dev_evt_1",
    event_type: "extra_work_recorded",
    session_id: "session_1",
    work_item_id: null,
    actor_user_id: "athlete_1",
    occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
    recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
    monotonic_index: 2,
    payload: {
      extra_work_item_id: "extra_1",
      exercise_token_id: "exercise_token_push_up",
      quantity: {
        reps: 20
      },
      planned_item_effect: "none"
    }
  };

  assert.throws(
    () => reduceDeviationEvent(state, event),
    (error) =>
      error instanceof DeviationEventValidationError &&
      error.code === "non_monotonic_event_index"
  );
});

test("interpretation fields are rejected by closed-world payload validation", () => {
  const state = createInitialDeviationExecutionState(phase5Fixture());

  const event = {
    event_id: "dev_evt_1",
    event_type: "extra_work_recorded",
    session_id: "session_1",
    work_item_id: null,
    actor_user_id: "athlete_1",
    occurred_at_iso8601: "2026-05-20T10:00:00.000Z",
    recorded_at_iso8601: "2026-05-20T10:01:00.000Z",
    monotonic_index: 1,
    payload: {
      extra_work_item_id: "extra_1",
      exercise_token_id: "exercise_token_push_up",
      quantity: {
        reps: 20
      },
      planned_item_effect: "none",
      interpretation: "not_allowed"
    }
  };

  assert.throws(
    () => reduceDeviationEvent(state, event as DeviationRuntimeEvent),
    (error) =>
      error instanceof DeviationEventValidationError &&
      error.code === "unknown_field"
  );
});
