// DEV NOTE: BETA-14 deterministic Phase 6 factual runtime reducer.
// It consumes BETA-13 canonical events only. Runtime deviations alter only
// current factual execution state and cannot change future engine behaviour.

import { createHash } from "node:crypto";

import {
  appendBeta13Phase6EventLog,
  stableBeta13Phase6EventJson,
  validateBeta13Phase6CanonicalEvent,
  validateBeta13Phase6EventLog,
  validateBeta13Phase6Session
} from "./beta13_phase6_event_schema.js";

export const beta14Phase6RuntimeReducerContract = Object.freeze({
  reducer_id: "beta14_phase6_runtime_reducer",
  slice_id: "BETA-14",
  version: "1.0.0",
  event_schema_id: "beta13_phase6_event_schema",
  append_policy: "append_only_exact_next_seq",
  truth_class: "factual_runtime_state",
  future_engine_effect: "none",
  terminal_classifications: Object.freeze([
    "completed",
    "partial",
    "terminated"
  ])
});

const TERMINAL_SESSION_STATUSES = new Set([
  "completed",
  "partial",
  "terminated"
]);

const WORK_ITEM_BOUND_EVENT_TYPES = new Set([
  "WORK_ITEM_START",
  "WORK_ITEM_DONE",
  "WORK_ITEM_SKIP",
  "PAIN_FLAG",
  "PAIN_FOLLOW_UP"
]);

function fail(failure_token, message, details = {}) {
  const error = new Error(`${failure_token}: ${message}`);
  error.code = failure_token;
  error.failure_token = failure_token;
  error.details = details;
  throw error;
}

function isRecord(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cloneJson(value) {
  if (typeof value === "undefined") return value;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) return value;

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function hashValue(value) {
  return createHash("sha256")
    .update(
      stableBeta13Phase6EventJson(value),
      "utf8"
    )
    .digest("hex");
}

function buildCounts(workItems) {
  const values = Object.values(workItems);

  return Object.freeze({
    total: values.length,
    pending: values.filter(
      (item) => item.status === "pending"
    ).length,
    active: values.filter(
      (item) => item.status === "active"
    ).length,
    completed: values.filter(
      (item) => item.status === "completed"
    ).length,
    skipped: values.filter(
      (item) => item.status === "skipped"
    ).length
  });
}

function freezeState(state) {
  const mutable = cloneJson(state);

  delete mutable.reducer_state_hash;

  mutable.counts = buildCounts(
    mutable.work_items
  );

  return deepFreeze({
    ...mutable,
    reducer_state_hash: hashValue(mutable)
  });
}

function assertReducerStateIntegrity(context, state) {
  if (!isRecord(state)) {
    fail(
      "phase6_runtime_reducer_state_invalid",
      "Reducer state must be an object."
    );
  }

  if (
    state.reducer_contract_id !==
    beta14Phase6RuntimeReducerContract.reducer_id
  ) {
    fail(
      "phase6_runtime_reducer_state_invalid",
      "Reducer contract ID mismatch."
    );
  }

  if (state.session_id !== context.session_id) {
    fail(
      "phase6_runtime_reducer_state_invalid",
      "Reducer state session mismatch.",
      {
        expected: context.session_id,
        actual: state.session_id
      }
    );
  }

  if (
    typeof state.reducer_state_hash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(state.reducer_state_hash)
  ) {
    fail(
      "phase6_runtime_reducer_state_invalid",
      "Reducer state hash is invalid."
    );
  }

  const mutable = cloneJson(state);
  const actualHash = mutable.reducer_state_hash;

  delete mutable.reducer_state_hash;

  const expectedHash = hashValue(mutable);

  if (actualHash !== expectedHash) {
    fail(
      "phase6_runtime_reducer_state_tampered",
      "Reducer state does not match its deterministic hash.",
      {
        expected: expectedHash,
        actual: actualHash
      }
    );
  }

  if (
    !Number.isSafeInteger(state.last_seq) ||
    state.last_seq < 0
  ) {
    fail(
      "phase6_runtime_reducer_state_invalid",
      "last_seq is invalid."
    );
  }

  if (
    !Array.isArray(state.accepted_event_ids) ||
    state.accepted_event_ids.length !== state.last_seq
  ) {
    fail(
      "phase6_runtime_reducer_state_invalid",
      "Accepted event IDs do not match last_seq."
    );
  }
}

function activeWorkItemIds(workItems) {
  return Object.values(workItems)
    .filter((item) => item.status === "active")
    .map((item) => item.work_item_id);
}

function unresolvedWorkItemIds(orderedIds, workItems) {
  return orderedIds.filter((workItemId) => {
    const status = workItems[workItemId]?.status;

    return status === "pending" ||
      status === "active";
  });
}

function replaceWorkItem(state, workItemId, replacement) {
  return {
    ...state.work_items,
    [workItemId]: {
      ...replacement
    }
  };
}

function replacePainRecord(state, workItemId, replacement) {
  return {
    ...state.pain_follow_up,
    [workItemId]: {
      ...replacement
    }
  };
}

function requireKnownWorkItem(state, workItemId) {
  const item = state.work_items[workItemId];

  if (!item) {
    fail(
      "phase6_runtime_reducer_unknown_work_item",
      "Event references unknown work item.",
      {
        work_item_id: workItemId
      }
    );
  }

  return item;
}

function requireAppendOnly(state, event) {
  const expected = state.last_seq + 1;

  if (event.seq !== expected) {
    fail(
      "phase6_runtime_reducer_append_only_violation",
      "Event sequence must be the exact next value.",
      {
        expected,
        actual: event.seq
      }
    );
  }

  if (
    state.accepted_event_ids.includes(event.event_id)
  ) {
    fail(
      "phase6_runtime_reducer_append_only_violation",
      "Event ID was already accepted.",
      {
        event_id: event.event_id
      }
    );
  }
}

function requireSessionStarted(state, event) {
  if (event.event_type === "SESSION_START") {
    if (
      state.status !== "not_started" ||
      state.last_seq !== 0
    ) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "SESSION_START must be the first event."
      );
    }

    return;
  }

  if (state.status === "not_started") {
    fail(
      "phase6_runtime_reducer_event_order_invalid",
      "SESSION_START is required first.",
      {
        event_type: event.event_type
      }
    );
  }
}

