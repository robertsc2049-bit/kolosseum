export type RuntimeEventType =
  | "start_session"
  | "complete_work_item"
  | "skip_work_item"
  | "partial_complete_work_item"
  | "end_session"
  | "split_session"
  | "return_to_session"
  | "resume_session";

export type RuntimeClosedReason =
  | "not_declared"
  | "time_unavailable"
  | "equipment_unavailable"
  | "user_stopped"
  | "other_closed_reason";

export type SessionRuntimeStatus =
  | "not_started"
  | "active"
  | "split"
  | "ended";

export type WorkItemRuntimeStatus =
  | "pending"
  | "completed"
  | "skipped"
  | "partial";

export type RuntimeFailureCode =
  | "invalid_event_order"
  | "unknown_event_type"
  | "unknown_work_item"
  | "duplicate_event_id"
  | "duplicate_work_item_terminal_event"
  | "runtime_state_divergence"
  | "invalid_factual_payload"
  | "explicit_null_law_violated"
  | "unknown_enum_value";

export type RuntimeFailure = {
  ok: false;
  code: RuntimeFailureCode;
  details: string;
};

export type RuntimeSuccess = {
  ok: true;
  state: SessionRuntimeState;
};

export type RuntimeResult = RuntimeSuccess | RuntimeFailure;

export type MaterialisedWorkItem = {
  work_item_id: string;
  planned_quantity: number;
  unit: string;
};

export type MaterialisedSession = {
  session_id: string;
  user_id: string;
  work_items: MaterialisedWorkItem[];
  phase1_hash: string;
  materialised_session_hash: string;
};

export type SkipPayload = {
  reason_code?: RuntimeClosedReason;
};

export type SplitPayload = {
  reason_code?: RuntimeClosedReason;
};

export type PartialCompletionPayload = {
  declared_completed_quantity: number;
  declared_planned_quantity: number;
  unit: string;
  reason_code?: RuntimeClosedReason;
};

export type RuntimeEvent = {
  event_id: string;
  session_id: string;
  user_id: string;
  event_type: RuntimeEventType;
  work_item_id: string | null;
  factual_payload: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
};

export type WorkItemRuntimeRecord = {
  work_item_id: string;
  planned_quantity: number;
  unit: string;
  status: WorkItemRuntimeStatus;
  declared_completed_quantity: number | null;
  reason_code: RuntimeClosedReason | null;
};

export type SessionRuntimeState = {
  session_id: string;
  user_id: string;
  phase1_hash: string;
  materialised_session_hash: string;
  status: SessionRuntimeStatus;
  work_items: Record<string, WorkItemRuntimeRecord>;
  runtime_events: RuntimeEvent[];
  counts: {
    total: number;
    completed: number;
    skipped: number;
    partial: number;
    pending: number;
  };
};

const runtimeEventTypes: ReadonlySet<string> = new Set([
  "start_session",
  "complete_work_item",
  "skip_work_item",
  "partial_complete_work_item",
  "end_session",
  "split_session",
  "return_to_session",
  "resume_session"
]);

const closedReasons: ReadonlySet<string> = new Set([
  "not_declared",
  "time_unavailable",
  "equipment_unavailable",
  "user_stopped",
  "other_closed_reason"
]);

function fail(code: RuntimeFailureCode, details: string): RuntimeFailure {
  return { ok: false, code, details };
}

function isRuntimeFailure(value: unknown): value is RuntimeFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { ok: unknown }).ok === false
  );
}

function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

function isRuntimeEventType(value: unknown): value is RuntimeEventType {
  return typeof value === "string" && runtimeEventTypes.has(value);
}

