import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  bootHttpVerticalSlice,
  readJsonOnce,
} from "../test_support/http_e2e_harness.mjs";

async function httpJson(method, url, body) {
  const init = {
    method,
    headers: { "content-type": "application/json" },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const { text, json } = await readJsonOnce(res);
  return { res, text, json };
}

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function pickSessionId(payload, label) {
  const candidates = [
    payload?.json?.session_id,
    payload?.json?.session?.session_id,
    payload?.json?.created_session?.session_id,
    payload?.json?.runtime?.session_id,
    payload?.json?.result?.session_id,
  ].filter(Boolean);

  assert.ok(
    candidates.length >= 1,
    `${label}: expected compile response to expose session_id. raw=${payload?.text}`
  );

  return String(candidates[0]);
}

function pickStateEnvelope(payload, label) {
  assert.ok(
    payload?.json && typeof payload.json === "object",
    `${label}: expected JSON object. raw=${payload?.text}`
  );

  const candidates = [
    payload.json.state,
    payload.json.runtime_state,
    payload.json.session_state,
    payload.json.runtime?.state,
    payload.json.runtime,
    payload.json,
  ].filter(Boolean);

  const stateLike = candidates[0];
  assert.ok(
    stateLike && typeof stateLike === "object",
    `${label}: expected state envelope object. raw=${payload?.text}`
  );

  return stateLike;
}

function readTrace(stateLike) {
  return stateLike?.trace ?? {};
}

function readExecutionStatus(stateLike) {
  return (
    stateLike?.execution_status ??
    stateLike?.executionState?.execution_status ??
    stateLike?.execution?.status ??
    stateLike?.status ??
    null
  );
}

function readCurrentExerciseId(stateLike) {
  return (
    stateLike?.current_step?.exercise?.exercise_id ??
    stateLike?.current_step?.exercise_id ??
    stateLike?.current_exercise_id ??
    null
  );
}

function projectState(stateLike) {
  const trace = readTrace(stateLike);

  return {
    execution_status: readExecutionStatus(stateLike),
    current_exercise_id: readCurrentExerciseId(stateLike),
    trace: {
      completed_ids: Array.isArray(trace.completed_ids) ? cloneJson(trace.completed_ids) : [],
      dropped_ids: Array.isArray(trace.dropped_ids) ? cloneJson(trace.dropped_ids) : [],
      remaining_ids: Array.isArray(trace.remaining_ids) ? cloneJson(trace.remaining_ids) : [],
      return_decision_required:
        typeof trace.return_decision_required === "boolean"
          ? trace.return_decision_required
          : false,
      return_decision_options: Array.isArray(trace.return_decision_options)
        ? cloneJson(trace.return_decision_options)
        : [],
    },
    session_execution_summary: Array.isArray(stateLike?.session_execution_summary)
      ? cloneJson(stateLike.session_execution_summary)
      : [],
    block_execution_summary: Array.isArray(stateLike?.block_execution_summary)
      ? cloneJson(stateLike.block_execution_summary)
      : [],
  };
}

function assertNoLegacyGateLeak(stateLike, label) {
  const trace = readTrace(stateLike);

  assert.equal(
    Object.prototype.hasOwnProperty.call(trace, "split_active"),
    false,
    `${label}: trace must not expose split_active`
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(trace, "return_gate_required"),
    false,
    `${label}: trace must not expose return_gate_required`
  );
}

function pickEventsArray(payload, label) {
  const candidates = [
    payload?.json?.events,
    payload?.json?.runtime_events,
    payload?.json?.items,
    payload?.json?.data?.events,
  ].filter(Array.isArray);

  assert.ok(
    candidates.length >= 1,
    `${label}: expected events array. raw=${payload?.text}`
  );

  return candidates[0];
}

function projectEvents(events) {
  return events.map((event) => ({
    type: event?.type ?? event?.event?.type ?? null,
    exercise_id:
      event?.exercise_id ??
      event?.event?.exercise_id ??
      event?.payload?.exercise_id ??
      null,
  }));
}

function normalizeErrorShape(payload) {
  return {
    status: payload?.res?.status ?? null,
    json: cloneJson(payload?.json ?? null),
    text: typeof payload?.text === "string" ? payload.text : "",
  };
}

async function compileWithSession(baseUrl, phase1Input, label) {
  const payload = await httpJson("POST", `${baseUrl}/blocks/compile`, {
    phase1_input: phase1Input,
    runtime_events: [],
    create_session: true,
  });

  assert.ok(
    payload.res.status === 200 || payload.res.status === 201,
    `${label}: compile expected 200/201, got ${payload.res.status}. raw=${payload.text}`
  );

  return {
    payload,
    sessionId: pickSessionId(payload, label),
  };
}

async function startSession(baseUrl, sessionId, label) {
  const payload = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});

  assert.equal(
    payload.res.status,
    200,
    `${label}: start expected 200, got ${payload.res.status}. raw=${payload.text}`
  );

  return payload;
}