function terminalClassification(state, endCode) {
  const counts = buildCounts(state.work_items);

  if (endCode === "completed") {
    if (
      counts.pending > 0 ||
      counts.active > 0
    ) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Completed end requires all work items to be terminal.",
        {
          counts
        }
      );
    }

    const implicitSplitSkips = Object
      .values(state.work_items)
      .filter(
        (item) =>
          item.terminal_source ===
          "split_return_skip"
      );

    if (implicitSplitSkips.length > 0) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Completed end requires explicit work-item terminal events.",
        {
          work_item_ids:
            implicitSplitSkips.map(
              (item) => item.work_item_id
            )
        }
      );
    }

    return counts.completed === counts.total
      ? "completed"
      : "partial";
  }

  return counts.completed > 0
    ? "partial"
    : "terminated";
}

function acceptEvent(state, event) {
  return freezeState({
    ...state,
    last_seq: event.seq,
    accepted_event_ids: [
      ...state.accepted_event_ids,
      event.event_id
    ],
    event_type_counts: {
      ...state.event_type_counts,
      [event.event_type]:
        (
          state.event_type_counts[
            event.event_type
          ] ?? 0
        ) + 1
    }
  });
}

export function initialiseBeta14Phase6RuntimeState(session) {
  const context =
    validateBeta13Phase6Session(session);

  const work_items = {};
  const pain_follow_up = {};

  for (
    const workItemId of
    context.ordered_work_item_ids
  ) {
    const item = context.work_items[workItemId];

    work_items[workItemId] = {
      work_item_id: workItemId,
      block_id: item.block_id,
      exercise_id: item.exercise_id,
      status: "pending",
      started_event_id: null,
      terminal_event_id: null,
      terminal_source: null
    };

    pain_follow_up[workItemId] = {
      work_item_id: workItemId,
      follow_up_pending: false,
      flag_event_ids: [],
      follow_up_event_ids: [],
      latest_response_code: null
    };
  }

  return freezeState({
    reducer_contract_id:
      beta14Phase6RuntimeReducerContract.reducer_id,
    reducer_version:
      beta14Phase6RuntimeReducerContract.version,
    session_id: context.session_id,
    activity_id: context.activity_id,
    status: "not_started",
    classification: null,
    session_ended: false,
    end_code: null,
    ended_by_event_id: null,
    last_seq: 0,
    accepted_event_ids: [],
    event_type_counts: {},
    split: {
      active: false,
      entered_event_id: null,
      remaining_at_split_ids: []
    },
    work_item_order: [
      ...context.ordered_work_item_ids
    ],
    work_items,
    pain_follow_up
  });
}