function isClosedReason(value: unknown): value is RuntimeClosedReason {
  return typeof value === "string" && closedReasons.has(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cloneEvent(event: RuntimeEvent): RuntimeEvent {
  return {
    event_id: event.event_id,
    session_id: event.session_id,
    user_id: event.user_id,
    event_type: event.event_type,
    work_item_id: event.work_item_id,
    factual_payload: event.factual_payload === null ? null : { ...event.factual_payload },
    occurred_at: event.occurred_at,
    created_at: event.created_at
  };
}

function recomputeCounts(workItems: Record<string, WorkItemRuntimeRecord>): SessionRuntimeState["counts"] {
  const records = Object.values(workItems);
  return {
    total: records.length,
    completed: records.filter((item) => item.status === "completed").length,
    skipped: records.filter((item) => item.status === "skipped").length,
    partial: records.filter((item) => item.status === "partial").length,
    pending: records.filter((item) => item.status === "pending").length
  };
}

function cloneState(state: SessionRuntimeState): SessionRuntimeState {
  const workItems: Record<string, WorkItemRuntimeRecord> = {};

  for (const [id, item] of Object.entries(state.work_items)) {
    workItems[id] = { ...item };
  }

  return {
    session_id: state.session_id,
    user_id: state.user_id,
    phase1_hash: state.phase1_hash,
    materialised_session_hash: state.materialised_session_hash,
    status: state.status,
    work_items: workItems,
    runtime_events: state.runtime_events.map(cloneEvent),
    counts: { ...state.counts }
  };
}

export function initialiseSessionRuntimeState(session: MaterialisedSession): SessionRuntimeState {
  const workItems: Record<string, WorkItemRuntimeRecord> = {};

  for (const item of session.work_items) {
    if (workItems[item.work_item_id]) {
      throw new Error(`duplicate materialised work_item_id: ${item.work_item_id}`);
    }

    workItems[item.work_item_id] = {
      work_item_id: item.work_item_id,
      planned_quantity: item.planned_quantity,
      unit: item.unit,
      status: "pending",
      declared_completed_quantity: null,
      reason_code: null
    };
  }

  return {
    session_id: session.session_id,
    user_id: session.user_id,
    phase1_hash: session.phase1_hash,
    materialised_session_hash: session.materialised_session_hash,
    status: "not_started",
    work_items: workItems,
    runtime_events: [],
    counts: recomputeCounts(workItems)
  };
}

function assertCommonEventShape(state: SessionRuntimeState, event: RuntimeEvent): RuntimeFailure | null {
  if (!event.event_id) return fail("explicit_null_law_violated", "event_id is required.");
  if (!event.session_id) return fail("explicit_null_law_violated", "session_id is required.");
  if (!event.user_id) return fail("explicit_null_law_violated", "user_id is required.");
  if (!isRuntimeEventType(event.event_type)) return fail("unknown_event_type", "event_type is not in the runtime event enum.");
  if (!isIsoDateTime(event.occurred_at)) return fail("invalid_factual_payload", "occurred_at must be ISO-8601 parseable.");
  if (!isIsoDateTime(event.created_at)) return fail("invalid_factual_payload", "created_at must be ISO-8601 parseable.");

  if (event.session_id !== state.session_id) {
    return fail("runtime_state_divergence", "event session_id does not match materialised session.");
  }

  if (event.user_id !== state.user_id) {
    return fail("runtime_state_divergence", "event user_id does not match materialised session owner.");
  }

  if (state.runtime_events.some((existing) => existing.event_id === event.event_id)) {
    return fail("duplicate_event_id", "event_id already exists in runtime history.");
  }

  return null;
}

function assertSessionLevelEvent(event: RuntimeEvent): RuntimeFailure | null {
  if (event.work_item_id !== null) {
    return fail("invalid_factual_payload", "session-level event must use work_item_id null.");
  }

  return null;
}

function assertWorkItemEvent(state: SessionRuntimeState, event: RuntimeEvent): RuntimeFailure | WorkItemRuntimeRecord {
  if (typeof event.work_item_id !== "string" || event.work_item_id.length === 0) {
    return fail("explicit_null_law_violated", "work_item_id is required for work-item events.");
  }

  const workItem = state.work_items[event.work_item_id];
  if (!workItem) {
    return fail("unknown_work_item", "work_item_id does not exist in the materialised session.");
  }

  return workItem;
}

function assertNullPayload(event: RuntimeEvent): RuntimeFailure | null {
  if (event.factual_payload !== null) {
    return fail("invalid_factual_payload", `${event.event_type} requires factual_payload null.`);
  }

  return null;
}

function parseOptionalReason(payload: Record<string, unknown> | null): RuntimeFailure | RuntimeClosedReason | null {
  if (payload === null || payload.reason_code === undefined) return null;

  if (!isClosedReason(payload.reason_code)) {
    return fail("unknown_enum_value", "reason_code is not in the closed reason enum.");
  }

  return payload.reason_code;
}

function assertPayloadKeys(payload: Record<string, unknown>, allowedKeys: string[]): RuntimeFailure | null {
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.includes(key)) {
      return fail("invalid_factual_payload", `unexpected payload field: ${key}`);
    }
  }

  return null;
}

