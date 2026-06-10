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
    payload.res.status === 200 || payload.res.status === 201,
    `${label}: append expected 200/201, got ${payload.res.status}. raw=${payload.text}`
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
  "test(v0): completed and partial terminal state/events parity survives fresh process restart",
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

    const helloPath = path.join(process.cwd(), "examples", "hello_world.json");
    const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

    const firstHttp = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_STRICT_HTTP_E2E",
    });
    if (!firstHttp) return;

    const completedSessionId = await buildCompletedTerminal(firstHttp.baseUrl, phase1);
    const partialSessionId = await buildPartialTerminal(firstHttp.baseUrl, phase1);

    const completedStateBefore = await getState(firstHttp.baseUrl, completedSessionId, "completed-state-before");
    const completedEventsBefore = await getEvents(firstHttp.baseUrl, completedSessionId, "completed-events-before");

    const partialStateBefore = await getState(firstHttp.baseUrl, partialSessionId, "partial-state-before");
    const partialEventsBefore = await getEvents(firstHttp.baseUrl, partialSessionId, "partial-events-before");

    assert.equal(
      completedStateBefore.projection.execution_status,
      "completed",
      `completed-state-before: expected completed terminal state.\nprojection=${JSON.stringify(completedStateBefore.projection)}`
    );
    assert.equal(
      partialStateBefore.projection.execution_status,
      "partial",
      `partial-state-before: expected partial terminal state.\nprojection=${JSON.stringify(partialStateBefore.projection)}`
    );

    const secondHttp = await bootHttpVerticalSlice(t, {
      requiredFlagEnvVar: "KOLOSSEUM_STRICT_HTTP_E2E",
    });
    if (!secondHttp) return;

    const completedStateAfter = await getState(secondHttp.baseUrl, completedSessionId, "completed-state-after-restart");
    const completedEventsAfter = await getEvents(secondHttp.baseUrl, completedSessionId, "completed-events-after-restart");

    const partialStateAfter = await getState(secondHttp.baseUrl, partialSessionId, "partial-state-after-restart");
    const partialEventsAfter = await getEvents(secondHttp.baseUrl, partialSessionId, "partial-events-after-restart");

    assert.deepEqual(
      completedStateBefore.projection,
      completedStateAfter.projection,
      `completed terminal state must survive fresh process restart without drift.\nBEFORE=${JSON.stringify(completedStateBefore.projection)}\nAFTER=${JSON.stringify(completedStateAfter.projection)}`
    );

    assert.deepEqual(
      completedEventsBefore.projection,
      completedEventsAfter.projection,
      `completed terminal events must survive fresh process restart without drift.\nBEFORE=${JSON.stringify(completedEventsBefore.projection)}\nAFTER=${JSON.stringify(completedEventsAfter.projection)}`
    );

    assert.deepEqual(
      partialStateBefore.projection,
      partialStateAfter.projection,
      `partial terminal state must survive fresh process restart without drift.\nBEFORE=${JSON.stringify(partialStateBefore.projection)}\nAFTER=${JSON.stringify(partialStateAfter.projection)}`
    );

    assert.deepEqual(
      partialEventsBefore.projection,
      partialEventsAfter.projection,
      `partial terminal events must survive fresh process restart without drift.\nBEFORE=${JSON.stringify(partialEventsBefore.projection)}\nAFTER=${JSON.stringify(partialEventsAfter.projection)}`
    );

    assert.equal(
      completedStateAfter.projection.trace.return_decision_required,
      false,
      `completed terminal restart read must not re-open return gate.\nprojection=${JSON.stringify(completedStateAfter.projection)}`
    );
    assert.equal(
      partialStateAfter.projection.trace.return_decision_required,
      false,
      `partial terminal restart read must not re-open return gate.\nprojection=${JSON.stringify(partialStateAfter.projection)}`
    );

    assert.equal(
      completedStateAfter.projection.trace.dropped_ids.length,
      0,
      `completed terminal restart read must not invent dropped work.\nprojection=${JSON.stringify(completedStateAfter.projection)}`
    );
    assert.ok(
      partialStateAfter.projection.trace.dropped_ids.length >= 1,
      `partial terminal restart read must preserve dropped work.\nprojection=${JSON.stringify(partialStateAfter.projection)}`
    );
  }
);