export function applyBeta14Phase6RuntimeEvent(
  session,
  state,
  event
) {
  const context =
    validateBeta13Phase6Session(session);

  assertReducerStateIntegrity(context, state);

  const acceptedEvent =
    validateBeta13Phase6CanonicalEvent(
      session,
      event
    );

  requireAppendOnly(state, acceptedEvent);

  if (acceptedEvent.session_id !== state.session_id) {
    fail(
      "phase6_runtime_reducer_session_mismatch",
      "Event session does not match reducer state."
    );
  }

  if (
    state.session_ended === true ||
    TERMINAL_SESSION_STATUSES.has(state.status)
  ) {
    fail(
      "phase6_runtime_reducer_event_order_invalid",
      "Terminal session cannot accept more events.",
      {
        status: state.status,
        event_type: acceptedEvent.event_type
      }
    );
  }

  requireSessionStarted(state, acceptedEvent);

  if (
    state.split.active === true &&
    WORK_ITEM_BOUND_EVENT_TYPES.has(
      acceptedEvent.event_type
    )
  ) {
    fail(
      "phase6_runtime_reducer_event_order_invalid",
      "Work-item event is blocked while split is active."
    );
  }

  let next = cloneJson(state);

  if (acceptedEvent.event_type === "SESSION_START") {
    next.status = "in_progress";
  }

  if (acceptedEvent.event_type === "WORK_ITEM_START") {
    const current = requireKnownWorkItem(
      state,
      acceptedEvent.work_item_id
    );

    if (current.status !== "pending") {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Only pending work items may start.",
        {
          work_item_id: acceptedEvent.work_item_id,
          status: current.status
        }
      );
    }

    const activeIds =
      activeWorkItemIds(state.work_items);

    if (activeIds.length > 0) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Only one work item may be active.",
        {
          active_work_item_ids: activeIds
        }
      );
    }

    next.work_items = replaceWorkItem(
      state,
      acceptedEvent.work_item_id,
      {
        ...current,
        status: "active",
        started_event_id: acceptedEvent.event_id
      }
    );
  }

  if (
    acceptedEvent.event_type === "WORK_ITEM_DONE" ||
    acceptedEvent.event_type === "WORK_ITEM_SKIP"
  ) {
    const current = requireKnownWorkItem(
      state,
      acceptedEvent.work_item_id
    );

    if (current.status !== "active") {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Terminal work-item event requires an active work item.",
        {
          work_item_id: acceptedEvent.work_item_id,
          status: current.status
        }
      );
    }

    const done =
      acceptedEvent.event_type ===
      "WORK_ITEM_DONE";

    next.work_items = replaceWorkItem(
      state,
      acceptedEvent.work_item_id,
      {
        ...current,
        status: done ? "completed" : "skipped",
        terminal_event_id: acceptedEvent.event_id,
        terminal_source:
          done
            ? "work_item_done"
            : "work_item_skip"
      }
    );
  }

  if (acceptedEvent.event_type === "SPLIT_ENTER") {
    if (state.split.active === true) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Split is already active."
      );
    }

    const remaining = unresolvedWorkItemIds(
      state.work_item_order,
      state.work_items
    );

    if (remaining.length === 0) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Split requires unresolved work items."
      );
    }

    next.status = "split";
    next.split = {
      active: true,
      entered_event_id: acceptedEvent.event_id,
      remaining_at_split_ids: remaining
    };
  }

  if (
    acceptedEvent.event_type ===
    "SPLIT_RETURN_DECISION"
  ) {
    if (state.split.active !== true) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Split return decision requires an active split."
      );
    }

    if (
      acceptedEvent.payload.decision ===
      "skip_remaining"
    ) {
      const workItems =
        cloneJson(state.work_items);

      for (
        const workItemId of
        state.split.remaining_at_split_ids
      ) {
        const current = workItems[workItemId];

        if (
          current &&
          (
            current.status === "pending" ||
            current.status === "active"
          )
        ) {
          workItems[workItemId] = {
            ...current,
            status: "skipped",
            terminal_event_id:
              acceptedEvent.event_id,
            terminal_source:
              "split_return_skip"
          };
        }
      }

      next.work_items = workItems;
    }

    next.status = "in_progress";
    next.split = {
      active: false,
      entered_event_id: null,
      remaining_at_split_ids: []
    };
  }

  if (acceptedEvent.event_type === "PAIN_FLAG") {
    const current = requireKnownWorkItem(
      state,
      acceptedEvent.work_item_id
    );

    if (current.status !== "active") {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Pain flag requires an active work item."
      );
    }

    const record =
      state.pain_follow_up[
        acceptedEvent.work_item_id
      ];

    if (record.follow_up_pending === true) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Pain follow-up is already pending."
      );
    }

    next.pain_follow_up = replacePainRecord(
      state,
      acceptedEvent.work_item_id,
      {
        ...record,
        follow_up_pending:
          acceptedEvent.payload.follow_up_required,
        flag_event_ids: [
          ...record.flag_event_ids,
          acceptedEvent.event_id
        ]
      }
    );
  }

  if (
    acceptedEvent.event_type ===
    "PAIN_FOLLOW_UP"
  ) {
    const record =
      state.pain_follow_up[
        acceptedEvent.work_item_id
      ];

    if (
      !record ||
      record.follow_up_pending !== true
    ) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "Pain follow-up requires a pending factual flag."
      );
    }

    next.pain_follow_up = replacePainRecord(
      state,
      acceptedEvent.work_item_id,
      {
        ...record,
        follow_up_pending: false,
        follow_up_event_ids: [
          ...record.follow_up_event_ids,
          acceptedEvent.event_id
        ],
        latest_response_code:
          acceptedEvent.payload.response_code
      }
    );
  }

  if (acceptedEvent.event_type === "SESSION_END") {
    if (state.split.active === true) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "SESSION_END cannot occur during an active split."
      );
    }

    const pendingPain = Object
      .values(state.pain_follow_up)
      .filter(
        (record) =>
          record.follow_up_pending === true
      )
      .map(
        (record) => record.work_item_id
      );

    if (pendingPain.length > 0) {
      fail(
        "phase6_runtime_reducer_event_order_invalid",
        "SESSION_END cannot occur while pain follow-up is pending.",
        {
          work_item_ids: pendingPain
        }
      );
    }

    const classification =
      terminalClassification(
        state,
        acceptedEvent.payload.end_code
      );

    next.status = classification;
    next.classification = classification;
    next.session_ended = true;
    next.end_code =
      acceptedEvent.payload.end_code;
    next.ended_by_event_id =
      acceptedEvent.event_id;
    next.split = {
      active: false,
      entered_event_id: null,
      remaining_at_split_ids: []
    };
  }

  return acceptEvent(next, acceptedEvent);
}

