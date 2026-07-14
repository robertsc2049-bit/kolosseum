// DEV NOTE: BETA-13 closed-world Phase 6 runtime event admission schema.
// Validation completes before reducer execution. Runtime truth is limited to
// exact factual event fields and materialised session, block, and work-item IDs.

import { createHash } from "node:crypto";

export const beta13Phase6EventSchemaContract = Object.freeze({
  schema_id: "beta13_phase6_event_schema",
  slice_id: "BETA-13",
  version: "1.0.0",
  append_policy: "append_only_exact_next_seq",
  user_entered_block_id_policy: "forbidden",
  free_text_runtime_truth_policy: "forbidden",
  event_types: Object.freeze([
    "SESSION_START",
    "WORK_ITEM_START",
    "WORK_ITEM_DONE",
    "WORK_ITEM_SKIP",
    "SPLIT_ENTER",
    "SPLIT_RETURN_DECISION",
    "PAIN_FLAG",
    "PAIN_FOLLOW_UP",
    "SESSION_END"
  ])
});

const RAW_EVENT_KEYS = Object.freeze({
  SESSION_START: Object.freeze([
    "event_type"
  ]),
  WORK_ITEM_START: Object.freeze([
    "event_type",
    "work_item_id"
  ]),
  WORK_ITEM_DONE: Object.freeze([
    "event_type",
    "work_item_id"
  ]),
  WORK_ITEM_SKIP: Object.freeze([
    "event_type",
    "work_item_id"
  ]),
  SPLIT_ENTER: Object.freeze([
    "event_type"
  ]),
  SPLIT_RETURN_DECISION: Object.freeze([
    "event_type",
    "decision"
  ]),
  PAIN_FLAG: Object.freeze([
    "event_type",
    "work_item_id",
    "follow_up_required"
  ]),
  PAIN_FOLLOW_UP: Object.freeze([
    "event_type",
    "work_item_id",
    "response_code"
  ]),
  SESSION_END: Object.freeze([
    "event_type",
    "end_code"
  ])
});

const CANONICAL_EVENT_KEYS = Object.freeze([
  "event_id",
  "seq",
  "event_type",
  "session_id",
  "block_id",
  "work_item_id",
  "payload"
]);

const WORK_ITEM_EVENT_TYPES = new Set([
  "WORK_ITEM_START",
  "WORK_ITEM_DONE",
  "WORK_ITEM_SKIP",
  "PAIN_FLAG",
  "PAIN_FOLLOW_UP"
]);

const FREE_TEXT_KEYS = new Set([
  "text",
  "free_text",
  "note",
  "notes",
  "message",
  "comment",
  "comments",
  "description",
  "coach_note",
  "coach_notes",
  "reason_text",
  "pain_text"
]);

const SPLIT_DECISIONS = new Set([
  "continue",
  "skip_remaining"
]);

const PAIN_FOLLOW_UP_CODES = new Set([
  "continue",
  "skip_work_item",
  "end_session"
]);

const SESSION_END_CODES = new Set([
  "completed",
  "stopped"
]);

function fail(failure_token, message, details = {}) {
  const error = new Error(
    `${failure_token}: ${message}`
  );

  error.code = failure_token;
  error.failure_token = failure_token;
  error.details = details;

  throw error;
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(
    Object(value),
    key
  );
}

function cloneJson(value) {
  if (typeof value === "undefined") {
    return value;
  }

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

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function stableValue(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(
        "phase6_event_schema_event_invalid",
        "Non-finite numbers are forbidden."
      );
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (isRecord(value)) {
    const output = {};

    for (const key of Object.keys(value).sort()) {
      if (typeof value[key] === "undefined") {
        fail(
          "phase6_event_schema_event_invalid",
          "Undefined values are forbidden.",
          { key }
        );
      }

      output[key] = stableValue(value[key]);
    }

    return output;
  }

  fail(
    "phase6_event_schema_event_invalid",
    "Unsupported canonical value."
  );
}

export function stableBeta13Phase6EventJson(value) {
  return JSON.stringify(stableValue(value));
}

function hashValue(value) {
  return createHash("sha256")
    .update(
      stableBeta13Phase6EventJson(value),
      "utf8"
    )
    .digest("hex");
}

function assertRecord(
  value,
  failureToken,
  message,
  details = {}
) {
  if (!isRecord(value)) {
    fail(
      failureToken,
      message,
      details
    );
  }
}

function assertArray(
  value,
  failureToken,
  field
) {
  if (!Array.isArray(value)) {
    fail(
      failureToken,
      "Expected array.",
      { field }
    );
  }
}

function assertNonEmptyString(
  value,
  failureToken,
  field
) {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    fail(
      failureToken,
      "Expected non-empty string.",
      { field }
    );
  }
}

