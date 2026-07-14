// DEV NOTE: BETA-18 closed-world Phase 7 schema and binding surface.
// The only truth-bearing input is the validated Phase 6 output envelope.
// Product, coach, payment, organisation, UI, and copy state are forbidden.

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "./betaCanonical.js";

type JsonRecord =
  Record<string, unknown>;

export type Beta18Phase7FailureToken =
  | "phase7_binding_mismatch"
  | "phase7_forbidden_input"
  | "phase7_input_invalid"
  | "phase7_output_invalid"
  | "phase7_projection_hash_mismatch"
  | "phase7_projection_id_missing";

export type Beta18ExecutionStatus =
  | "not_started"
  | "in_progress"
  | "split"
  | "completed"
  | "partial"
  | "terminated";

export type Beta18Phase6Truth = Readonly<{
  canonical_input_hash: string;
  selection_hash: string;
  execution_status:
    Beta18ExecutionStatus;
  execution_state:
    Readonly<JsonRecord>;
}>;

export type Phase7Input = Readonly<{
  phase7_projection_id: string;
  content_format:
    "application/json";
  phase6_output:
    Beta18Phase6Truth;
}>;

export type Phase7Output = Readonly<{
  phase7_projection_id: string;
  canonical_input_hash: string;
  selection_hash: string;
  execution_status:
    Beta18ExecutionStatus;
  execution_state:
    Readonly<JsonRecord>;
  content_format:
    "application/json";
  rendered_output: string;
  projection_hash: string;
}>;

export type Beta18Phase7Result =
  | Readonly<{
      ok: true;
      phase7: Phase7Output;
    }>
  | Readonly<{
      ok: false;
      failure_token:
        Beta18Phase7FailureToken;
      details:
        Readonly<JsonRecord>;
    }>;

export const beta18Phase7SchemaBindingContract =
  Object.freeze({
    schema_id:
      "beta18_phase7_schema_binding",
    slice_id: "BETA-18",
    version: "1.0.0",
    input_source:
      "phase6_output_only",
    projection_hash_policy:
      "computed_sha256",
    content_formats:
      Object.freeze([
        "application/json"
      ]),
    binding_echoes:
      Object.freeze([
        "canonical_input_hash",
        "selection_hash",
        "execution_status",
        "execution_state"
      ]),
    product_state_allowed:
      false
  });

const PHASE7_INPUT_KEYS =
  Object.freeze([
    "phase7_projection_id",
    "content_format",
    "phase6_output"
  ]);

const PHASE6_OUTPUT_KEYS =
  Object.freeze([
    "canonical_input_hash",
    "selection_hash",
    "execution_status",
    "execution_state"
  ]);

const PHASE7_OUTPUT_KEYS =
  Object.freeze([
    "phase7_projection_id",
    "canonical_input_hash",
    "selection_hash",
    "execution_status",
    "execution_state",
    "content_format",
    "rendered_output",
    "projection_hash"
  ]);

const EXECUTION_STATE_KEYS =
  Object.freeze([
    "reducer_contract_id",
    "reducer_version",
    "session_id",
    "activity_id",
    "status",
    "classification",
    "session_ended",
    "end_code",
    "ended_by_event_id",
    "last_seq",
    "accepted_event_ids",
    "event_type_counts",
    "split",
    "work_item_order",
    "work_items",
    "pain_follow_up",
    "counts",
    "reducer_state_hash"
  ]);

const SPLIT_KEYS =
  Object.freeze([
    "active",
    "entered_event_id",
    "remaining_at_split_ids"
  ]);

const WORK_ITEM_KEYS =
  Object.freeze([
    "work_item_id",
    "block_id",
    "exercise_id",
    "status",
    "started_event_id",
    "terminal_event_id",
    "terminal_source"
  ]);

const PAIN_RECORD_KEYS =
  Object.freeze([
    "work_item_id",
    "follow_up_pending",
    "flag_event_ids",
    "follow_up_event_ids",
    "latest_response_code"
  ]);

const COUNT_KEYS =
  Object.freeze([
    "total",
    "pending",
    "active",
    "completed",
    "skipped"
  ] as const);

const EXECUTION_STATUSES =
  new Set<Beta18ExecutionStatus>([
    "not_started",
    "in_progress",
    "split",
    "completed",
    "partial",
    "terminated"
  ]);

