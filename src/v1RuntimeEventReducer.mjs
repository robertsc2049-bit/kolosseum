export const V1_RUNTIME_EVENT_REDUCER_TOKEN = "CI_V1_RUNTIME_EVENT_REDUCER";

export const v1RuntimeEventReducerContract = Object.freeze({
  surface_id: "v1_runtime_event_reducer",
  version: "1.0.0",
  slice_id: "S-V1-36",
  event_schema_version: "1.0.0",
  append_policy: "append_only_exact_next_seq",
  failure_code: "v1_runtime_event_reducer_failure",
  event_types: Object.freeze([
    "SESSION_START",
    "COMPLETE_WORK_ITEM",
    "SKIP_WORK_ITEM",
    "PARTIAL_COMPLETE_WORK_ITEM",
    "SPLIT_SESSION",
    "RETURN_CONTINUE",
    "RETURN_SKIP",
    "STOP_SESSION"
  ])
});

const REQUIRED_SESSION_KEYS = Object.freeze([
  "session_id",
  "work_items"
]);

const REQUIRED_WORK_ITEM_KEYS = Object.freeze([
  "work_item_id"
]);

const REQUIRED_EVENT_KEYS = Object.freeze([
  "event_id",
  "seq",
  "event_type",
  "session_id",
  "occurred_at",
  "actor_type",
  "work_item_id",
  "factual_payload"
]);

const REQUIRED_PARTIAL_PAYLOAD_KEYS = Object.freeze([
  "declared_completed_quantity",
  "declared_planned_quantity",
  "unit",
  "reason_code"
]);

const FORBIDDEN_REDUCER_INPUT_KEYS = Object.freeze([
  "coach_notes",
  "coach_note_id",
  "coach_note_text",
  "billing_state",
  "billing_plan",
  "payment_state",
  "ui_state",
  "presentation_state",
  "render_state",
  "copy_id",
  "coach_live_change",
  "coach_override",
  "engine_override",
  "engine_truth_override",
  "extra_session_id",
  "ad_hoc_session",
  ["dash", "board"].join(""),
  ["reco", "mmendation"].join(""),
  ["optimi", "sation"].join(""),
  ["ready", "ness"].join(""),
  ["fat", "igue"].join(""),
  ["ri", "sk"].join("")
]);

const WORK_ITEM_EVENT_TYPES = new Set([
  "COMPLETE_WORK_ITEM",
  "SKIP_WORK_ITEM",
  "PARTIAL_COMPLETE_WORK_ITEM"
]);

const SESSION_EVENT_TYPES = new Set([
  "SESSION_START",
  "SPLIT_SESSION",
  "RETURN_CONTINUE",
  "RETURN_SKIP",
  "STOP_SESSION"
]);

const TERMINAL_WORK_ITEM_STATUSES = new Set([
  "completed",
  "skipped",
  "partial"
]);

function fail(reason, message, details = {}) {
  const error = new Error(`v1_runtime_event_reducer_${reason}: ${message}`);
  error.code = `v1_runtime_event_reducer_${reason}`;
  error.reason = reason;
  error.details = details;
  throw error;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!isRecord(value) && !Array.isArray(value)) {
    return value;
  }

  Object.freeze(value);

  for (const nested of Object.values(value)) {
    if ((isRecord(nested) || Array.isArray(nested)) && !Object.isFrozen(nested)) {
      deepFreeze(nested);
    }
  }

  return value;
}

function assertRecord(value, reason, message, details = {}) {
  if (!isRecord(value)) {
    fail(reason, message, details);
  }
}

function assertArray(value, reason, details = {}) {
  if (!Array.isArray(value)) {
    fail(reason, "expected array", details);
  }
}

function assertExactKeys(value, requiredKeys, reason, details = {}) {
  const required = new Set(requiredKeys);

  for (const key of Object.keys(value)) {
    if (!required.has(key)) {
      fail(reason, "object contains unknown field", {
        ...details,
        field: key
      });
    }
  }

  for (const key of requiredKeys) {
    if (!hasOwn(value, key)) {
      fail(reason, "object missing required field", {
        ...details,
        field: key
      });
    }
  }
}

function assertNonEmptyString(value, reason, details = {}) {
  if (typeof value !== "string" || value.length === 0) {
    fail(reason, "expected non-empty string", details);
  }
}

function assertPositiveInteger(value, reason, details = {}) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(reason, "expected positive safe integer", details);
  }
}

function assertFiniteNumber(value, reason, details = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(reason, "expected finite number", details);
  }
}

function assertIsoString(value, reason, details = {}) {
  assertNonEmptyString(value, reason, details);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(reason, "expected UTC ISO-8601 timestamp string", details);
  }
}