function assertPositiveInteger(
  value,
  failureToken,
  field
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    fail(
      failureToken,
      "Expected positive safe integer.",
      { field }
    );
  }
}

function assertExactKeys(
  value,
  requiredKeys,
  failureToken,
  objectName
) {
  const required = new Set(requiredKeys);

  for (const key of Object.keys(value)) {
    if (!required.has(key)) {
      fail(
        failureToken,
        "Object contains unknown field.",
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
        "Object is missing required field.",
        {
          object: objectName,
          field: key
        }
      );
    }
  }
}

function assertNoFreeTextKeys(
  value,
  pathParts = []
) {
  if (Array.isArray(value)) {
    value.forEach(
      (entry, index) =>
        assertNoFreeTextKeys(
          entry,
          [...pathParts, String(index)]
        )
    );

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FREE_TEXT_KEYS.has(key)) {
      fail(
        "phase6_event_schema_free_text_forbidden",
        "Free-text runtime truth is forbidden.",
        {
          field: key,
          path: [...pathParts, key].join(".")
        }
      );
    }

    assertNoFreeTextKeys(
      child,
      [...pathParts, key]
    );
  }
}

function normaliseSession(session) {
  assertRecord(
    session,
    "phase6_event_schema_session_invalid",
    "Materialised session must be an object."
  );

  assertNonEmptyString(
    session.session_id,
    "phase6_event_schema_session_invalid",
    "session_id"
  );

  assertArray(
    session.blocks,
    "phase6_event_schema_session_invalid",
    "blocks"
  );

  assertArray(
    session.planned_items,
    "phase6_event_schema_session_invalid",
    "planned_items"
  );

  const blocks = {};
  const workItems = {};

  for (const block of session.blocks) {
    assertRecord(
      block,
      "phase6_event_schema_session_invalid",
      "Block must be an object."
    );

    assertNonEmptyString(
      block.block_id,
      "phase6_event_schema_session_invalid",
      "block_id"
    );

    assertArray(
      block.item_ids,
      "phase6_event_schema_session_invalid",
      "item_ids"
    );

    if (hasOwn(blocks, block.block_id)) {
      fail(
        "phase6_event_schema_session_invalid",
        "Duplicate block_id.",
        {
          block_id: block.block_id
        }
      );
    }

    const itemIds = [];

    for (const itemId of block.item_ids) {
      assertNonEmptyString(
        itemId,
        "phase6_event_schema_session_invalid",
        "item_id"
      );

      if (itemIds.includes(itemId)) {
        fail(
          "phase6_event_schema_session_invalid",
          "Duplicate item_id inside block.",
          {
            block_id: block.block_id,
            work_item_id: itemId
          }
        );
      }

      itemIds.push(itemId);
    }

    blocks[block.block_id] = Object.freeze({
      block_id: block.block_id,
      item_ids: Object.freeze(itemIds)
    });
  }

  for (const item of session.planned_items) {
    assertRecord(
      item,
      "phase6_event_schema_session_invalid",
      "Planned item must be an object."
    );

    assertNonEmptyString(
      item.item_id,
      "phase6_event_schema_session_invalid",
      "item_id"
    );

    assertNonEmptyString(
      item.block_id,
      "phase6_event_schema_session_invalid",
      "block_id"
    );

    assertNonEmptyString(
      item.exercise_id,
      "phase6_event_schema_session_invalid",
      "exercise_id"
    );

    if (hasOwn(workItems, item.item_id)) {
      fail(
        "phase6_event_schema_session_invalid",
        "Duplicate work item.",
        {
          work_item_id: item.item_id
        }
      );
    }

    if (!hasOwn(blocks, item.block_id)) {
      fail(
        "phase6_event_schema_unknown_block",
        "Planned item references unknown block.",
        {
          work_item_id: item.item_id,
          block_id: item.block_id
        }
      );
    }

    workItems[item.item_id] = Object.freeze({
      work_item_id: item.item_id,
      block_id: item.block_id,
      exercise_id: item.exercise_id
    });
  }

  const referencedItems = new Set();

  for (const block of Object.values(blocks)) {
    for (const itemId of block.item_ids) {
      const item = workItems[itemId];

      if (!item) {
        fail(
          "phase6_event_schema_unknown_work_item",
          "Block references unknown work item.",
          {
            block_id: block.block_id,
            work_item_id: itemId
          }
        );
      }

      if (item.block_id !== block.block_id) {
        fail(
          "phase6_event_schema_unknown_block",
          "Work item block binding mismatch.",
          {
            work_item_id: itemId,
            expected_block_id: item.block_id,
            actual_block_id: block.block_id
          }
        );
      }

      if (referencedItems.has(itemId)) {
        fail(
          "phase6_event_schema_session_invalid",
          "Work item is referenced by multiple blocks.",
          {
            work_item_id: itemId
          }
        );
      }

      referencedItems.add(itemId);
    }
  }

  for (const itemId of Object.keys(workItems)) {
    if (!referencedItems.has(itemId)) {
      fail(
        "phase6_event_schema_session_invalid",
        "Work item is not referenced by a block.",
        {
          work_item_id: itemId
        }
      );
    }
  }

  return deepFreeze({
    session_id: session.session_id,
    activity_id:
      typeof session.activity_id === "string"
        ? session.activity_id
        : null,
    blocks: Object.freeze(blocks),
    work_items: Object.freeze(workItems),
    ordered_work_item_ids: Object.freeze(
      Object.keys(workItems)
    )
  });
}