const TERMINAL_STATUSES =
  new Set<Beta18ExecutionStatus>([
    "completed",
    "partial",
    "terminated"
  ]);

const WORK_ITEM_STATUSES =
  new Set([
    "pending",
    "active",
    "completed",
    "skipped"
  ]);

const EVENT_TYPES =
  new Set([
    "SESSION_START",
    "WORK_ITEM_START",
    "WORK_ITEM_DONE",
    "WORK_ITEM_SKIP",
    "SPLIT_ENTER",
    "SPLIT_RETURN_DECISION",
    "PAIN_FLAG",
    "PAIN_FOLLOW_UP",
    "SESSION_END"
  ]);

const FORBIDDEN_EXACT_KEYS =
  new Set([
    "coach_note",
    "coach_notes",
    "payment_state",
    "billing_state",
    "product_tier",
    "subscription_tier",
    "organisation_metadata",
    "organization_metadata",
    "org_metadata",
    "ui_state",
    "presentation_state",
    "copy",
    "copy_id",
    "copy_ids",
    "copy_string",
    "copy_strings",
    "copy_text",
    "user_copy",
    "browser_copy"
  ]);

export class Beta18Phase7SchemaError
  extends Error {
  readonly failure_token:
    Beta18Phase7FailureToken;

  readonly details:
    Readonly<JsonRecord>;

  constructor(
    failureToken:
      Beta18Phase7FailureToken,
    message: string,
    details: JsonRecord = {}
  ) {
    super(
      `${failureToken}: ${message}`
    );

    this.name =
      "Beta18Phase7SchemaError";

    this.failure_token =
      failureToken;

    this.details =
      Object.freeze({
        ...details
      });
  }
}

function fail(
  failureToken:
    Beta18Phase7FailureToken,
  message: string,
  details: JsonRecord = {}
): never {
  throw new Beta18Phase7SchemaError(
    failureToken,
    message,
    details
  );
}

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasOwn(
  value: JsonRecord,
  key: string
): boolean {
  return Object.prototype
    .hasOwnProperty.call(
      value,
      key
    );
}

function cloneJson<T>(
  value: T
): T {
  return JSON.parse(
    JSON.stringify(value)
  ) as T;
}

function deepFreeze<T>(
  value: T
): T {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      deepFreeze(child);
    }
  }
  else {
    for (
      const child
      of Object.values(
        value as JsonRecord
      )
    ) {
      deepFreeze(child);
    }
  }

  return Object.freeze(value);
}

function assertRecord(
  value: unknown,
  failureToken:
    Beta18Phase7FailureToken,
  objectName: string
): asserts value is JsonRecord {
  if (!isRecord(value)) {
    fail(
      failureToken,
      `${objectName} must be an object.`,
      {
        object: objectName
      }
    );
  }
}

function assertExactKeys(
  value: JsonRecord,
  requiredKeys:
    readonly string[],
  failureToken:
    Beta18Phase7FailureToken,
  objectName: string
): void {
  const required =
    new Set(requiredKeys);

  for (
    const key
    of Object.keys(value)
  ) {
    if (!required.has(key)) {
      fail(
        failureToken,
        `${objectName} contains an unknown field.`,
        {
          object: objectName,
          field: key
        }
      );
    }
  }

  for (const key of requiredKeys) {
    if (!hasOwn(value, key)) {
      fail(
        failureToken,
        `${objectName} is missing a required field.`,
        {
          object: objectName,
          field: key
        }
      );
    }
  }
}

function isForbiddenKey(
  key: string
): boolean {
  const normalised =
    key.toLowerCase();

  return (
    FORBIDDEN_EXACT_KEYS.has(
      normalised
    ) ||
    normalised.includes(
      "coach_note"
    ) ||
    normalised.startsWith(
      "payment_"
    ) ||
    normalised.startsWith(
      "billing_"
    ) ||
    normalised.startsWith(
      "product_tier"
    ) ||
    normalised.startsWith(
      "subscription_tier"
    ) ||
    normalised.startsWith(
      "organisation_"
    ) ||
    normalised.startsWith(
      "organization_"
    ) ||
    normalised.startsWith(
      "org_metadata"
    ) ||
    normalised.startsWith(
      "ui_"
    ) ||
    normalised.startsWith(
      "copy_"
    ) ||
    normalised.endsWith(
      "_copy"
    )
  );
}

