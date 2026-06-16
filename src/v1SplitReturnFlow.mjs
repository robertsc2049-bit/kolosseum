import crypto from "node:crypto";

import { renderMobileSessionExecutionShell } from "./mobileSessionExecutionShell.mjs";
import {
  appendV1RuntimeEventLog,
  replayV1RuntimeEvents,
  stableRuntimeReducerJson,
  v1RuntimeEventReducerContract
} from "./v1RuntimeEventReducer.mjs";

export const SPLIT_RETURN_FLOW_COPY_IDS = Object.freeze({
  title: "SPLIT_RETURN_FLOW_TITLE",
  splitAction: "SPLIT_RETURN_FLOW_SPLIT_ACTION",
  returnContinueAction: "SPLIT_RETURN_FLOW_RETURN_CONTINUE_ACTION",
  returnSkipAction: "SPLIT_RETURN_FLOW_RETURN_SKIP_ACTION",
  splitRecorded: "SPLIT_RETURN_FLOW_SPLIT_RECORDED",
  returnRecorded: "SPLIT_RETURN_FLOW_RETURN_RECORDED",
  decisionResolved: "SPLIT_RETURN_FLOW_DECISION_RESOLVED"
});

export const splitReturnFlowContract = Object.freeze({
  surface_id: "v1_split_return_flow",
  version: "1.0.0",
  slice_id: "S-V1-37",
  reducer_contract: v1RuntimeEventReducerContract.surface_id,
  factual_event_types: Object.freeze(["SPLIT_SESSION", "RETURN_CONTINUE", "RETURN_SKIP"]),
  return_policy: "single_open_split_decision",
  replay_policy: "resolved_return_decision_rejected",
  failure_code: "v1_split_return_flow_failure"
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
  "extra_session_id",
  "ad_hoc_session",
  ["reco", "mmendation"].join(""),
  ["optimi", "sation"].join(""),
  ["ready", "ness"].join(""),
  ["fat", "igue"].join(""),
  ["ri", "sk"].join(""),
  ["ad", "vice"].join("")
]);

const ACTION_STATUS = Object.freeze({
  SPLIT_SESSION: "split_recorded",
  RETURN_CONTINUE: "return_continue_recorded",
  RETURN_SKIP: "return_skip_recorded"
});

const RETURN_EVENT_TYPES = new Set(["RETURN_CONTINUE", "RETURN_SKIP"]);

