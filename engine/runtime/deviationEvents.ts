
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

export type DeviationRuntimeEventType =
  | "extra_work_recorded"
  | "work_modified_recorded";

export type QuantityUnit = "kg" | "lb" | "bodyweight" | "none";

export type Quantity = {
  sets?: number;
  reps?: number;
  load_value?: number;
  load_unit?: QuantityUnit;
  duration_seconds?: number;
  distance_meters?: number;
  completed?: boolean;
};

export type ExtraWorkRecordedPayload = {
  extra_work_item_id: string;
  exercise_token_id: string;
  quantity: Quantity;
  planned_item_effect: "none";
};

export type WorkModifiedRecordedPayload = {
  planned_work_item_id: string;
  modification_type:
    | "sets_changed"
    | "reps_changed"
    | "load_changed"
    | "duration_changed"
    | "distance_changed"
    | "item_not_done_as_planned";
  before: Quantity;
  after: Quantity;
  planned_item_effect: "none";
};

export type DeviationRuntimeEvent =
  | {
      event_id: string;
      event_type: "extra_work_recorded";
      session_id: string;
      work_item_id: null;
      actor_user_id: string;
      occurred_at_iso8601: string;
      recorded_at_iso8601: string;
      monotonic_index: number;
      payload: ExtraWorkRecordedPayload;
    }
  | {
      event_id: string;
      event_type: "work_modified_recorded";
      session_id: string;
      work_item_id: string;
      actor_user_id: string;
      occurred_at_iso8601: string;
      recorded_at_iso8601: string;
      monotonic_index: number;
      payload: WorkModifiedRecordedPayload;
    };

export type PlannedWorkItem = {
  work_item_id: string;
  exercise_token_id: string;
  quantity: Quantity;
};

export type Phase5Session = {
  session_id: string;
  work_items: PlannedWorkItem[];
};

export type Phase5Program = {
  sessions: Phase5Session[];
};

export type Phase5OutputLike = {
  canonical_input_hash: string;
  selection_hash: string;
  program: Phase5Program;
};

export type DeviationHistoryRow = {
  event_id: string;
  event_type: DeviationRuntimeEventType;
  session_id: string;
  work_item_id: string | null;
  actor_user_id: string;
  occurred_at_iso8601: string;
  recorded_at_iso8601: string;
  monotonic_index: number;
  neutral_copy_id:
    | "EXTRA_WORK_RECORDED"
    | "WORK_MODIFIED_RECORDED"
    | "DEVIATION_EVENT_RECORDED";
  payload: ExtraWorkRecordedPayload | WorkModifiedRecordedPayload;
};

export type ExecutionStateWithDeviationEvents = {
  phase5_output: Phase5OutputLike;
  runtime_events: DeviationRuntimeEvent[];
  deviation_history: DeviationHistoryRow[];
};

export class DeviationEventValidationError extends Error {
  readonly code:
    | "unknown_event_type"
    | "missing_required_field"
    | "unknown_field"
    | "invalid_payload_shape"
    | "unknown_session_id"
    | "unknown_work_item"
    | "non_monotonic_event_index"
    | "planned_item_mutation_attempt";

  constructor(
    code: DeviationEventValidationError["code"],
    message: string
  ) {
    super(message);
    this.name = "DeviationEventValidationError";
    this.code = code;
  }
}

const COMMON_EVENT_KEYS = [
  "event_id",
  "event_type",
  "session_id",
  "work_item_id",
  "actor_user_id",
  "occurred_at_iso8601",
  "recorded_at_iso8601",
  "monotonic_index",
  "payload"
] as const;

const EXTRA_WORK_PAYLOAD_KEYS = [
  "extra_work_item_id",
  "exercise_token_id",
  "quantity",
  "planned_item_effect"
] as const;

const WORK_MODIFIED_PAYLOAD_KEYS = [
  "planned_work_item_id",
  "modification_type",
  "before",
  "after",
  "planned_item_effect"
] as const;

const QUANTITY_KEYS = [
  "sets",
  "reps",
  "load_value",
  "load_unit",
  "duration_seconds",
  "distance_meters",
  "completed"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  location: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new DeviationEventValidationError(
        "unknown_field",
        `${location}.${key} is not allowed.`
      );
    }
  }

  for (const key of allowedKeys) {
    if (!(key in value)) {
      throw new DeviationEventValidationError(
        "missing_required_field",
        `${location}.${key} is required.`
      );
    }
  }
}