function assertNoForbiddenState(
  value: unknown,
  pathParts:
    readonly string[] = []
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (child, index) =>
        assertNoForbiddenState(
          child,
          [
            ...pathParts,
            String(index)
          ]
        )
    );

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (
    const [key, child]
    of Object.entries(value)
  ) {
    if (isForbiddenKey(key)) {
      fail(
        "phase7_forbidden_input",
        "Product, coach, UI, or copy state is forbidden from Phase 7 input.",
        {
          field: key,
          path: [
            ...pathParts,
            key
          ].join(".")
        }
      );
    }

    assertNoForbiddenState(
      child,
      [
        ...pathParts,
        key
      ]
    );
  }
}

function assertNonEmptyString(
  value: unknown,
  failureToken:
    Beta18Phase7FailureToken,
  field: string
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    fail(
      failureToken,
      `${field} must be a non-empty string.`,
      { field }
    );
  }
}

function assertStringOrNull(
  value: unknown,
  failureToken:
    Beta18Phase7FailureToken,
  field: string
): void {
  if (
    value !== null &&
    typeof value !== "string"
  ) {
    fail(
      failureToken,
      `${field} must be a string or null.`,
      { field }
    );
  }
}

function assertBoolean(
  value: unknown,
  failureToken:
    Beta18Phase7FailureToken,
  field: string
): asserts value is boolean {
  if (typeof value !== "boolean") {
    fail(
      failureToken,
      `${field} must be boolean.`,
      { field }
    );
  }
}

function assertNonNegativeInteger(
  value: unknown,
  failureToken:
    Beta18Phase7FailureToken,
  field: string
): asserts value is number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0
  ) {
    fail(
      failureToken,
      `${field} must be a non-negative safe integer.`,
      { field }
    );
  }
}

function assertStringArray(
  value: unknown,
  failureToken:
    Beta18Phase7FailureToken,
  field: string
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.length === 0
    )
  ) {
    fail(
      failureToken,
      `${field} must be an array of non-empty strings.`,
      { field }
    );
  }
}

function assertHash(
  value: unknown,
  failureToken:
    Beta18Phase7FailureToken,
  field: string
): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value)
  ) {
    fail(
      failureToken,
      `${field} must be a lowercase SHA-256 hash.`,
      { field }
    );
  }
}

function assertExecutionStatus(
  value: unknown,
  failureToken:
    Beta18Phase7FailureToken,
  field: string
): asserts value is
  Beta18ExecutionStatus {
  if (
    typeof value !== "string" ||
    !EXECUTION_STATUSES.has(
      value as Beta18ExecutionStatus
    )
  ) {
    fail(
      failureToken,
      `${field} is not a recognised Phase 6 execution status.`,
      {
        field,
        actual: value
      }
    );
  }
}