export function validateBeta13Phase6Session(session) {
  return normaliseSession(session);
}

function assertKnownWorkItem(
  context,
  workItemId
) {
  assertNonEmptyString(
    workItemId,
    "phase6_event_schema_event_invalid",
    "work_item_id"
  );

  const item = context.work_items[workItemId];

  if (!item) {
    fail(
      "phase6_event_schema_unknown_work_item",
      "Runtime event references unknown work item.",
      {
        work_item_id: workItemId
      }
    );
  }

  return item;
}

function payloadForRawEvent(
  eventType,
  raw
) {
  if (eventType === "SPLIT_RETURN_DECISION") {
    if (!SPLIT_DECISIONS.has(raw.decision)) {
      fail(
        "phase6_event_schema_event_invalid",
        "Unknown split return decision.",
        {
          decision: raw.decision
        }
      );
    }

    return Object.freeze({
      decision: raw.decision
    });
  }

  if (eventType === "PAIN_FLAG") {
    if (typeof raw.follow_up_required !== "boolean") {
      fail(
        "phase6_event_schema_event_invalid",
        "follow_up_required must be boolean."
      );
    }

    return Object.freeze({
      follow_up_required:
        raw.follow_up_required
    });
  }

  if (eventType === "PAIN_FOLLOW_UP") {
    if (
      !PAIN_FOLLOW_UP_CODES.has(
        raw.response_code
      )
    ) {
      fail(
        "phase6_event_schema_event_invalid",
        "Unknown pain follow-up response code.",
        {
          response_code: raw.response_code
        }
      );
    }

    return Object.freeze({
      response_code: raw.response_code
    });
  }

  if (eventType === "SESSION_END") {
    if (!SESSION_END_CODES.has(raw.end_code)) {
      fail(
        "phase6_event_schema_event_invalid",
        "Unknown session end code.",
        {
          end_code: raw.end_code
        }
      );
    }

    return Object.freeze({
      end_code: raw.end_code
    });
  }

  return null;
}