function assertQuantity(value: unknown, location: string): asserts value is Quantity {
  if (!isRecord(value)) {
    throw new DeviationEventValidationError(
      "invalid_payload_shape",
      `${location} must be an object.`
    );
  }

  for (const key of Object.keys(value)) {
    if (!QUANTITY_KEYS.includes(key as (typeof QUANTITY_KEYS)[number])) {
      throw new DeviationEventValidationError(
        "unknown_field",
        `${location}.${key} is not allowed.`
      );
    }
  }

  if (
    !("sets" in value) &&
    !("reps" in value) &&
    !("load_value" in value) &&
    !("duration_seconds" in value) &&
    !("distance_meters" in value) &&
    !("completed" in value)
  ) {
    throw new DeviationEventValidationError(
      "invalid_payload_shape",
      `${location} must contain at least one factual quantity field.`
    );
  }

  for (const [key, raw] of Object.entries(value)) {
    if (key === "load_unit") {
      if (
        raw !== "kg" &&
        raw !== "lb" &&
        raw !== "bodyweight" &&
        raw !== "none"
      ) {
        throw new DeviationEventValidationError(
          "invalid_payload_shape",
          `${location}.load_unit is invalid.`
        );
      }
      continue;
    }

    if (key === "completed") {
      if (typeof raw !== "boolean") {
        throw new DeviationEventValidationError(
          "invalid_payload_shape",
          `${location}.completed must be boolean.`
        );
      }
      continue;
    }

    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new DeviationEventValidationError(
        "invalid_payload_shape",
        `${location}.${key} must be a finite number.`
      );
    }
  }
}

function assertIso8601(value: unknown, location: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DeviationEventValidationError(
      "invalid_payload_shape",
      `${location} must be a non-empty ISO8601 string.`
    );
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new DeviationEventValidationError(
      "invalid_payload_shape",
      `${location} must parse as ISO8601.`
    );
  }
}

function assertNonEmptyString(value: unknown, location: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DeviationEventValidationError(
      "invalid_payload_shape",
      `${location} must be a non-empty string.`
    );
  }
}

function findSession(phase5Output: Phase5OutputLike, sessionId: string): Phase5Session | null {
  return phase5Output.program.sessions.find((session) => session.session_id === sessionId) ?? null;
}