function assertExecutionState(
  value: unknown
): asserts value is JsonRecord {
  assertRecord(
    value,
    "phase7_input_invalid",
    "execution_state"
  );

  assertExactKeys(
    value,
    EXECUTION_STATE_KEYS,
    "phase7_input_invalid",
    "execution_state"
  );

  assertNoForbiddenState(
    value,
    ["execution_state"]
  );

  if (
    value.reducer_contract_id !==
      "beta14_phase6_runtime_reducer" ||
    value.reducer_version !==
      "1.0.0"
  ) {
    fail(
      "phase7_input_invalid",
      "Execution state is not a BETA-14 Phase 6 reducer state."
    );
  }

  assertNonEmptyString(
    value.session_id,
    "phase7_input_invalid",
    "execution_state.session_id"
  );

  assertStringOrNull(
    value.activity_id,
    "phase7_input_invalid",
    "execution_state.activity_id"
  );

  assertExecutionStatus(
    value.status,
    "phase7_input_invalid",
    "execution_state.status"
  );

  if (
    value.classification !== null &&
    value.classification !==
      "completed" &&
    value.classification !==
      "partial" &&
    value.classification !==
      "terminated"
  ) {
    fail(
      "phase7_input_invalid",
      "execution_state.classification is invalid."
    );
  }

  assertBoolean(
    value.session_ended,
    "phase7_input_invalid",
    "execution_state.session_ended"
  );

  if (
    value.end_code !== null &&
    value.end_code !== "completed" &&
    value.end_code !== "stopped"
  ) {
    fail(
      "phase7_input_invalid",
      "execution_state.end_code is invalid."
    );
  }

  assertStringOrNull(
    value.ended_by_event_id,
    "phase7_input_invalid",
    "execution_state.ended_by_event_id"
  );

  assertNonNegativeInteger(
    value.last_seq,
    "phase7_input_invalid",
    "execution_state.last_seq"
  );

  assertStringArray(
    value.accepted_event_ids,
    "phase7_input_invalid",
    "execution_state.accepted_event_ids"
  );

  if (
    value.accepted_event_ids.length !==
      value.last_seq
  ) {
    fail(
      "phase7_input_invalid",
      "Accepted event count does not match last_seq."
    );
  }

  const eventTypeCounts =
    value.event_type_counts;

  assertRecord(
    eventTypeCounts,
    "phase7_input_invalid",
    "execution_state.event_type_counts"
  );

  for (
    const [eventType, count]
    of Object.entries(eventTypeCounts)
  ) {
    if (!EVENT_TYPES.has(eventType)) {
      fail(
        "phase7_input_invalid",
        "Execution state contains an unknown event type.",
        {
          event_type: eventType
        }
      );
    }

    assertNonNegativeInteger(
      count,
      "phase7_input_invalid",
      `execution_state.event_type_counts.${eventType}`
    );
  }

  const split = value.split;

  assertRecord(
    split,
    "phase7_input_invalid",
    "execution_state.split"
  );

  assertExactKeys(
    split,
    SPLIT_KEYS,
    "phase7_input_invalid",
    "execution_state.split"
  );

  assertBoolean(
    split.active,
    "phase7_input_invalid",
    "execution_state.split.active"
  );

  assertStringOrNull(
    split.entered_event_id,
    "phase7_input_invalid",
    "execution_state.split.entered_event_id"
  );

  assertStringArray(
    split.remaining_at_split_ids,
    "phase7_input_invalid",
    "execution_state.split.remaining_at_split_ids"
  );

  assertStringArray(
    value.work_item_order,
    "phase7_input_invalid",
    "execution_state.work_item_order"
  );

  const workItems = value.work_items;

  assertRecord(
    workItems,
    "phase7_input_invalid",
    "execution_state.work_items"
  );

  const computedCounts = {
    total: 0,
    pending: 0,
    active: 0,
    completed: 0,
    skipped: 0
  };

  for (
    const [workItemId, rawItem]
    of Object.entries(workItems)
  ) {
    assertRecord(
      rawItem,
      "phase7_input_invalid",
      `execution_state.work_items.${workItemId}`
    );

    assertExactKeys(
      rawItem,
      WORK_ITEM_KEYS,
      "phase7_input_invalid",
      `execution_state.work_items.${workItemId}`
    );

    if (
      rawItem.work_item_id !==
        workItemId
    ) {
      fail(
        "phase7_binding_mismatch",
        "Work-item map key does not match its bound work_item_id.",
        {
          map_key: workItemId,
          work_item_id:
            rawItem.work_item_id
        }
      );
    }

    assertNonEmptyString(
      rawItem.block_id,
      "phase7_input_invalid",
      `execution_state.work_items.${workItemId}.block_id`
    );

    assertNonEmptyString(
      rawItem.exercise_id,
      "phase7_input_invalid",
      `execution_state.work_items.${workItemId}.exercise_id`
    );

    if (
      typeof rawItem.status !==
        "string" ||
      !WORK_ITEM_STATUSES.has(
        rawItem.status
      )
    ) {
      fail(
        "phase7_input_invalid",
        "Work-item status is invalid.",
        {
          work_item_id:
            workItemId
        }
      );
    }

    assertStringOrNull(
      rawItem.started_event_id,
      "phase7_input_invalid",
      `execution_state.work_items.${workItemId}.started_event_id`
    );

    assertStringOrNull(
      rawItem.terminal_event_id,
      "phase7_input_invalid",
      `execution_state.work_items.${workItemId}.terminal_event_id`
    );

    assertStringOrNull(
      rawItem.terminal_source,
      "phase7_input_invalid",
      `execution_state.work_items.${workItemId}.terminal_source`
    );

    computedCounts.total += 1;

    computedCounts[
      rawItem.status as
        | "pending"
        | "active"
        | "completed"
        | "skipped"
    ] += 1;
  }

  if (
    value.work_item_order.length !==
      Object.keys(workItems).length ||
    new Set(
      value.work_item_order
    ).size !==
      value.work_item_order.length ||
    value.work_item_order.some(
      (workItemId) =>
        !hasOwn(
          workItems,
          workItemId
        )
    )
  ) {
    fail(
      "phase7_binding_mismatch",
      "Work-item ordering does not bind exactly to execution-state work items."
    );
  }

  const painFollowUp =
    value.pain_follow_up;

  assertRecord(
    painFollowUp,
    "phase7_input_invalid",
    "execution_state.pain_follow_up"
  );

  if (
    Object.keys(painFollowUp)
      .sort()
      .join("\u0000") !==
    Object.keys(workItems)
      .sort()
      .join("\u0000")
  ) {
    fail(
      "phase7_binding_mismatch",
      "Pain follow-up records do not bind exactly to execution-state work items."
    );
  }

  for (
    const [workItemId, rawRecord]
    of Object.entries(painFollowUp)
  ) {
    assertRecord(
      rawRecord,
      "phase7_input_invalid",
      `execution_state.pain_follow_up.${workItemId}`
    );

    assertExactKeys(
      rawRecord,
      PAIN_RECORD_KEYS,
      "phase7_input_invalid",
      `execution_state.pain_follow_up.${workItemId}`
    );

    if (
      rawRecord.work_item_id !==
        workItemId
    ) {
      fail(
        "phase7_binding_mismatch",
        "Pain follow-up map key does not match its work_item_id."
      );
    }

    assertBoolean(
      rawRecord.follow_up_pending,
      "phase7_input_invalid",
      `execution_state.pain_follow_up.${workItemId}.follow_up_pending`
    );

    assertStringArray(
      rawRecord.flag_event_ids,
      "phase7_input_invalid",
      `execution_state.pain_follow_up.${workItemId}.flag_event_ids`
    );

    assertStringArray(
      rawRecord.follow_up_event_ids,
      "phase7_input_invalid",
      `execution_state.pain_follow_up.${workItemId}.follow_up_event_ids`
    );

    assertStringOrNull(
      rawRecord.latest_response_code,
      "phase7_input_invalid",
      `execution_state.pain_follow_up.${workItemId}.latest_response_code`
    );
  }

  const counts = value.counts;

  assertRecord(
    counts,
    "phase7_input_invalid",
    "execution_state.counts"
  );

  assertExactKeys(
    counts,
    COUNT_KEYS,
    "phase7_input_invalid",
    "execution_state.counts"
  );

  for (const key of COUNT_KEYS) {
    assertNonNegativeInteger(
      counts[key],
      "phase7_input_invalid",
      `execution_state.counts.${key}`
    );

    if (
      counts[key] !==
      computedCounts[key]
    ) {
      fail(
        "phase7_binding_mismatch",
        "Execution-state factual counts do not match work-item truth.",
        {
          count: key,
          expected:
            computedCounts[key],
          actual: counts[key]
        }
      );
    }
  }

  if (
    value.session_ended === true
  ) {
    if (
      !TERMINAL_STATUSES.has(
        value.status as
          Beta18ExecutionStatus
      ) ||
      value.classification !==
        value.status
    ) {
      fail(
        "phase7_binding_mismatch",
        "Terminal execution status and classification do not match."
      );
    }
  }
  else if (
    TERMINAL_STATUSES.has(
      value.status as
        Beta18ExecutionStatus
    ) ||
    value.classification !== null
  ) {
    fail(
      "phase7_binding_mismatch",
      "Non-terminal execution state contains terminal classification."
    );
  }

  assertHash(
    value.reducer_state_hash,
    "phase7_input_invalid",
    "execution_state.reducer_state_hash"
  );

  const statePayload =
    cloneJson(value);

  delete statePayload
    .reducer_state_hash;

  const expectedStateHash =
    betaCanonicalHash(
      statePayload
    );

  if (
    value.reducer_state_hash !==
      expectedStateHash
  ) {
    fail(
      "phase7_binding_mismatch",
      "Execution state does not match its Phase 6 reducer-state hash.",
      {
        expected:
          expectedStateHash,
        actual:
          value.reducer_state_hash
      }
    );
  }
}