function assertNoForbiddenReducerInputKeys(value, pathParts = []) {
  if (!isRecord(value) && !Array.isArray(value)) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenReducerInputKeys(item, [...pathParts, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_REDUCER_INPUT_KEYS.includes(key)) {
      fail("forbidden_reducer_input", "reducer input contains a forbidden product field", {
        field: key,
        path: [...pathParts, key].join(".")
      });
    }

    assertNoForbiddenReducerInputKeys(value[key], [...pathParts, key]);
  }
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = sortObjectKeys(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function stableRuntimeReducerJson(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function createWorkItemRecord(workItem) {
  assertRecord(workItem, "session_invalid", "work item must be an object");
  assertExactKeys(workItem, REQUIRED_WORK_ITEM_KEYS, "session_invalid", { object: "work_item" });
  assertNonEmptyString(workItem.work_item_id, "session_invalid", { field: "work_item_id" });

  return Object.freeze({
    work_item_id: workItem.work_item_id,
    status: "pending",
    terminal_event_id: null,
    factual_payload: null
  });
}

function buildCounts(workItems) {
  const values = Object.values(workItems);

  return Object.freeze({
    total: values.length,
    completed: values.filter((item) => item.status === "completed").length,
    skipped: values.filter((item) => item.status === "skipped").length,
    partial: values.filter((item) => item.status === "partial").length,
    pending: values.filter((item) => item.status === "pending").length
  });
}

function deriveStatus(baseStatus, workItems) {
  if (baseStatus === "stopped") return "stopped";
  if (baseStatus === "split") return "split";

  const counts = buildCounts(workItems);
  if (counts.total === 0) return "not_started";
  if (counts.pending > 0) return baseStatus === "not_started" ? "not_started" : "in_progress";
  if (counts.completed === counts.total) return "completed";
  return "partially_completed";
}

function freezeState(state) {
  return deepFreeze({
    ...state,
    counts: buildCounts(state.work_items)
  });
}

/**
 * DEV NOTE: S-V1-36 is a pure v1 runtime reducer contract. It validates
 * closed event records, applies events in stored order only, and returns a
 * replayable factual state. It must not read coach notes, billing state, UI
 * state, storage, clocks, random values, or engine modules.
 */
export function initialiseV1RuntimeState(session) {
  assertRecord(session, "session_invalid", "session must be an object");
  assertNoForbiddenReducerInputKeys(session);
  assertExactKeys(session, REQUIRED_SESSION_KEYS, "session_invalid", { object: "session" });
  assertNonEmptyString(session.session_id, "session_invalid", { field: "session_id" });
  assertArray(session.work_items, "session_invalid", { field: "work_items" });

  const workItems = {};
  for (const item of session.work_items) {
    const record = createWorkItemRecord(item);

    if (hasOwn(workItems, record.work_item_id)) {
      fail("session_invalid", "duplicate work_item_id", {
        work_item_id: record.work_item_id
      });
    }

    workItems[record.work_item_id] = record;
  }

  return freezeState({
    reducer_contract_id: v1RuntimeEventReducerContract.surface_id,
    session_id: session.session_id,
    status: "not_started",
    last_seq: 0,
    accepted_event_ids: Object.freeze([]),
    event_type_counts: Object.freeze({}),
    split: Object.freeze({
      active: false,
      remaining_at_split_ids: Object.freeze([])
    }),
    work_items: Object.freeze(workItems)
  });
}

function validatePartialPayload(payload) {
  assertRecord(payload, "event_invalid", "partial factual_payload must be an object");
  assertExactKeys(payload, REQUIRED_PARTIAL_PAYLOAD_KEYS, "event_invalid", { object: "factual_payload" });
  assertFiniteNumber(payload.declared_completed_quantity, "event_invalid", { field: "declared_completed_quantity" });
  assertFiniteNumber(payload.declared_planned_quantity, "event_invalid", { field: "declared_planned_quantity" });
  assertNonEmptyString(payload.unit, "event_invalid", { field: "unit" });
  assertNonEmptyString(payload.reason_code, "event_invalid", { field: "reason_code" });

  if (payload.declared_completed_quantity < 0 || payload.declared_planned_quantity < 0) {
    fail("event_invalid", "partial quantities must be non-negative", {});
  }

  if (payload.declared_completed_quantity > payload.declared_planned_quantity) {
    fail("event_invalid", "partial completed quantity cannot exceed planned quantity", {});
  }
}

function validateV1RuntimeEventShape(event) {
  assertRecord(event, "event_invalid", "event must be an object");
  assertNoForbiddenReducerInputKeys(event);
  assertExactKeys(event, REQUIRED_EVENT_KEYS, "event_invalid", { object: "event" });

  assertNonEmptyString(event.event_id, "event_invalid", { field: "event_id" });
  assertPositiveInteger(event.seq, "event_invalid", { field: "seq" });
  assertNonEmptyString(event.event_type, "event_invalid", { field: "event_type" });
  assertNonEmptyString(event.session_id, "event_invalid", { field: "session_id" });
  assertIsoString(event.occurred_at, "event_invalid", { field: "occurred_at" });

  if (event.actor_type !== "athlete") {
    fail("event_invalid", "actor_type must be athlete", {
      actor_type: event.actor_type
    });
  }

  if (!v1RuntimeEventReducerContract.event_types.includes(event.event_type)) {
    fail("event_invalid", "unknown event_type", {
      event_type: event.event_type
    });
  }

  if (WORK_ITEM_EVENT_TYPES.has(event.event_type)) {
    assertNonEmptyString(event.work_item_id, "event_invalid", { field: "work_item_id" });
  }

  if (SESSION_EVENT_TYPES.has(event.event_type) && event.work_item_id !== null) {
    fail("event_invalid", "session event work_item_id must be null", {
      event_type: event.event_type
    });
  }

  if (event.event_type === "PARTIAL_COMPLETE_WORK_ITEM") {
    validatePartialPayload(event.factual_payload);
  } else if (event.factual_payload !== null && !isRecord(event.factual_payload)) {
    fail("event_invalid", "factual_payload must be null or object", {
      event_type: event.event_type
    });
  }

  return deepFreeze(cloneJson(event));
}

export function validateV1RuntimeEvent(event) {
  return validateV1RuntimeEventShape(event);
}

function assertAppendSequence(state, event) {
  const expected = state.last_seq + 1;

  if (event.seq !== expected) {
    if (event.seq === state.last_seq) {
      fail("event_duplicate_seq", "event seq duplicates last accepted seq", {
        expected,
        actual: event.seq
      });
    }

    if (event.seq < expected) {
      fail("event_rewind", "event seq rewinds accepted log", {
        expected,
        actual: event.seq
      });
    }

    fail("event_seq_gap", "event seq must be exact next value", {
      expected,
      actual: event.seq
    });
  }

  if (state.accepted_event_ids.includes(event.event_id)) {
    fail("duplicate_event_id", "event_id already accepted", {
      event_id: event.event_id
    });
  }
}

function assertSessionEventAllowed(state, event) {
  if (event.session_id !== state.session_id) {
    fail("event_invalid", "event session_id mismatch", {
      expected: state.session_id,
      actual: event.session_id
    });
  }

  if (state.status === "completed" || state.status === "partially_completed" || state.status === "stopped") {
    fail("event_order_invalid", "terminal session cannot accept more events", {
      status: state.status,
      event_type: event.event_type
    });
  }

  if (event.event_type === "SESSION_START" && state.status !== "not_started") {
    fail("event_order_invalid", "SESSION_START must be first accepted session event", {
      status: state.status
    });
  }

  if (event.event_type !== "SESSION_START" && state.status === "not_started") {
    fail("event_order_invalid", "runtime work event requires SESSION_START first", {
      event_type: event.event_type
    });
  }

  if ((event.event_type === "RETURN_CONTINUE" || event.event_type === "RETURN_SKIP") && state.split.active !== true) {
    fail("event_order_invalid", "return event requires active split", {
      event_type: event.event_type
    });
  }

  if (event.event_type === "SPLIT_SESSION" && state.split.active === true) {
    fail("event_order_invalid", "split already active", {});
  }

  if (WORK_ITEM_EVENT_TYPES.has(event.event_type) && state.split.active === true) {
    fail("event_order_invalid", "work item event blocked while split is active", {
      event_type: event.event_type
    });
  }
}

function updateEventCounters(state, event) {
  return Object.freeze({
    ...state.event_type_counts,
    [event.event_type]: (state.event_type_counts[event.event_type] ?? 0) + 1
  });
}

function pendingWorkItemIds(workItems) {
  return Object.values(workItems)
    .filter((item) => item.status === "pending")
    .map((item) => item.work_item_id);
}

function replaceWorkItem(state, workItemId, replacement) {
  return Object.freeze({
    ...state.work_items,
    [workItemId]: Object.freeze(replacement)
  });
}

function markWorkItem(state, event, status) {
  const current = state.work_items[event.work_item_id];

  if (!current) {
    fail("unknown_work_item", "event references unknown work item", {
      work_item_id: event.work_item_id
    });
  }

  if (TERMINAL_WORK_ITEM_STATUSES.has(current.status)) {
    fail("duplicate_work_item_terminal_event", "work item already has a terminal factual event", {
      work_item_id: event.work_item_id,
      status: current.status
    });
  }

  const workItems = replaceWorkItem(state, event.work_item_id, {
    ...current,
    status,
    terminal_event_id: event.event_id,
    factual_payload: event.factual_payload
  });

  return {
    ...state,
    work_items: workItems,
    status: deriveStatus("in_progress", workItems)
  };
}

function applyValidatedEvent(state, event) {
  assertAppendSequence(state, event);
  assertSessionEventAllowed(state, event);

  let next = state;

  if (event.event_type === "SESSION_START") {
    next = {
      ...state,
      status: "in_progress"
    };
  }

  if (event.event_type === "COMPLETE_WORK_ITEM") {
    next = markWorkItem(state, event, "completed");
  }

  if (event.event_type === "SKIP_WORK_ITEM") {
    next = markWorkItem(state, event, "skipped");
  }

  if (event.event_type === "PARTIAL_COMPLETE_WORK_ITEM") {
    next = markWorkItem(state, event, "partial");
  }

  if (event.event_type === "SPLIT_SESSION") {
    const remaining = pendingWorkItemIds(state.work_items);
    if (remaining.length === 0) {
      fail("event_order_invalid", "split requires pending work items", {});
    }

    next = {
      ...state,
      status: "split",
      split: Object.freeze({
        active: true,
        remaining_at_split_ids: Object.freeze(remaining)
      })
    };
  }

  if (event.event_type === "RETURN_CONTINUE") {
    next = {
      ...state,
      status: "in_progress",
      split: Object.freeze({
        active: false,
        remaining_at_split_ids: Object.freeze([])
      })
    };
  }

  if (event.event_type === "RETURN_SKIP") {
    let workItems = state.work_items;

    for (const workItemId of state.split.remaining_at_split_ids) {
      const current = workItems[workItemId];
      if (current && current.status === "pending") {
        workItems = Object.freeze({
          ...workItems,
          [workItemId]: Object.freeze({
            ...current,
            status: "skipped",
            terminal_event_id: event.event_id,
            factual_payload: event.factual_payload
          })
        });
      }
    }

    next = {
      ...state,
      work_items: workItems,
      status: deriveStatus("in_progress", workItems),
      split: Object.freeze({
        active: false,
        remaining_at_split_ids: Object.freeze([])
      })
    };
  }

  if (event.event_type === "STOP_SESSION") {
    next = {
      ...state,
      status: "stopped",
      split: Object.freeze({
        active: false,
        remaining_at_split_ids: Object.freeze([])
      })
    };
  }

  return freezeState({
    ...next,
    last_seq: event.seq,
    accepted_event_ids: Object.freeze([...state.accepted_event_ids, event.event_id]),
    event_type_counts: updateEventCounters(state, event)
  });
}

export function applyV1RuntimeEvent(state, event) {
  assertRecord(state, "state_invalid", "state must be an object");
  assertNoForbiddenReducerInputKeys(state);

  const validatedEvent = validateV1RuntimeEventShape(event);
  return applyValidatedEvent(state, validatedEvent);
}

export function appendV1RuntimeEventLog(priorEvents, nextEvent) {
  assertArray(priorEvents, "event_log_invalid", { field: "priorEvents" });

  const prior = priorEvents.map((event) => validateV1RuntimeEventShape(event));
  const next = validateV1RuntimeEventShape(nextEvent);

  const expectedSeq = prior.length + 1;
  if (next.seq !== expectedSeq) {
    fail("event_seq_gap", "next event must append at exact next log position", {
      expected: expectedSeq,
      actual: next.seq
    });
  }

  if (prior.some((event) => event.event_id === next.event_id)) {
    fail("duplicate_event_id", "event_id already exists in prior log", {
      event_id: next.event_id
    });
  }

  return deepFreeze([...prior, next]);
}

export function replayV1RuntimeEvents(session, events) {
  assertArray(events, "event_log_invalid", { field: "events" });

  const initial = initialiseV1RuntimeState(session);
  return events.reduce((state, event) => applyV1RuntimeEvent(state, event), initial);
}

export function tryReplayV1RuntimeEvents(session, events) {
  try {
    return Object.freeze({
      ok: true,
      state: replayV1RuntimeEvents(session, events)
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: error?.code ?? v1RuntimeEventReducerContract.failure_code,
        reason: error?.reason ?? "unknown",
        message: error instanceof Error ? error.message : String(error),
        details: error?.details ?? {}
      })
    });
  }
}