export function validateBeta13Phase6EventInput(
  session,
  routeSessionId,
  raw
) {
  const context = normaliseSession(session);

  assertNonEmptyString(
    routeSessionId,
    "phase6_event_schema_unknown_session",
    "route_session_id"
  );

  if (routeSessionId !== context.session_id) {
    fail(
      "phase6_event_schema_unknown_session",
      "Route session does not match materialised session.",
      {
        expected: context.session_id,
        actual: routeSessionId
      }
    );
  }

  assertRecord(
    raw,
    "phase6_event_schema_event_invalid",
    "Runtime event input must be an object."
  );

  assertNoFreeTextKeys(raw);

  if (hasOwn(raw, "block_id")) {
    fail(
      "phase6_event_schema_user_block_id_forbidden",
      "User-entered block_id is forbidden."
    );
  }

  if (
    hasOwn(raw, "session_id") ||
    hasOwn(raw, "event_id") ||
    hasOwn(raw, "seq")
  ) {
    fail(
      "phase6_event_schema_event_invalid",
      "Server-owned identity field was supplied."
    );
  }

  assertNonEmptyString(
    raw.event_type,
    "phase6_event_schema_event_invalid",
    "event_type"
  );

  if (
    !beta13Phase6EventSchemaContract
      .event_types
      .includes(raw.event_type)
  ) {
    fail(
      "phase6_event_schema_unknown_event_type",
      "Unknown runtime event type.",
      {
        event_type: raw.event_type
      }
    );
  }

  assertExactKeys(
    raw,
    RAW_EVENT_KEYS[raw.event_type],
    "phase6_event_schema_event_invalid",
    "runtime_event_input"
  );

  let item = null;

  if (WORK_ITEM_EVENT_TYPES.has(raw.event_type)) {
    item = assertKnownWorkItem(
      context,
      raw.work_item_id
    );
  }

  const payload = payloadForRawEvent(
    raw.event_type,
    raw
  );

  return deepFreeze({
    event_type: raw.event_type,
    session_id: context.session_id,
    block_id: item ? item.block_id : null,
    work_item_id:
      item ? item.work_item_id : null,
    payload
  });
}

function canonicalEventId(
  seq,
  normalised
) {
  return (
    "beta13_event_" +
    hashValue({
      seq,
      event_type: normalised.event_type,
      session_id: normalised.session_id,
      block_id: normalised.block_id,
      work_item_id: normalised.work_item_id,
      payload: normalised.payload
    }).slice(0, 24)
  );
}

export function materialiseBeta13Phase6Event(
  session,
  routeSessionId,
  raw,
  seq
) {
  assertPositiveInteger(
    seq,
    "phase6_event_schema_append_only_violation",
    "seq"
  );

  const normalised =
    validateBeta13Phase6EventInput(
      session,
      routeSessionId,
      raw
    );

  return deepFreeze({
    event_id: canonicalEventId(
      seq,
      normalised
    ),
    seq,
    event_type: normalised.event_type,
    session_id: normalised.session_id,
    block_id: normalised.block_id,
    work_item_id: normalised.work_item_id,
    payload: normalised.payload
  });
}

function rawFromCanonicalEvent(event) {
  if (event.event_type === "SESSION_START") {
    return {
      event_type: event.event_type
    };
  }

  if (
    event.event_type === "WORK_ITEM_START" ||
    event.event_type === "WORK_ITEM_DONE" ||
    event.event_type === "WORK_ITEM_SKIP"
  ) {
    return {
      event_type: event.event_type,
      work_item_id: event.work_item_id
    };
  }

  if (event.event_type === "SPLIT_ENTER") {
    return {
      event_type: event.event_type
    };
  }

  if (
    event.event_type ===
    "SPLIT_RETURN_DECISION"
  ) {
    return {
      event_type: event.event_type,
      decision: event.payload?.decision
    };
  }

  if (event.event_type === "PAIN_FLAG") {
    return {
      event_type: event.event_type,
      work_item_id: event.work_item_id,
      follow_up_required:
        event.payload?.follow_up_required
    };
  }

  if (event.event_type === "PAIN_FOLLOW_UP") {
    return {
      event_type: event.event_type,
      work_item_id: event.work_item_id,
      response_code:
        event.payload?.response_code
    };
  }

  if (event.event_type === "SESSION_END") {
    return {
      event_type: event.event_type,
      end_code: event.payload?.end_code
    };
  }

  fail(
    "phase6_event_schema_unknown_event_type",
    "Unknown canonical runtime event type.",
    {
      event_type: event.event_type
    }
  );
}