function normalisePhase6Truth(
  value: unknown
): Beta18Phase6Truth {
  assertRecord(
    value,
    "phase7_input_invalid",
    "phase6_output"
  );

  assertExactKeys(
    value,
    PHASE6_OUTPUT_KEYS,
    "phase7_input_invalid",
    "phase6_output"
  );

  assertNoForbiddenState(
    value,
    ["phase6_output"]
  );

  assertHash(
    value.canonical_input_hash,
    "phase7_input_invalid",
    "phase6_output.canonical_input_hash"
  );

  assertHash(
    value.selection_hash,
    "phase7_input_invalid",
    "phase6_output.selection_hash"
  );

  assertExecutionStatus(
    value.execution_status,
    "phase7_input_invalid",
    "phase6_output.execution_status"
  );

  assertExecutionState(
    value.execution_state
  );

  if (
    value.execution_state.status !==
      value.execution_status
  ) {
    fail(
      "phase7_binding_mismatch",
      "Phase 6 execution-status echo does not match execution state.",
      {
        execution_status:
          value.execution_status,
        state_status:
          value.execution_state.status
      }
    );
  }

  return deepFreeze({
    canonical_input_hash:
      value.canonical_input_hash,
    selection_hash:
      value.selection_hash,
    execution_status:
      value.execution_status,
    execution_state:
      cloneJson(
        value.execution_state
      )
  });
}

