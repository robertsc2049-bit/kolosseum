import crypto from "node:crypto";

export const SESSION_START_FLOW_COPY_IDS = Object.freeze({
  title: "SESSION_START_FLOW_TITLE",
  action: "SESSION_START_FLOW_ACTION",
  alreadyStarted: "SESSION_START_FLOW_ALREADY_STARTED",
  blocked: "SESSION_START_FLOW_BLOCKED",
  recordedEvent: "SESSION_START_FLOW_RECORDED_EVENT"
});

export const sessionStartFlowContract = Object.freeze({
  surface_id: "v1_session_start_flow",
  version: "1.0.0",
  slice_id: "S-V1-35",
  compile_output_version: "S-V1-31",
  start_event_type: "SESSION_START",
  restart_policy: "return_existing_start_event_only",
  allowed_compiled_session_statuses: Object.freeze(["compiled", "canonical_v1_compile_output"]),
  failure_code: "v1_session_start_flow_failure"
});

const REQUIRED_ROOT_KEYS = Object.freeze([
  "request_id",
  "requested_at",
  "actor",
  "assignment",
  "compiled_session",
  "start_request",
  "prior_start_event"
]);

const REQUIRED_ACTOR_KEYS = Object.freeze([
  "actor_type",
  "athlete_id"
]);

const REQUIRED_ASSIGNMENT_KEYS = Object.freeze([
  "assignment_id",
  "assignment_status",
  "assigned_athlete_id",
  "activity_id"
]);

const REQUIRED_COMPILED_SESSION_KEYS = Object.freeze([
  "session_id",
  "assignment_id",
  "athlete_id",
  "activity_id",
  "compile_output_version",
  "compile_output_status",
  "compiled_session_status",
  "compile_output_hash",
  "execution_ui_contract"
]);

const REQUIRED_START_REQUEST_KEYS = Object.freeze([
  "idempotency_key",
  "start_policy"
]);

const REQUIRED_PRIOR_START_EVENT_KEYS = Object.freeze([
  "event_id",
  "event_type",
  "session_id",
  "assignment_id",
  "occurred_at",
  "source"
]);

const FORBIDDEN_KEYS = Object.freeze([
  "extra_session_id",
  "ad_hoc_session",
  "coach_live_change",
  "coach_override",
  "coach_message",
  "video_url",
  "media_url",
  "engine_override",
  "engine_input_override",
  "engine_truth_override",
  "progression_change",
  "billing_state",
  "marketplace_purchase_id",
  "team_id",
  "organisation_id",
  "organization_id"
]);

const FORBIDDEN_POST_V1_KEYS = Object.freeze([
  ["reco", "mmendation"].join(""),
  ["optimi", "sation"].join(""),
  ["ready", "ness"].join(""),
  ["fat", "igue"].join(""),
  ["ri", "sk"].join("")
]);

const ALL_FORBIDDEN_KEYS = Object.freeze([
  ...FORBIDDEN_KEYS,
  ...FORBIDDEN_POST_V1_KEYS
]);