export function validateBeta13Phase6CanonicalEvent(
  session,
  event
) {
  const context = normaliseSession(session);

  assertRecord(
    event,
    "phase6_event_schema_event_invalid",
    "Canonical event must be an object."
  );

  assertExactKeys(
    event,
    CANONICAL_EVENT_KEYS,
    "phase6_event_schema_event_invalid",
    "canonical_event"
  );

  assertPositiveInteger(
    event.seq,
    "phase6_event_schema_append_only_violation",
    "seq"
  );

  assertNonEmptyString(
    event.event_id,
    "phase6_event_schema_event_invalid",
    "event_id"
  );

  if (event.session_id !== context.session_id) {
    fail(
      "phase6_event_schema_unknown_session",
      "Canonical event session_id is unknown.",
      {
        expected: context.session_id,
        actual: event.session_id
      }
    );
  }

  if (event.work_item_id === null) {
    if (event.block_id !== null) {
      fail(
        "phase6_event_schema_unknown_block",
        "Session event cannot carry block_id.",
        {
          block_id: event.block_id
        }
      );
    }
  }
  else {
    const item = assertKnownWorkItem(
      context,
      event.work_item_id
    );

    if (event.block_id !== item.block_id) {
      fail(
        "phase6_event_schema_unknown_block",
        "Canonical event block_id is unknown or mismatched.",
        {
          work_item_id: event.work_item_id,
          expected: item.block_id,
          actual: event.block_id
        }
      );
    }
  }

  const raw = rawFromCanonicalEvent(event);

  const expected =
    materialiseBeta13Phase6Event(
      session,
      context.session_id,
      raw,
      event.seq
    );

  if (
    stableBeta13Phase6EventJson(expected) !==
    stableBeta13Phase6EventJson(event)
  ) {
    fail(
      "phase6_event_schema_event_invalid",
      "Canonical event does not match deterministic materialisation.",
      {
        event_id: event.event_id
      }
    );
  }

  return expected;
}

function validateEventOrder(
  context,
  events
) {
  let sessionStarted = false;
  let sessionEnded = false;
  let splitActive = false;

  const startedItems = new Set();
  const terminalItems = new Set();
  const pendingPainFollowUps = new Set();

  for (let index = 0; index < events.length; index++) {
    const event = events[index];

    if (sessionEnded) {
      fail(
        "phase6_event_schema_event_order_invalid",
        "No event may follow SESSION_END.",
        {
          index,
          event_type: event.event_type
        }
      );
    }

    if (event.event_type === "SESSION_START") {
      if (index !== 0 || sessionStarted) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "SESSION_START must be the first and only session start event."
        );
      }

      sessionStarted = true;
      continue;
    }

    if (!sessionStarted) {
      fail(
        "phase6_event_schema_event_order_invalid",
        "SESSION_START is required first.",
        {
          event_type: event.event_type
        }
      );
    }

    if (event.event_type === "WORK_ITEM_START") {
      if (
        startedItems.has(event.work_item_id) ||
        terminalItems.has(event.work_item_id)
      ) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Work item cannot be started again.",
          {
            work_item_id: event.work_item_id
          }
        );
      }

      startedItems.add(event.work_item_id);
      continue;
    }

    if (
      event.event_type === "WORK_ITEM_DONE" ||
      event.event_type === "WORK_ITEM_SKIP"
    ) {
      if (!startedItems.has(event.work_item_id)) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Terminal work-item event requires WORK_ITEM_START.",
          {
            work_item_id: event.work_item_id
          }
        );
      }

      if (terminalItems.has(event.work_item_id)) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Work item already has a terminal event.",
          {
            work_item_id: event.work_item_id
          }
        );
      }

      if (
        pendingPainFollowUps.has(
          event.work_item_id
        )
      ) {
        fail(
          "phase6_event_schema_pain_follow_up_required",
          "Pain follow-up is required before work-item resolution.",
          {
            work_item_id: event.work_item_id
          }
        );
      }

      terminalItems.add(event.work_item_id);
      continue;
    }

    if (event.event_type === "SPLIT_ENTER") {
      if (splitActive) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Split is already active."
        );
      }

      if (
        terminalItems.size ===
        context.ordered_work_item_ids.length
      ) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Split requires unresolved work items."
        );
      }

      splitActive = true;
      continue;
    }

    if (
      event.event_type ===
      "SPLIT_RETURN_DECISION"
    ) {
      if (!splitActive) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Split return decision requires an active split."
        );
      }

      splitActive = false;
      continue;
    }

    if (event.event_type === "PAIN_FLAG") {
      if (!startedItems.has(event.work_item_id)) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Pain flag requires a started work item.",
          {
            work_item_id: event.work_item_id
          }
        );
      }

      if (terminalItems.has(event.work_item_id)) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Pain flag cannot follow terminal work-item truth.",
          {
            work_item_id: event.work_item_id
          }
        );
      }

      if (
        pendingPainFollowUps.has(
          event.work_item_id
        )
      ) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Pain follow-up is already pending.",
          {
            work_item_id: event.work_item_id
          }
        );
      }

      if (
        event.payload.follow_up_required === true
      ) {
        pendingPainFollowUps.add(
          event.work_item_id
        );
      }

      continue;
    }

    if (event.event_type === "PAIN_FOLLOW_UP") {
      if (
        !pendingPainFollowUps.has(
          event.work_item_id
        )
      ) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Pain follow-up requires a pending pain flag.",
          {
            work_item_id: event.work_item_id
          }
        );
      }

      pendingPainFollowUps.delete(
        event.work_item_id
      );

      continue;
    }

    if (event.event_type === "SESSION_END") {
      if (splitActive) {
        fail(
          "phase6_event_schema_return_decision_required",
          "Split return decision is required before SESSION_END."
        );
      }

      if (pendingPainFollowUps.size > 0) {
        fail(
          "phase6_event_schema_pain_follow_up_required",
          "SESSION_END cannot occur while pain follow-up is pending.",
          {
            work_item_ids:
              [...pendingPainFollowUps]
          }
        );
      }

      if (
        event.payload.end_code === "completed" &&
        terminalItems.size !==
          context.ordered_work_item_ids.length
      ) {
        fail(
          "phase6_event_schema_event_order_invalid",
          "Completed session requires all work items to be terminal.",
          {
            terminal_count: terminalItems.size,
            work_item_count:
              context.ordered_work_item_ids.length
          }
        );
      }

      sessionEnded = true;
    }
  }
}