function parseSkipPayload(event: RuntimeEvent): RuntimeFailure | SkipPayload {
  if (event.factual_payload === null) return {};
  const keyFailure = assertPayloadKeys(event.factual_payload, ["reason_code"]);
  if (keyFailure) return keyFailure;

  const reason = parseOptionalReason(event.factual_payload);
  if (reason && typeof reason === "object") return reason;

  return reason === null ? {} : { reason_code: reason };
}

function parseSplitPayload(event: RuntimeEvent): RuntimeFailure | SplitPayload {
  if (event.factual_payload === null) return {};
  const keyFailure = assertPayloadKeys(event.factual_payload, ["reason_code"]);
  if (keyFailure) return keyFailure;

  const reason = parseOptionalReason(event.factual_payload);
  if (reason && typeof reason === "object") return reason;

  return reason === null ? {} : { reason_code: reason };
}

function parsePartialPayload(event: RuntimeEvent, workItem: WorkItemRuntimeRecord): RuntimeFailure | PartialCompletionPayload {
  if (event.factual_payload === null) {
    return fail("explicit_null_law_violated", "partial_complete_work_item requires factual_payload.");
  }

  const keyFailure = assertPayloadKeys(event.factual_payload, [
    "declared_completed_quantity",
    "declared_planned_quantity",
    "unit",
    "reason_code"
  ]);
  if (keyFailure) return keyFailure;

  const completed = event.factual_payload.declared_completed_quantity;
  const planned = event.factual_payload.declared_planned_quantity;
  const unit = event.factual_payload.unit;

  if (!isFiniteNumber(completed) || completed < 0) {
    return fail("invalid_factual_payload", "declared_completed_quantity must be a finite number greater than or equal to zero.");
  }

  if (!isFiniteNumber(planned) || planned <= 0) {
    return fail("invalid_factual_payload", "declared_planned_quantity must be a finite number greater than zero.");
  }

  if (completed >= planned) {
    return fail("invalid_factual_payload", "partial completion quantity must be less than planned quantity.");
  }

  if (typeof unit !== "string" || unit.length === 0) {
    return fail("invalid_factual_payload", "unit must be a non-empty string.");
  }

  if (planned !== workItem.planned_quantity) {
    return fail("invalid_factual_payload", "declared_planned_quantity must echo the planned work-item quantity.");
  }

  if (unit !== workItem.unit) {
    return fail("invalid_factual_payload", "unit must echo the planned work-item unit.");
  }

  const reason = parseOptionalReason(event.factual_payload);
  if (reason && typeof reason === "object") return reason;

  return {
    declared_completed_quantity: completed,
    declared_planned_quantity: planned,
    unit,
    ...(reason === null ? {} : { reason_code: reason })
  };
}

function append(state: SessionRuntimeState, event: RuntimeEvent): void {
  state.runtime_events.push(cloneEvent(event));
  state.counts = recomputeCounts(state.work_items);
}

function assertTerminalWorkItemIsPending(workItem: WorkItemRuntimeRecord): RuntimeFailure | null {
  if (workItem.status !== "pending") {
    return fail("duplicate_work_item_terminal_event", "work item already has a terminal runtime state.");
  }

  return null;
}