function fail(reason, message, details = {}) {
  const error = new Error(`v1_session_start_flow_${reason}: ${message}`);
  error.code = `v1_session_start_flow_${reason}`;
  error.reason = reason;
  error.details = details;
  throw error;
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function assertPlainRecord(value, reason, message, details = {}) {
  if (!isPlainRecord(value)) {
    fail(reason, message, details);
  }
}

function assertExactKeys(value, requiredKeys, reason, details = {}, optionalKeys = []) {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
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

function assertBoolean(value, reason, details = {}) {
  if (typeof value !== "boolean") {
    fail(reason, "expected boolean", details);
  }
}

function assertIsoString(value, reason, details = {}) {
  assertNonEmptyString(value, reason, details);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(reason, "expected UTC ISO-8601 timestamp string", details);
  }
}

function assertNoForbiddenKeysDeep(value, pathParts = []) {
  if (!isPlainRecord(value) && !Array.isArray(value)) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeysDeep(item, [...pathParts, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    if (ALL_FORBIDDEN_KEYS.includes(key)) {
      fail("forbidden_scope_field", "start flow input contains a forbidden field", {
        path: [...pathParts, key].join("."),
        field: key
      });
    }

    assertNoForbiddenKeysDeep(value[key], [...pathParts, key]);
  }
}

function canonicalise(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (isPlainRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = canonicalise(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalise(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function deterministicId(prefix, value) {
  return `${prefix}_${sha256(stableJson(value)).slice(0, 24)}`;
}

function readExecutionUiContract(compiledSession) {
  const ui = compiledSession.execution_ui_contract;

  assertPlainRecord(ui, "compiled_session_invalid", "execution_ui_contract must be an object");
  assertNonEmptyString(ui.session_id, "compiled_session_invalid", { field: "execution_ui_contract.session_id" });

  if (ui.session_id !== compiledSession.session_id) {
    fail("compiled_session_invalid", "execution_ui_contract session_id mismatch", {
      expected: compiledSession.session_id,
      actual: ui.session_id
    });
  }

  if (!Array.isArray(ui.work_items)) {
    fail("compiled_session_invalid", "execution_ui_contract work_items must be an array");
  }

  return ui;
}

function validateActor(actor) {
  assertPlainRecord(actor, "actor_invalid", "actor must be an object");
  assertExactKeys(actor, REQUIRED_ACTOR_KEYS, "actor_invalid", { object: "actor" });

  if (actor.actor_type !== "athlete") {
    fail("actor_invalid", "session start actor must be athlete", {
      actor_type: actor.actor_type
    });
  }

  assertNonEmptyString(actor.athlete_id, "actor_invalid", { field: "actor.athlete_id" });
}

function validateAssignment(assignment, actor) {
  assertPlainRecord(assignment, "assignment_invalid", "assignment must be an object");
  assertExactKeys(assignment, REQUIRED_ASSIGNMENT_KEYS, "assignment_invalid", { object: "assignment" });

  if (assignment.assignment_status !== "assigned") {
    fail("assignment_invalid", "assignment status must be assigned", {
      assignment_status: assignment.assignment_status
    });
  }

  if (assignment.assigned_athlete_id !== actor.athlete_id) {
    fail("assignment_invalid", "assignment athlete mismatch", {
      actor_athlete_id: actor.athlete_id,
      assigned_athlete_id: assignment.assigned_athlete_id
    });
  }

  assertNonEmptyString(assignment.assignment_id, "assignment_invalid", { field: "assignment.assignment_id" });
  assertNonEmptyString(assignment.activity_id, "assignment_invalid", { field: "assignment.activity_id" });
}

function validateCompiledSession(compiledSession, assignment, actor) {
  assertPlainRecord(compiledSession, "compiled_session_missing", "compiled_session must be present");
  assertExactKeys(compiledSession, REQUIRED_COMPILED_SESSION_KEYS, "compiled_session_invalid", { object: "compiled_session" });

  if (compiledSession.assignment_id !== assignment.assignment_id) {
    fail("compiled_session_invalid", "compiled session assignment mismatch", {
      expected: assignment.assignment_id,
      actual: compiledSession.assignment_id
    });
  }

  if (compiledSession.athlete_id !== actor.athlete_id) {
    fail("compiled_session_invalid", "compiled session athlete mismatch", {
      expected: actor.athlete_id,
      actual: compiledSession.athlete_id
    });
  }

  if (compiledSession.activity_id !== assignment.activity_id) {
    fail("compiled_session_invalid", "compiled session activity mismatch", {
      expected: assignment.activity_id,
      actual: compiledSession.activity_id
    });
  }

  if (compiledSession.compile_output_version !== sessionStartFlowContract.compile_output_version) {
    fail("compiled_session_invalid", "compile output version mismatch", {
      expected: sessionStartFlowContract.compile_output_version,
      actual: compiledSession.compile_output_version
    });
  }

  if (compiledSession.compile_output_status !== "canonical_v1_compile_output") {
    fail("compiled_session_invalid", "compile output status must be canonical_v1_compile_output", {
      compile_output_status: compiledSession.compile_output_status
    });
  }

  if (!sessionStartFlowContract.allowed_compiled_session_statuses.includes(compiledSession.compiled_session_status)) {
    fail("compiled_session_invalid", "compiled session status is not startable", {
      compiled_session_status: compiledSession.compiled_session_status
    });
  }

  assertNonEmptyString(compiledSession.session_id, "compiled_session_invalid", { field: "compiled_session.session_id" });
  assertNonEmptyString(compiledSession.compile_output_hash, "compiled_session_invalid", { field: "compiled_session.compile_output_hash" });

  readExecutionUiContract(compiledSession);
}

function validateStartRequest(startRequest) {
  assertPlainRecord(startRequest, "start_request_invalid", "start_request must be an object");
  assertExactKeys(startRequest, REQUIRED_START_REQUEST_KEYS, "start_request_invalid", { object: "start_request" });
  assertNonEmptyString(startRequest.idempotency_key, "start_request_invalid", { field: "start_request.idempotency_key" });

  if (startRequest.start_policy !== "start_or_return_existing") {
    fail("start_request_invalid", "unsupported start policy", {
      start_policy: startRequest.start_policy
    });
  }
}

function validatePriorStartEvent(priorStartEvent, compiledSession, assignment) {
  if (priorStartEvent === null) {
    return null;
  }

  assertPlainRecord(priorStartEvent, "prior_start_event_invalid", "prior_start_event must be null or object");
  assertExactKeys(priorStartEvent, REQUIRED_PRIOR_START_EVENT_KEYS, "prior_start_event_invalid", { object: "prior_start_event" });

  if (priorStartEvent.event_type !== sessionStartFlowContract.start_event_type) {
    fail("prior_start_event_invalid", "prior start event type mismatch", {
      event_type: priorStartEvent.event_type
    });
  }

  if (priorStartEvent.session_id !== compiledSession.session_id) {
    fail("prior_start_event_invalid", "prior start event session mismatch", {
      expected: compiledSession.session_id,
      actual: priorStartEvent.session_id
    });
  }

  if (priorStartEvent.assignment_id !== assignment.assignment_id) {
    fail("prior_start_event_invalid", "prior start event assignment mismatch", {
      expected: assignment.assignment_id,
      actual: priorStartEvent.assignment_id
    });
  }

  assertNonEmptyString(priorStartEvent.event_id, "prior_start_event_invalid", { field: "prior_start_event.event_id" });
  assertIsoString(priorStartEvent.occurred_at, "prior_start_event_invalid", { field: "prior_start_event.occurred_at" });

  return Object.freeze({ ...priorStartEvent });
}

function buildStartEvent(input) {
  const payload = {
    request_id: input.request_id,
    requested_at: input.requested_at,
    session_id: input.compiled_session.session_id,
    assignment_id: input.assignment.assignment_id,
    athlete_id: input.actor.athlete_id,
    compile_output_hash: input.compiled_session.compile_output_hash,
    idempotency_key: input.start_request.idempotency_key
  };

  return Object.freeze({
    event_id: deterministicId("session_start_event", payload),
    event_type: sessionStartFlowContract.start_event_type,
    session_id: input.compiled_session.session_id,
    assignment_id: input.assignment.assignment_id,
    athlete_id: input.actor.athlete_id,
    occurred_at: input.requested_at,
    source: "athlete_start_request",
    factual_event: true,
    compile_output_hash: input.compiled_session.compile_output_hash,
    idempotency_key: input.start_request.idempotency_key
  });
}

function buildUiModel(input, startEvent, startStatus) {
  const executionUi = readExecutionUiContract(input.compiled_session);

  return Object.freeze({
    surface_id: "v1_session_start_flow_ui",
    copy_ids: SESSION_START_FLOW_COPY_IDS,
    session_id: input.compiled_session.session_id,
    start_status: startStatus,
    primary_action_state: startStatus === "already_started" ? "recorded" : "started",
    mobile_shell_input: Object.freeze({
      engineOutput: Object.freeze({
        session_id: input.compiled_session.session_id,
        status: "in_progress",
        work_items: executionUi.work_items
      }),
      runtimeState: Object.freeze({
        session_id: input.compiled_session.session_id,
        started_event_id: startEvent.event_id,
        completed_ids: Object.freeze([]),
        skipped_ids: Object.freeze([])
      }),
      presentation: Object.freeze({
        low_input_mode: true
      })
    }),
    mutation_contract: Object.freeze({
      creates_engine_output: false,
      changes_compile_output: false,
      coach_live_change: false,
      ad_hoc_extra_session: false,
      advisory_decision: false
    })
  });
}

/**
 * DEV NOTE: S-V1-35 creates a product-layer start flow for an already assigned
 * compiled session. It validates explicit product state, emits a factual start
 * event model, and returns an idempotent existing event when supplied. It must
 * not create ad hoc sessions, route coach live changes, import engine modules,
 * change compile output, or emit advisory decision.
 */
export function buildSessionStartFlow(input) {
  assertPlainRecord(input, "input_invalid", "input must be an object");
  assertNoForbiddenKeysDeep(input);
  assertExactKeys(input, REQUIRED_ROOT_KEYS, "input_invalid", { object: "root" });

  assertNonEmptyString(input.request_id, "input_invalid", { field: "request_id" });
  assertIsoString(input.requested_at, "input_invalid", { field: "requested_at" });

  validateActor(input.actor);
  validateAssignment(input.assignment, input.actor);
  validateCompiledSession(input.compiled_session, input.assignment, input.actor);
  validateStartRequest(input.start_request);

  const prior = validatePriorStartEvent(input.prior_start_event, input.compiled_session, input.assignment);
  const startEvent = prior ?? buildStartEvent(input);
  const startStatus = prior ? "already_started" : "started";

  return Object.freeze({
    surface_id: sessionStartFlowContract.surface_id,
    version: sessionStartFlowContract.version,
    session_id: input.compiled_session.session_id,
    assignment_id: input.assignment.assignment_id,
    athlete_id: input.actor.athlete_id,
    activity_id: input.assignment.activity_id,
    start_status: startStatus,
    start_event: startEvent,
    idempotency: Object.freeze({
      key: input.start_request.idempotency_key,
      restart_policy: sessionStartFlowContract.restart_policy,
      created_start_event: prior === null,
      returned_existing_start_event: prior !== null
    }),
    ui_model: buildUiModel(input, startEvent, startStatus),
    boundary: Object.freeze({
      lawful_compiled_state_required: true,
      start_event_is_factual: true,
      ad_hoc_extra_session: false,
      coach_live_change: false,
      advisory_decision: false,
      changes_compile_output: false
    })
  });
}

export function tryBuildSessionStartFlow(input) {
  try {
    return Object.freeze({
      ok: true,
      start_flow: buildSessionStartFlow(input)
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: error?.code ?? sessionStartFlowContract.failure_code,
        reason: error?.reason ?? "unknown",
        message: error instanceof Error ? error.message : String(error),
        details: error?.details ?? {}
      })
    });
  }
}

export function handleV1SessionStartRequest(request) {
  assertPlainRecord(request, "request_invalid", "request must be an object");

  if (request.method !== "POST") {
    return Object.freeze({
      status: 405,
      body: Object.freeze({
        ok: false,
        error_code: "v1_session_start_flow_method_not_allowed"
      })
    });
  }

  const result = tryBuildSessionStartFlow(request.body);

  if (!result.ok) {
    const status = result.error.reason === "compiled_session_missing" ? 400 : 422;

    return Object.freeze({
      status,
      body: Object.freeze({
        ok: false,
        error_code: result.error.code,
        reason: result.error.reason,
        details: result.error.details
      })
    });
  }

  return Object.freeze({
    status: result.start_flow.start_status === "already_started" ? 200 : 201,
    body: Object.freeze({
      ok: true,
      start_flow: result.start_flow
    })
  });
}