export function replayBeta14Phase6RuntimeEvents(
  session,
  events
) {
  const acceptedEvents =
    validateBeta13Phase6EventLog(
      session,
      events
    );

  return acceptedEvents.reduce(
    (state, event) =>
      applyBeta14Phase6RuntimeEvent(
        session,
        state,
        event
      ),
    initialiseBeta14Phase6RuntimeState(
      session
    )
  );
}

export function appendAndReduceBeta14Phase6RuntimeEvent(
  session,
  priorEvents,
  routeSessionId,
  raw
) {
  const event_log =
    appendBeta13Phase6EventLog(
      session,
      priorEvents,
      routeSessionId,
      raw
    );

  const state =
    replayBeta14Phase6RuntimeEvents(
      session,
      event_log
    );

  return deepFreeze({
    event_log,
    state
  });
}

export function stableBeta14Phase6RuntimeStateJson(
  value
) {
  return stableBeta13Phase6EventJson(value);
}

export function tryReplayBeta14Phase6RuntimeEvents(
  session,
  events
) {
  try {
    return Object.freeze({
      ok: true,
      state:
        replayBeta14Phase6RuntimeEvents(
          session,
          events
        )
    });
  }
  catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code:
          error?.failure_token ??
          "phase6_runtime_reducer_failure",
        message:
          error instanceof Error
            ? error.message
            : String(error),
        details:
          error?.details ?? {}
      })
    });
  }
}
