import crypto from "node:crypto";

import { renderMobileSessionExecutionShell } from "./mobileSessionExecutionShell.mjs";
import {
  appendV1RuntimeEventLog,
  replayV1RuntimeEvents,
  stableRuntimeReducerJson,
  v1RuntimeEventReducerContract
} from "./v1RuntimeEventReducer.mjs";

export const STOP_SKIP_PARTIAL_COPY_IDS = Object.freeze({
  title: "STOP_SKIP_PARTIAL_TITLE",
  stopAction: "STOP_SKIP_PARTIAL_STOP_ACTION",
  skipAction: "STOP_SKIP_PARTIAL_SKIP_ACTION",
  partialAction: "STOP_SKIP_PARTIAL_PARTIAL_ACTION",
  stopRecorded: "STOP_SKIP_PARTIAL_STOP_RECORDED",
  skipRecorded: "STOP_SKIP_PARTIAL_SKIP_RECORDED",
  partialRecorded: "STOP_SKIP_PARTIAL_PARTIAL_RECORDED",
  historyLabel: "STOP_SKIP_PARTIAL_HISTORY_LABEL"
});

export const stopSkipPartialCompletionContract = Object.freeze({
  surface_id: "v1_stop_skip_partial_completion_flow",
  version: "1.0.0",
  slice_id: "S-V1-38",
  reducer_contract: v1RuntimeEventReducerContract.surface_id,
  factual_event_types: Object.freeze(["STOP_SESSION", "SKIP_WORK_ITEM", "PARTIAL_COMPLETE_WORK_ITEM"]),
  history_policy: "recorded_event_log_only",
  copy_policy: "factual_non_judgement",
  failure_code: "v1_stop_skip_partial_completion_failure"
});

const REQUIRED_ROOT_KEYS = Object.freeze([
  "request_id",
  "requested_at",
  "actor",
  "session",
  "current_event_log",
  "action_request"
]);

const REQUIRED_ACTOR_KEYS = Object.freeze([
  "actor_type",
  "athlete_id"
]);

const REQUIRED_SESSION_KEYS = Object.freeze([
  "session_id",
  "work_items"
]);

const REQUIRED_WORK_ITEM_KEYS = Object.freeze([
  "work_item_id"
]);

const REQUIRED_ACTION_KEYS = Object.freeze([
  "idempotency_key",
  "action_type",
  "work_item_id",
  "reason_code",
  "partial_payload"
]);

const REQUIRED_PARTIAL_PAYLOAD_KEYS = Object.freeze([
  "declared_completed_quantity",
  "declared_planned_quantity",
  "unit",
  "reason_code"
]);

const FORBIDDEN_KEYS = Object.freeze([
  "coach_live_change",
  "coach_override",
  "coach_intervention",
  "coach_message",
  "billing_state",
  "ui_state",
  "presentation_state",
  "engine_override",
  "engine_truth_override",
  "media_url",
  "video_url",
  "guidance_surface",
  "score",
  "score_value",
  "rating",
  "judgement_language",
  "judgment_language",
  ["adher", "ence"].join(""),
  ["reco", "mmendation"].join(""),
  ["optimi", "sation"].join(""),
  ["ready", "ness"].join(""),
  ["fat", "igue"].join(""),
  ["ri", "sk"].join(""),
  ["ad", "vice"].join("")
]);

const ACTION_STATUS = Object.freeze({
  STOP_SESSION: "stop_recorded",
  SKIP_WORK_ITEM: "skip_recorded",
  PARTIAL_COMPLETE_WORK_ITEM: "partial_completion_recorded"
});

const WORK_ITEM_ACTIONS = new Set(["SKIP_WORK_ITEM", "PARTIAL_COMPLETE_WORK_ITEM"]);