export function validateBeta18Phase7Input(
  value: unknown
): Phase7Input {
  assertRecord(
    value,
    "phase7_input_invalid",
    "phase7_input"
  );

  assertNoForbiddenState(
    value,
    ["phase7_input"]
  );

  if (
    !hasOwn(
      value,
      "phase7_projection_id"
    ) ||
    typeof value
      .phase7_projection_id !==
      "string" ||
    value
      .phase7_projection_id
      .length === 0
  ) {
    fail(
      "phase7_projection_id_missing",
      "Phase 7 projection ID is required."
    );
  }

  assertExactKeys(
    value,
    PHASE7_INPUT_KEYS,
    "phase7_input_invalid",
    "phase7_input"
  );

  if (
    value.content_format !==
      "application/json"
  ) {
    fail(
      "phase7_input_invalid",
      "Unsupported Phase 7 content format.",
      {
        actual:
          value.content_format
      }
    );
  }

  const phase6Output =
    normalisePhase6Truth(
      value.phase6_output
    );

  return deepFreeze({
    phase7_projection_id:
      value.phase7_projection_id,
    content_format:
      "application/json",
    phase6_output:
      phase6Output
  });
}

function buildRenderedOutput(
  phase6Output:
    Beta18Phase6Truth
): string {
  return betaCanonicalJson({
    canonical_input_hash:
      phase6Output
        .canonical_input_hash,
    selection_hash:
      phase6Output
        .selection_hash,
    execution_status:
      phase6Output
        .execution_status,
    execution_state:
      phase6Output
        .execution_state
  });
}

function outputWithoutHash(
  output:
    Omit<
      Phase7Output,
      "projection_hash"
    >
): JsonRecord {
  return {
    phase7_projection_id:
      output.phase7_projection_id,
    canonical_input_hash:
      output.canonical_input_hash,
    selection_hash:
      output.selection_hash,
    execution_status:
      output.execution_status,
    execution_state:
      output.execution_state,
    content_format:
      output.content_format,
    rendered_output:
      output.rendered_output
  };
}

export function projectBeta18Phase7(
  value: unknown
): Phase7Output {
  const input =
    validateBeta18Phase7Input(
      value
    );

  const candidate:
    Omit<
      Phase7Output,
      "projection_hash"
    > = {
      phase7_projection_id:
        input.phase7_projection_id,
      canonical_input_hash:
        input.phase6_output
          .canonical_input_hash,
      selection_hash:
        input.phase6_output
          .selection_hash,
      execution_status:
        input.phase6_output
          .execution_status,
      execution_state:
        cloneJson(
          input.phase6_output
            .execution_state
        ),
      content_format:
        input.content_format,
      rendered_output:
        buildRenderedOutput(
          input.phase6_output
        )
    };

  return deepFreeze({
    ...candidate,
    projection_hash:
      betaCanonicalHash(
        outputWithoutHash(
          candidate
        )
      )
  });
}