async function appendEvent(baseUrl, sessionId, event, label) {
  const payload = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/events`, event);

  assert.ok(
    payload.res.status === 200 || payload.res.status === 201 || payload.res.status >= 400,
    `${label}: unexpected append response ${payload.res.status}. raw=${payload.text}`
  );

  return payload;
}

async function getState(baseUrl, sessionId, label) {
  const payload = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);

  assert.equal(
    payload.res.status,
    200,
    `${label}: state expected 200, got ${payload.res.status}. raw=${payload.text}`
  );

  const stateLike = pickStateEnvelope(payload, label);
  assertNoLegacyGateLeak(stateLike, label);

  return {
    payload,
    stateLike,
    projection: projectState(stateLike),
  };
}

async function getEvents(baseUrl, sessionId, label) {
  const payload = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);

  assert.equal(
    payload.res.status,
    200,
    `${label}: events expected 200, got ${payload.res.status}. raw=${payload.text}`
  );

  const events = pickEventsArray(payload, label);
  return {
    payload,
    events,
    projection: projectEvents(events),
  };
}

async function buildCompletedTerminal(baseUrl, phase1) {
  const compiled = await compileWithSession(baseUrl, phase1, "completed-compile");
  await startSession(baseUrl, compiled.sessionId, "completed-start");

  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
    "completed-1"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
    "completed-2"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
    "completed-3"
  );

  return compiled.sessionId;
}

async function buildPartialTerminal(baseUrl, phase1) {
  const compiled = await compileWithSession(baseUrl, phase1, "partial-compile");
  await startSession(baseUrl, compiled.sessionId, "partial-start");

  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
    "partial-1"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "SPLIT_SESSION" },
    "partial-split"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "RETURN_SKIP" },
    "partial-return-skip"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
    "partial-2"
  );

  return compiled.sessionId;
}

test(
  "test(v0): terminal contract matrix proves completed and partial terminal invariants in one grouped slice",
  async (t) => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousSmokeNoDb = process.env.SMOKE_NO_DB;

    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@127.0.0.1:5432/kolosseum_test";
    delete process.env.SMOKE_NO_DB;

    t.after(() => {
      if (typeof previousDatabaseUrl === "undefined") {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }

      if (typeof previousSmokeNoDb === "undefined") {
        delete process.env.SMOKE_NO_DB;
      } else {
        process.env.SMOKE_NO_DB = previousSmokeNoDb;
      }
    });

    const http = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_STRICT_HTTP_E2E",
    });
    if (!http) return;

    const helloPath = path.join(process.cwd(), "examples", "hello_world.json");
    const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

    const completedSessionId = await buildCompletedTerminal(http.baseUrl, phase1);
    const partialSessionId = await buildPartialTerminal(http.baseUrl, phase1);

    const completedStateA = await getState(http.baseUrl, completedSessionId, "completed-state-A");
    const completedEventsA = await getEvents(http.baseUrl, completedSessionId, "completed-events-A");
    const completedStateB = await getState(http.baseUrl, completedSessionId, "completed-state-B");
    const completedEventsB = await getEvents(http.baseUrl, completedSessionId, "completed-events-B");

    const partialStateA = await getState(http.baseUrl, partialSessionId, "partial-state-A");
    const partialEventsA = await getEvents(http.baseUrl, partialSessionId, "partial-events-A");
    const partialStateB = await getState(http.baseUrl, partialSessionId, "partial-state-B");
    const partialEventsB = await getEvents(http.baseUrl, partialSessionId, "partial-events-B");

    const completedReject = await appendEvent(
      http.baseUrl,
      completedSessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "completed-reject"
    );
    const partialReject = await appendEvent(
      http.baseUrl,
      partialSessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
      "partial-reject"
    );

    assert.equal(
      completedStateA.projection.execution_status,
      "completed",
      `completed-state-A: expected completed terminal state.\nprojection=${JSON.stringify(completedStateA.projection)}`
    );
    assert.equal(
      completedStateA.projection.trace.dropped_ids.length,
      0,
      `completed-state-A: completed path must not drop work.\nprojection=${JSON.stringify(completedStateA.projection)}`
    );
    assert.equal(
      completedStateA.projection.trace.return_decision_required,
      false,
      `completed-state-A: completed path must not require return gate.\nprojection=${JSON.stringify(completedStateA.projection)}`
    );
    assert.deepEqual(
      completedStateA.projection,
      completedStateB.projection,
      `completed state must remain parity-stable across repeated reads.\nA=${JSON.stringify(completedStateA.projection)}\nB=${JSON.stringify(completedStateB.projection)}`
    );
    assert.deepEqual(
      completedEventsA.projection,
      completedEventsB.projection,
      `completed events must remain parity-stable across repeated reads.\nA=${JSON.stringify(completedEventsA.projection)}\nB=${JSON.stringify(completedEventsB.projection)}`
    );
    assert.ok(
      completedReject.res.status >= 400,
      `completed-reject: expected post-terminal rejection, got ${completedReject.res.status}. raw=${completedReject.text}`
    );

    assert.equal(
      partialStateA.projection.execution_status,
      "partial",
      `partial-state-A: expected partial terminal state.\nprojection=${JSON.stringify(partialStateA.projection)}`
    );
    assert.ok(
      partialStateA.projection.trace.dropped_ids.length >= 1,
      `partial-state-A: partial path must preserve dropped work.\nprojection=${JSON.stringify(partialStateA.projection)}`
    );
    assert.equal(
      partialStateA.projection.trace.return_decision_required,
      false,
      `partial-state-A: return gate must be cleared after terminalization.\nprojection=${JSON.stringify(partialStateA.projection)}`
    );
    assert.deepEqual(
      partialStateA.projection,
      partialStateB.projection,
      `partial state must remain parity-stable across repeated reads.\nA=${JSON.stringify(partialStateA.projection)}\nB=${JSON.stringify(partialStateB.projection)}`
    );
    assert.deepEqual(
      partialEventsA.projection,
      partialEventsB.projection,
      `partial events must remain parity-stable across repeated reads.\nA=${JSON.stringify(partialEventsA.projection)}\nB=${JSON.stringify(partialEventsB.projection)}`
    );
    assert.ok(
      partialReject.res.status >= 400,
      `partial-reject: expected post-terminal rejection, got ${partialReject.res.status}. raw=${partialReject.text}`
    );

    const matrix = {
      completed: {
        execution_status: completedStateA.projection.execution_status,
        dropped_count: completedStateA.projection.trace.dropped_ids.length,
        return_decision_required: completedStateA.projection.trace.return_decision_required,
        repeated_state_parity: completedStateA.projection,
        repeated_events_parity: completedEventsA.projection,
        rejection_shape: normalizeErrorShape(completedReject),
      },
      partial: {
        execution_status: partialStateA.projection.execution_status,
        dropped_count: partialStateA.projection.trace.dropped_ids.length,
        return_decision_required: partialStateA.projection.trace.return_decision_required,
        repeated_state_parity: partialStateA.projection,
        repeated_events_parity: partialEventsA.projection,
        rejection_shape: normalizeErrorShape(partialReject),
      },
    };

    assert.equal(matrix.completed.execution_status, "completed");
    assert.equal(matrix.completed.dropped_count, 0);
    assert.equal(matrix.completed.return_decision_required, false);
    assert.ok(matrix.completed.rejection_shape.status >= 400);

    assert.equal(matrix.partial.execution_status, "partial");
    assert.ok(matrix.partial.dropped_count >= 1);
    assert.equal(matrix.partial.return_decision_required, false);
    assert.ok(matrix.partial.rejection_shape.status >= 400);
  }
);