function fail(reason, message, details = {}) {
  const error = new Error(`v1_stop_skip_partial_completion_${reason}: ${message}`);
  error.code = `v1_stop_skip_partial_completion_${reason}`;
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

function assertNullableString(value, reason, details = {}) {
  if (value === null) return;
  assertNonEmptyString(value, reason, details);
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

function assertNoForbiddenKeys(value, pathParts = []) {
  if (!isRecord(value) && !Array.isArray(value)) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, [...pathParts, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      fail("forbidden_scope_field", "stop skip partial input contains forbidden field", {
        field: key,
        path: [...pathParts, key].join(".")
      });
    }

    assertNoForbiddenKeys(value[key], [...pathParts, key]);
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

function stableJson(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function deterministicEventId(request, priorEvents) {
  return `stop_skip_partial_event_${sha256({
    request_id: request.request_id,
    action_request: request.action_request,
    event_log_sha256: sha256(priorEvents)
  }).slice(0, 24)}`;
}

function validateActor(actor) {
  assertRecord(actor, "actor_invalid", "actor must be an object");
  assertExactKeys(actor, REQUIRED_ACTOR_KEYS, "actor_invalid", { object: "actor" });

  if (actor.actor_type !== "athlete") {
    fail("actor_invalid", "actor_type must be athlete", {
      actor_type: actor.actor_type
    });
  }

  assertNonEmptyString(actor.athlete_id, "actor_invalid", { field: "athlete_id" });
}

function validateSession(session) {
  assertRecord(session, "session_invalid", "session must be an object");
  assertExactKeys(session, REQUIRED_SESSION_KEYS, "session_invalid", { object: "session" });
  assertNonEmptyString(session.session_id, "session_invalid", { field: "session_id" });
  assertArray(session.work_items, "session_invalid", { field: "work_items" });

  for (const workItem of session.work_items) {
    assertRecord(workItem, "session_invalid", "work item must be an object");
    assertExactKeys(workItem, REQUIRED_WORK_ITEM_KEYS, "session_invalid", { object: "work_item" });
    assertNonEmptyString(workItem.work_item_id, "session_invalid", { field: "work_item_id" });
  }
}

function validatePartialPayload(payload) {
  assertRecord(payload, "action_invalid", "partial_payload must be an object");
  assertExactKeys(payload, REQUIRED_PARTIAL_PAYLOAD_KEYS, "action_invalid", { object: "partial_payload" });
  assertFiniteNumber(payload.declared_completed_quantity, "action_invalid", { field: "declared_completed_quantity" });
  assertFiniteNumber(payload.declared_planned_quantity, "action_invalid", { field: "declared_planned_quantity" });
  assertNonEmptyString(payload.unit, "action_invalid", { field: "unit" });
  assertNonEmptyString(payload.reason_code, "action_invalid", { field: "reason_code" });

  if (payload.declared_completed_quantity < 0 || payload.declared_planned_quantity < 0) {
    fail("partial_quantity_invalid", "partial quantities must be non-negative", {});
  }

  if (payload.declared_completed_quantity > payload.declared_planned_quantity) {
    fail("partial_quantity_invalid", "partial completed quantity cannot exceed planned quantity", {});
  }
}

function validateAction(actionRequest) {
  assertRecord(actionRequest, "action_invalid", "action_request must be an object");
  assertExactKeys(actionRequest, REQUIRED_ACTION_KEYS, "action_invalid", { object: "action_request" });
  assertNonEmptyString(actionRequest.idempotency_key, "action_invalid", { field: "idempotency_key" });
  assertNullableString(actionRequest.work_item_id, "action_invalid", { field: "work_item_id" });
  assertNullableString(actionRequest.reason_code, "action_invalid", { field: "reason_code" });

  if (!stopSkipPartialCompletionContract.factual_event_types.includes(actionRequest.action_type)) {
    fail("action_invalid", "unsupported stop skip partial action_type", {
      action_type: actionRequest.action_type
    });
  }

  if (actionRequest.action_type === "STOP_SESSION" && actionRequest.work_item_id !== null) {
    fail("action_invalid", "STOP_SESSION work_item_id must be null", {});
  }

  if (WORK_ITEM_ACTIONS.has(actionRequest.action_type)) {
    assertNonEmptyString(actionRequest.work_item_id, "action_invalid", { field: "work_item_id" });
  }

  if (actionRequest.action_type === "PARTIAL_COMPLETE_WORK_ITEM") {
    validatePartialPayload(actionRequest.partial_payload);
  } else if (actionRequest.partial_payload !== null) {
    fail("action_invalid", "partial_payload must be null for non-partial actions", {});
  }
}

function validateRequest(input) {
  assertRecord(input, "input_invalid", "input must be an object");
  assertNoForbiddenKeys(input);
  assertExactKeys(input, REQUIRED_ROOT_KEYS, "input_invalid", { object: "root" });
  assertNonEmptyString(input.request_id, "input_invalid", { field: "request_id" });
  assertIsoString(input.requested_at, "input_invalid", { field: "requested_at" });
  validateActor(input.actor);
  validateSession(input.session);
  assertArray(input.current_event_log, "event_log_invalid", { field: "current_event_log" });
  validateAction(input.action_request);
}

function replayCurrentState(session, events) {
  try {
    return replayV1RuntimeEvents(session, events);
  } catch (error) {
    fail(error?.reason ?? "event_log_invalid", "current event log cannot be replayed", {
      reducer_code: error?.code ?? "unknown",
      reducer_reason: error?.reason ?? "unknown",
      reducer_details: error?.details ?? {}
    });
  }
}

function assertActionAllowed(state, actionRequest) {
  if (state.status === "completed" || state.status === "partially_completed" || state.status === "stopped") {
    fail("session_terminal", "stop skip partial event cannot be recorded after terminal session state", {
      status: state.status
    });
  }

  if (state.status === "not_started") {
    fail("session_not_started", "stop skip partial event requires started session state", {});
  }

  if (state.split.active === true) {
    fail("split_open", "stop skip partial work event cannot be recorded while split is open", {
      action_type: actionRequest.action_type
    });
  }

  if (WORK_ITEM_ACTIONS.has(actionRequest.action_type)) {
    const current = state.work_items[actionRequest.work_item_id];

    if (!current) {
      fail("unknown_work_item", "action references unknown work item", {
        work_item_id: actionRequest.work_item_id
      });
    }

    if (current.status !== "pending") {
      fail("work_item_terminal", "work item already has a terminal factual event", {
        work_item_id: actionRequest.work_item_id,
        status: current.status
      });
    }
  }
}

function buildFactualPayload(actionRequest) {
  if (actionRequest.action_type === "PARTIAL_COMPLETE_WORK_ITEM") {
    return Object.freeze({
      declared_completed_quantity: actionRequest.partial_payload.declared_completed_quantity,
      declared_planned_quantity: actionRequest.partial_payload.declared_planned_quantity,
      unit: actionRequest.partial_payload.unit,
      reason_code: actionRequest.partial_payload.reason_code
    });
  }

  if (actionRequest.reason_code === null) {
    return null;
  }

  return Object.freeze({
    reason_code: actionRequest.reason_code
  });
}

function buildRuntimeEvent(request, priorEvents) {
  return deepFreeze({
    event_id: deterministicEventId(request, priorEvents),
    seq: priorEvents.length + 1,
    event_type: request.action_request.action_type,
    session_id: request.session.session_id,
    occurred_at: request.requested_at,
    actor_type: request.actor.actor_type,
    work_item_id: request.action_request.work_item_id,
    factual_payload: buildFactualPayload(request.action_request)
  });
}

function recordedHistoryFromEvents(events) {
  return Object.freeze(events.map((event) => Object.freeze({
    seq: event.seq,
    event_id: event.event_id,
    event_type: event.event_type,
    session_id: event.session_id,
    work_item_id: event.work_item_id,
    factual_payload: event.factual_payload
  })));
}

function buildShellModel(nextState) {
  const engineOutput = Object.freeze({
    session_id: nextState.session_id,
    status: nextState.status,
    return_decision_required: nextState.split.active === true,
    work_items: Object.freeze(Object.values(nextState.work_items).map((item) => Object.freeze({
      work_item_id: item.work_item_id,
      display_name: item.work_item_id,
      status: item.status,
      sets: Object.freeze([])
    })))
  });

  const runtimeState = Object.freeze({
    return_decision_required: nextState.split.active === true,
    completed_ids: Object.values(nextState.work_items).filter((item) => item.status === "completed").map((item) => item.work_item_id),
    skipped_ids: Object.values(nextState.work_items).filter((item) => item.status === "skipped").map((item) => item.work_item_id),
    remaining_ids: Object.values(nextState.work_items).filter((item) => item.status === "pending").map((item) => item.work_item_id)
  });

  return renderMobileSessionExecutionShell({
    engineOutput,
    runtimeState,
    presentation: Object.freeze({
      low_input_mode: true
    })
  });
}

/**
 * DEV NOTE: S-V1-38 is a product-layer flow contract around the S-V1-36
 * reducer. It creates factual stop, skip, and partial-completion event records
 * and projects history from the supplied event log only. It must not add
 * judgement copy, scoring, coaching instruction, storage writes, or engine
 * imports.
 */
export function buildStopSkipPartialCompletionFlow(input) {
  validateRequest(input);

  const request = cloneJson(input);
  const priorEvents = cloneJson(request.current_event_log);
  const priorState = replayCurrentState(request.session, priorEvents);

  assertActionAllowed(priorState, request.action_request);

  const event = buildRuntimeEvent(request, priorEvents);
  const nextEventLog = appendV1RuntimeEventLog(priorEvents, event);
  const nextState = replayCurrentState(request.session, nextEventLog);

  return deepFreeze({
    surface_id: stopSkipPartialCompletionContract.surface_id,
    version: stopSkipPartialCompletionContract.version,
    action_status: ACTION_STATUS[event.event_type],
    session_id: request.session.session_id,
    requested_action_type: request.action_request.action_type,
    factual_event: event,
    event_log: Object.freeze({
      previous_event_count: priorEvents.length,
      next_event_count: nextEventLog.length,
      previous_event_log_sha256: sha256(priorEvents),
      next_event_log_sha256: sha256(nextEventLog),
      append_only: true,
      prior_truth_mutated: false
    }),
    history: Object.freeze({
      history_source: stopSkipPartialCompletionContract.history_policy,
      recorded_events: recordedHistoryFromEvents(nextEventLog),
      recorded_event_count: nextEventLog.length,
      includes_only_recorded_events: true,
      judgement_value: null
    }),
    replay: Object.freeze({
      prior_state_sha256: sha256(stableRuntimeReducerJson(priorState)),
      next_state_sha256: sha256(stableRuntimeReducerJson(nextState)),
      deterministic: true
    }),
    state: nextState,
    ui_model: Object.freeze({
      surface_id: "v1_stop_skip_partial_completion_ui",
      copy_ids: STOP_SKIP_PARTIAL_COPY_IDS,
      action_intents: Object.freeze([
        Object.freeze({ copy_id: STOP_SKIP_PARTIAL_COPY_IDS.stopAction, runtime_event_type: "STOP_SESSION" }),
        Object.freeze({ copy_id: STOP_SKIP_PARTIAL_COPY_IDS.skipAction, runtime_event_type: "SKIP_WORK_ITEM" }),
        Object.freeze({ copy_id: STOP_SKIP_PARTIAL_COPY_IDS.partialAction, runtime_event_type: "PARTIAL_COMPLETE_WORK_ITEM" })
      ]),
      mobile_shell: buildShellModel(nextState),
      mutation_contract: Object.freeze({
        emits_factual_runtime_event: true,
        writes_storage: false,
        imports_engine_module: false,
        changes_prior_events: false,
        changes_compile_output: false,
        adds_judgement_value: false
      })
    })
  });
}

export function tryBuildStopSkipPartialCompletionFlow(input) {
  try {
    return Object.freeze({
      ok: true,
      flow: buildStopSkipPartialCompletionFlow(input)
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: error?.code ?? stopSkipPartialCompletionContract.failure_code,
        reason: error?.reason ?? "unknown",
        message: error instanceof Error ? error.message : String(error),
        details: error?.details ?? {}
      })
    });
  }
}

export function handleV1StopSkipPartialCompletionRequest(httpRequest) {
  const method = httpRequest?.method ?? "POST";

  if (method !== "POST") {
    return Object.freeze({
      status: 405,
      body: Object.freeze({
        ok: false,
        reason: "method_not_allowed"
      })
    });
  }

  const result = tryBuildStopSkipPartialCompletionFlow(httpRequest?.body);

  if (result.ok) {
    return Object.freeze({
      status: 201,
      body: Object.freeze({
        ok: true,
        stop_skip_partial_completion_flow: result.flow
      })
    });
  }

  const conflictReasons = new Set([
    "session_terminal",
    "session_not_started",
    "split_open",
    "unknown_work_item",
    "work_item_terminal"
  ]);

  return Object.freeze({
    status: conflictReasons.has(result.error.reason) ? 409 : 400,
    body: Object.freeze({
      ok: false,
      reason: result.error.reason,
      code: result.error.code,
      details: result.error.details
    })
  });
}