function findWorkItem(session: Phase5Session, workItemId: string): PlannedWorkItem | null {
  return session.work_items.find((item) => item.work_item_id === workItemId) ?? null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
    .join(",")}}`;
}

export function validateDeviationEvent(
  state: ExecutionStateWithDeviationEvents,
  rawEvent: unknown
): asserts rawEvent is DeviationRuntimeEvent {
  if (!isRecord(rawEvent)) {
    throw new DeviationEventValidationError(
      "invalid_payload_shape",
      "event must be an object."
    );
  }

  assertExactKeys(rawEvent, COMMON_EVENT_KEYS, "event");

  assertNonEmptyString(rawEvent.event_id, "event.event_id");
  assertNonEmptyString(rawEvent.session_id, "event.session_id");
  assertNonEmptyString(rawEvent.actor_user_id, "event.actor_user_id");
  assertIso8601(rawEvent.occurred_at_iso8601, "event.occurred_at_iso8601");
  assertIso8601(rawEvent.recorded_at_iso8601, "event.recorded_at_iso8601");

  if (typeof rawEvent.monotonic_index !== "number" || !Number.isInteger(rawEvent.monotonic_index)) {
    throw new DeviationEventValidationError(
      "invalid_payload_shape",
      "event.monotonic_index must be an integer."
    );
  }

  const expectedIndex = state.runtime_events.length === 0
    ? 1
    : state.runtime_events[state.runtime_events.length - 1].monotonic_index + 1;

  if (rawEvent.monotonic_index !== expectedIndex) {
    throw new DeviationEventValidationError(
      "non_monotonic_event_index",
      `event.monotonic_index must be ${expectedIndex}.`
    );
  }

  const session = findSession(state.phase5_output, rawEvent.session_id);
  if (!session) {
    throw new DeviationEventValidationError(
      "unknown_session_id",
      "event.session_id does not resolve to Phase 5 output."
    );
  }

  if (rawEvent.event_type === "extra_work_recorded") {
    if (rawEvent.work_item_id !== null) {
      throw new DeviationEventValidationError(
        "planned_item_mutation_attempt",
        "extra_work_recorded must not target a planned work item."
      );
    }

    if (!isRecord(rawEvent.payload)) {
      throw new DeviationEventValidationError(
        "invalid_payload_shape",
        "event.payload must be an object."
      );
    }

    assertExactKeys(rawEvent.payload, EXTRA_WORK_PAYLOAD_KEYS, "event.payload");
    assertNonEmptyString(rawEvent.payload.extra_work_item_id, "event.payload.extra_work_item_id");
    assertNonEmptyString(rawEvent.payload.exercise_token_id, "event.payload.exercise_token_id");
    assertQuantity(rawEvent.payload.quantity, "event.payload.quantity");

    if (rawEvent.payload.planned_item_effect !== "none") {
      throw new DeviationEventValidationError(
        "planned_item_mutation_attempt",
        "extra_work_recorded planned_item_effect must be none."
      );
    }

    return;
  }

  if (rawEvent.event_type === "work_modified_recorded") {
    assertNonEmptyString(rawEvent.work_item_id, "event.work_item_id");

    const plannedItem = findWorkItem(session, rawEvent.work_item_id);
    if (!plannedItem) {
      throw new DeviationEventValidationError(
        "unknown_work_item",
        "event.work_item_id does not resolve to Phase 5 output."
      );
    }

    if (!isRecord(rawEvent.payload)) {
      throw new DeviationEventValidationError(
        "invalid_payload_shape",
        "event.payload must be an object."
      );
    }

    assertExactKeys(rawEvent.payload, WORK_MODIFIED_PAYLOAD_KEYS, "event.payload");
    assertNonEmptyString(rawEvent.payload.planned_work_item_id, "event.payload.planned_work_item_id");

    if (rawEvent.payload.planned_work_item_id !== rawEvent.work_item_id) {
      throw new DeviationEventValidationError(
        "unknown_work_item",
        "event.payload.planned_work_item_id must equal event.work_item_id."
      );
    }

    if (
      rawEvent.payload.modification_type !== "sets_changed" &&
      rawEvent.payload.modification_type !== "reps_changed" &&
      rawEvent.payload.modification_type !== "load_changed" &&
      rawEvent.payload.modification_type !== "duration_changed" &&
      rawEvent.payload.modification_type !== "distance_changed" &&
      rawEvent.payload.modification_type !== "item_not_done_as_planned"
    ) {
      throw new DeviationEventValidationError(
        "invalid_payload_shape",
        "event.payload.modification_type is invalid."
      );
    }

    assertQuantity(rawEvent.payload.before, "event.payload.before");
    assertQuantity(rawEvent.payload.after, "event.payload.after");

    if (rawEvent.payload.planned_item_effect !== "none") {
      throw new DeviationEventValidationError(
        "planned_item_mutation_attempt",
        "work_modified_recorded planned_item_effect must be none."
      );
    }

    return;
  }

  throw new DeviationEventValidationError(
    "unknown_event_type",
    "event.event_type is not supported by S36."
  );
}

export function reduceDeviationEvent(
  state: ExecutionStateWithDeviationEvents,
  event: DeviationRuntimeEvent
): ExecutionStateWithDeviationEvents {
  const phase5Before = canonicalJson(state.phase5_output);

  validateDeviationEvent(state, event);

  const neutral_copy_id =
    event.event_type === "extra_work_recorded"
      ? "EXTRA_WORK_RECORDED"
      : "WORK_MODIFIED_RECORDED";

  const nextState: ExecutionStateWithDeviationEvents = {
    phase5_output: state.phase5_output,
    runtime_events: [...state.runtime_events, cloneJson(event)],
    deviation_history: [
      ...state.deviation_history,
      {
        event_id: event.event_id,
        event_type: event.event_type,
        session_id: event.session_id,
        work_item_id: event.work_item_id,
        actor_user_id: event.actor_user_id,
        occurred_at_iso8601: event.occurred_at_iso8601,
        recorded_at_iso8601: event.recorded_at_iso8601,
        monotonic_index: event.monotonic_index,
        neutral_copy_id,
        payload: cloneJson(event.payload)
      }
    ]
  };

  const phase5After = canonicalJson(nextState.phase5_output);
  if (phase5Before !== phase5After) {
    throw new DeviationEventValidationError(
      "planned_item_mutation_attempt",
      "deviation reducer attempted to mutate Phase 5 output."
    );
  }

  return nextState;
}

export function createInitialDeviationExecutionState(
  phase5Output: Phase5OutputLike
): ExecutionStateWithDeviationEvents {
  return {
    phase5_output: phase5Output,
    runtime_events: [],
    deviation_history: []
  };
}

export function compileFutureSessionIgnoringDeviationEvents(
  phase1CanonicalInput: unknown,
  previousDeviationEvents: readonly DeviationRuntimeEvent[]
): string {
  void previousDeviationEvents;
  return canonicalJson({
    compile_scope: "v0_phase1_to_phase6",
    phase1_canonical_input: phase1CanonicalInput
  });
}