export function validateBeta18Phase7Output(
  inputValue: unknown,
  outputValue: unknown
): Phase7Output {
  const input =
    validateBeta18Phase7Input(
      inputValue
    );

  assertRecord(
    outputValue,
    "phase7_output_invalid",
    "phase7_output"
  );

  assertNoForbiddenState(
    outputValue,
    ["phase7_output"]
  );

  if (
    !hasOwn(
      outputValue,
      "phase7_projection_id"
    ) ||
    typeof outputValue
      .phase7_projection_id !==
      "string" ||
    outputValue
      .phase7_projection_id
      .length === 0
  ) {
    fail(
      "phase7_projection_id_missing",
      "Phase 7 output projection ID is required."
    );
  }

  assertExactKeys(
    outputValue,
    PHASE7_OUTPUT_KEYS,
    "phase7_output_invalid",
    "phase7_output"
  );

  if (
    outputValue
      .phase7_projection_id !==
    input.phase7_projection_id
  ) {
    fail(
      "phase7_binding_mismatch",
      "Projection ID does not echo the admitted Phase 7 input."
    );
  }

  if (
    outputValue
      .canonical_input_hash !==
    input.phase6_output
      .canonical_input_hash
  ) {
    fail(
      "phase7_binding_mismatch",
      "Canonical input hash echo mismatch."
    );
  }

  if (
    outputValue.selection_hash !==
    input.phase6_output
      .selection_hash
  ) {
    fail(
      "phase7_binding_mismatch",
      "Selection hash echo mismatch."
    );
  }

  if (
    outputValue.execution_status !==
    input.phase6_output
      .execution_status
  ) {
    fail(
      "phase7_binding_mismatch",
      "Execution status echo mismatch."
    );
  }

  if (
    betaCanonicalJson(
      outputValue.execution_state
    ) !==
    betaCanonicalJson(
      input.phase6_output
        .execution_state
    )
  ) {
    fail(
      "phase7_binding_mismatch",
      "Execution state echo mismatch."
    );
  }

  if (
    outputValue.content_format !==
      input.content_format
  ) {
    fail(
      "phase7_output_invalid",
      "Content format does not match the admitted Phase 7 input."
    );
  }

  if (
    typeof outputValue
      .rendered_output !==
      "string" ||
    outputValue.rendered_output !==
      buildRenderedOutput(
        input.phase6_output
      )
  ) {
    fail(
      "phase7_output_invalid",
      "Rendered output is not the canonical factual projection."
    );
  }

  assertExecutionStatus(
    outputValue.execution_status,
    "phase7_output_invalid",
    "phase7_output.execution_status"
  );

  assertExecutionState(
    outputValue.execution_state
  );

  assertHash(
    outputValue.projection_hash,
    "phase7_output_invalid",
    "phase7_output.projection_hash"
  );

  const expectedProjectionHash =
    betaCanonicalHash({
      phase7_projection_id:
        outputValue
          .phase7_projection_id,
      canonical_input_hash:
        outputValue
          .canonical_input_hash,
      selection_hash:
        outputValue
          .selection_hash,
      execution_status:
        outputValue
          .execution_status,
      execution_state:
        outputValue
          .execution_state,
      content_format:
        outputValue
          .content_format,
      rendered_output:
        outputValue
          .rendered_output
    });

  if (
    outputValue.projection_hash !==
      expectedProjectionHash
  ) {
    fail(
      "phase7_projection_hash_mismatch",
      "Phase 7 output does not match its projection hash.",
      {
        expected:
          expectedProjectionHash,
        actual:
          outputValue
            .projection_hash
      }
    );
  }

  return deepFreeze(
    cloneJson(
      outputValue
    ) as Phase7Output
  );
}

export function tryProjectBeta18Phase7(
  value: unknown
): Beta18Phase7Result {
  try {
    return deepFreeze({
      ok: true,
      phase7:
        projectBeta18Phase7(
          value
        )
    });
  }
  catch (error) {
    if (
      error instanceof
        Beta18Phase7SchemaError
    ) {
      return deepFreeze({
        ok: false,
        failure_token:
          error.failure_token,
        details:
          error.details
      });
    }

    return deepFreeze({
      ok: false,
      failure_token:
        "phase7_input_invalid",
      details: {
        reason:
          error instanceof Error
            ? error.message
            : String(error)
      }
    });
  }
}