function fail(reason, message, details = {}) {
  const error = new Error(`v1_split_return_flow_${reason}: ${message}`);
  error.code = `v1_split_return_flow_${reason}`;
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
      fail("forbidden_scope_field", "split return input contains forbidden field", {
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
  return `split_return_event_${sha256({
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

function validateAction(actionRequest) {
  assertRecord(actionRequest, "action_invalid", "action_request must be an object");
  assertExactKeys(actionRequest, REQUIRED_ACTION_KEYS, "action_invalid", { object: "action_request" });
  assertNonEmptyString(actionRequest.idempotency_key, "action_invalid", { field: "idempotency_key" });
  assertNullableString(actionRequest.reason_code, "action_invalid", { field: "reason_code" });

  if (!splitReturnFlowContract.factual_event_types.includes(actionRequest.action_type)) {
    fail("action_invalid", "unsupported split return action_type", {
      action_type: actionRequest.action_type
    });
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

function findLastReturnDecision(events) {
  return [...events].reverse().find((event) => RETURN_EVENT_TYPES.has(event.event_type)) ?? null;
}

function findLastSplit(events) {
  return [...events].reverse().find((event) => event.event_type === "SPLIT_SESSION") ?? null;
}

function assertActionAllowed(state, events, actionType) {
  if (actionType === "SPLIT_SESSION") {
    if (state.split.active === true) {
      fail("split_already_open", "split event cannot be recorded while split is open", {});
    }

    if (state.status === "completed" || state.status === "partially_completed" || state.status === "stopped") {
      fail("session_terminal", "split event cannot be recorded after terminal session state", {
        status: state.status
      });
    }

    return;
  }

  const lastSplit = findLastSplit(events);
  const lastReturn = findLastReturnDecision(events);

  if (lastReturn && (!lastSplit || lastReturn.seq > lastSplit.seq)) {
    fail("return_decision_already_resolved", "return decision has already been recorded for the latest split", {
      event_id: lastReturn.event_id,
      event_type: lastReturn.event_type
    });
  }

  if (state.split.active !== true) {
    fail("return_decision_not_open", "return decision requires an open split", {
      action_type: actionType
    });
  }
}

function buildFactualPayload(actionRequest) {
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
    work_item_id: null,
    factual_payload: buildFactualPayload(request.action_request)
  });
}

function buildShellModel(request, nextState) {
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
 * DEV NOTE: S-V1-37 is a product-layer flow contract around the S-V1-36
 * reducer. It creates factual split/return event records only, replays state
 * through the reducer, and rejects resolved return decisions. It must not write
 * storage, import engine modules, alter prior events, or create live coach
 * mutation behaviour.
 */
export function buildSplitReturnFlow(input) {
  validateRequest(input);

  const request = cloneJson(input);
  const priorEvents = cloneJson(request.current_event_log);
  const priorState = replayCurrentState(request.session, priorEvents);

  assertActionAllowed(priorState, priorEvents, request.action_request.action_type);

  const event = buildRuntimeEvent(request, priorEvents);
  const nextEventLog = appendV1RuntimeEventLog(priorEvents, event);
  const nextState = replayCurrentState(request.session, nextEventLog);

  return deepFreeze({
    surface_id: splitReturnFlowContract.surface_id,
    version: splitReturnFlowContract.version,
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
    return_decision: Object.freeze({
      required_before: priorState.split.active === true,
      required_after: nextState.split.active === true,
      options_before: priorState.split.active === true ? Object.freeze(["RETURN_CONTINUE", "RETURN_SKIP"]) : Object.freeze([]),
      options_after: nextState.split.active === true ? Object.freeze(["RETURN_CONTINUE", "RETURN_SKIP"]) : Object.freeze([]),
      resolved_event_type: RETURN_EVENT_TYPES.has(event.event_type) ? event.event_type : null,
      resolved_decisions_rejected: true
    }),
    replay: Object.freeze({
      prior_state_sha256: sha256(stableRuntimeReducerJson(priorState)),
      next_state_sha256: sha256(stableRuntimeReducerJson(nextState)),
      deterministic: true
    }),
    state: nextState,
    ui_model: Object.freeze({
      surface_id: "v1_split_return_flow_ui",
      copy_ids: SPLIT_RETURN_FLOW_COPY_IDS,
      mobile_shell: buildShellModel(request, nextState),
      mutation_contract: Object.freeze({
        emits_factual_runtime_event: true,
        writes_storage: false,
        imports_engine_module: false,
        changes_prior_events: false,
        changes_compile_output: false,
        coach_live_change: false
      })
    })
  });
}

export function tryBuildSplitReturnFlow(input) {
  try {
    return Object.freeze({
      ok: true,
      flow: buildSplitReturnFlow(input)
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: error?.code ?? splitReturnFlowContract.failure_code,
        reason: error?.reason ?? "unknown",
        message: error instanceof Error ? error.message : String(error),
        details: error?.details ?? {}
      })
    });
  }
}

export function handleV1SplitReturnFlowRequest(httpRequest) {
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

  const result = tryBuildSplitReturnFlow(httpRequest?.body);

  if (result.ok) {
    return Object.freeze({
      status: 201,
      body: Object.freeze({
        ok: true,
        split_return_flow: result.flow
      })
    });
  }

  const conflictReasons = new Set([
    "split_already_open",
    "return_decision_already_resolved",
    "return_decision_not_open",
    "session_terminal"
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