export function validateBeta13Phase6EventLog(
  session,
  events
) {
  const context = normaliseSession(session);

  assertArray(
    events,
    "phase6_event_schema_event_log_invalid",
    "events"
  );

  const validated = [];
  const eventIds = new Set();

  for (let index = 0; index < events.length; index++) {
    const rawEvent = events[index];
    const expectedSeq = index + 1;

    if (
      isRecord(rawEvent) &&
      rawEvent.seq !== expectedSeq
    ) {
      fail(
        "phase6_event_schema_append_only_violation",
        "Event sequence must equal exact append position.",
        {
          expected: expectedSeq,
          actual: rawEvent.seq
        }
      );
    }

    const event =
      validateBeta13Phase6CanonicalEvent(
        session,
        rawEvent
      );

    if (eventIds.has(event.event_id)) {
      fail(
        "phase6_event_schema_append_only_violation",
        "Duplicate event_id.",
        {
          event_id: event.event_id
        }
      );
    }

    eventIds.add(event.event_id);
    validated.push(event);
  }

  validateEventOrder(
    context,
    validated
  );

  return deepFreeze(validated);
}

export function appendBeta13Phase6EventLog(
  session,
  priorEvents,
  routeSessionId,
  raw
) {
  const prior =
    validateBeta13Phase6EventLog(
      session,
      priorEvents
    );

  const next =
    materialiseBeta13Phase6Event(
      session,
      routeSessionId,
      raw,
      prior.length + 1
    );

  return validateBeta13Phase6EventLog(
    session,
    [...prior, next]
  );
}

export function admitBeta13Phase6EventBeforeReducer(
  session,
  priorEvents,
  routeSessionId,
  raw,
  reducerState,
  reducer
) {
  const nextEventLog =
    appendBeta13Phase6EventLog(
      session,
      priorEvents,
      routeSessionId,
      raw
    );

  if (typeof reducer !== "function") {
    fail(
      "phase6_event_schema_reducer_invalid",
      "Reducer must be a function."
    );
  }

  const nextEvent =
    nextEventLog[nextEventLog.length - 1];

  const isolatedReducerState =
    cloneJson(reducerState);

  const nextReducerState = reducer(
    isolatedReducerState,
    nextEvent
  );

  return deepFreeze({
    event_log: nextEventLog,
    reducer_state:
      cloneJson(nextReducerState)
  });
}