export function applyRuntimeEvent(previousState: SessionRuntimeState, event: RuntimeEvent): RuntimeResult {
  const commonFailure = assertCommonEventShape(previousState, event);
  if (commonFailure) return commonFailure;

  const state = cloneState(previousState);

  switch (event.event_type) {
    case "start_session": {
      const sessionLevelFailure = assertSessionLevelEvent(event);
      if (sessionLevelFailure) return sessionLevelFailure;

      const payloadFailure = assertNullPayload(event);
      if (payloadFailure) return payloadFailure;

      if (state.status !== "not_started") {
        return fail("invalid_event_order", "start_session is legal only from not_started.");
      }

      state.status = "active";
      append(state, event);
      return { ok: true, state };
    }

    case "complete_work_item": {
      if (state.status !== "active") {
        return fail("invalid_event_order", "complete_work_item is legal only while active.");
      }

      const payloadFailure = assertNullPayload(event);
      if (payloadFailure) return payloadFailure;

      const workItem = assertWorkItemEvent(state, event);
      if (isRuntimeFailure(workItem)) return workItem;

      const terminalFailure = assertTerminalWorkItemIsPending(workItem);
      if (terminalFailure) return terminalFailure;

      workItem.status = "completed";
      workItem.declared_completed_quantity = workItem.planned_quantity;
      workItem.reason_code = null;
      append(state, event);
      return { ok: true, state };
    }

    case "skip_work_item": {
      if (state.status !== "active") {
        return fail("invalid_event_order", "skip_work_item is legal only while active.");
      }

      const workItem = assertWorkItemEvent(state, event);
      if (isRuntimeFailure(workItem)) return workItem;

      const terminalFailure = assertTerminalWorkItemIsPending(workItem);
      if (terminalFailure) return terminalFailure;

      const payload = parseSkipPayload(event);
      if (isRuntimeFailure(payload)) return payload;

      workItem.status = "skipped";
      workItem.declared_completed_quantity = 0;
      workItem.reason_code = payload.reason_code ?? null;
      append(state, event);
      return { ok: true, state };
    }

    case "partial_complete_work_item": {
      if (state.status !== "active") {
        return fail("invalid_event_order", "partial_complete_work_item is legal only while active.");
      }

      const workItem = assertWorkItemEvent(state, event);
      if (isRuntimeFailure(workItem)) return workItem;

      const terminalFailure = assertTerminalWorkItemIsPending(workItem);
      if (terminalFailure) return terminalFailure;

      const payload = parsePartialPayload(event, workItem);
      if (isRuntimeFailure(payload)) return payload;

      workItem.status = "partial";
      workItem.declared_completed_quantity = payload.declared_completed_quantity;
      workItem.reason_code = payload.reason_code ?? null;
      append(state, event);
      return { ok: true, state };
    }

    case "end_session": {
      const sessionLevelFailure = assertSessionLevelEvent(event);
      if (sessionLevelFailure) return sessionLevelFailure;

      const payloadFailure = assertNullPayload(event);
      if (payloadFailure) return payloadFailure;

      if (state.status !== "active") {
        return fail("invalid_event_order", "end_session is legal only while active.");
      }

      state.status = "ended";
      append(state, event);
      return { ok: true, state };
    }

    case "split_session": {
      const sessionLevelFailure = assertSessionLevelEvent(event);
      if (sessionLevelFailure) return sessionLevelFailure;

      if (state.status !== "active") {
        return fail("invalid_event_order", "split_session is legal only while active.");
      }

      const payload = parseSplitPayload(event);
      if (isRuntimeFailure(payload)) return payload;

      state.status = "split";
      append(state, event);
      return { ok: true, state };
    }

    case "return_to_session": {
      const sessionLevelFailure = assertSessionLevelEvent(event);
      if (sessionLevelFailure) return sessionLevelFailure;

      const payloadFailure = assertNullPayload(event);
      if (payloadFailure) return payloadFailure;

      if (state.status !== "split") {
        return fail("invalid_event_order", "return_to_session is legal only while split.");
      }

      append(state, event);
      return { ok: true, state };
    }

    case "resume_session": {
      const sessionLevelFailure = assertSessionLevelEvent(event);
      if (sessionLevelFailure) return sessionLevelFailure;

      const payloadFailure = assertNullPayload(event);
      if (payloadFailure) return payloadFailure;

      if (state.status !== "split") {
        return fail("invalid_event_order", "resume_session is legal only while split.");
      }

      state.status = "active";
      append(state, event);
      return { ok: true, state };
    }

    default:
      return fail("unknown_event_type", "event_type is not in the runtime event enum.");
  }
}

export function replayRuntimeEvents(session: MaterialisedSession, events: RuntimeEvent[]): RuntimeResult {
  let state = initialiseSessionRuntimeState(session);

  for (const event of events) {
    const result = applyRuntimeEvent(state, event);
    if (!result.ok) return result;
    state = result.state;
  }

  return { ok: true, state };
}