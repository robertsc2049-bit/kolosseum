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

test(
  "test(v0): partial terminal state and events remain parity-stable across repeated read cycles after return skip",
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

    const compiled = await compileWithSession(http.baseUrl, phase1, "compile");
    await startSession(http.baseUrl, compiled.sessionId, "start");

    await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "complete-1"
    );

    await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "SPLIT_SESSION" },
      "split"
    );

    const splitState = await getState(http.baseUrl, compiled.sessionId, "state-during-split");
    assert.equal(
      splitState.projection.trace.return_decision_required,
      true,
      `state-during-split: expected explicit return decision gate.\nprojection=${JSON.stringify(splitState.projection)}`
    );
    assert.ok(
      splitState.projection.trace.return_decision_options.includes("RETURN_CONTINUE") &&
        splitState.projection.trace.return_decision_options.includes("RETURN_SKIP"),
      `state-during-split: expected continue/skip options.\nprojection=${JSON.stringify(splitState.projection)}`
    );

    await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "RETURN_SKIP" },
      "return-skip"
    );

    await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
      "complete-2"
    );

    for (let i = 0; i < 32; i++) {
      const live = await getState(http.baseUrl, compiled.sessionId, `skip-drain-${i}`);
      if (live.projection.execution_status === "completed" || live.projection.execution_status === "partial") {
        break;
      }

      const nextExerciseId = live.projection.current_exercise_id;
      assert.ok(
        typeof nextExerciseId === "string" && nextExerciseId.length > 0,
        `skip-drain-${i}: expected next current_exercise_id while session is live.\nprojection=${JSON.stringify(live.projection)}`
      );

      await appendEvent(
        http.baseUrl,
        compiled.sessionId,
        { type: "COMPLETE_EXERCISE", exercise_id: nextExerciseId },
        `skip-drain-complete-${i}`
      );
    }
    const stateA = await getState(http.baseUrl, compiled.sessionId, "state-A");
    const eventsA = await getEvents(http.baseUrl, compiled.sessionId, "events-A");
    const stateB = await getState(http.baseUrl, compiled.sessionId, "state-B");
    const eventsB = await getEvents(http.baseUrl, compiled.sessionId, "events-B");
    const stateC = await getState(http.baseUrl, compiled.sessionId, "state-C");
    const eventsC = await getEvents(http.baseUrl, compiled.sessionId, "events-C");

    assert.equal(
      stateA.projection.execution_status,
      "partial",
      `state-A: expected partial terminal state.\nprojection=${JSON.stringify(stateA.projection)}`
    );
    assert.ok(
      stateA.projection.trace.dropped_ids.length >= 1,
      `state-A: expected dropped work after return skip.\nprojection=${JSON.stringify(stateA.projection)}`
    );
    assert.equal(
      stateA.projection.trace.return_decision_required,
      false,
      `state-A: return decision gate must be cleared after terminalization.\nprojection=${JSON.stringify(stateA.projection)}`
    );

    assert.deepEqual(
      stateA.projection,
      stateB.projection,
      `partial terminal state must be parity-stable across repeated reads.\nA=${JSON.stringify(stateA.projection)}\nB=${JSON.stringify(stateB.projection)}`
    );
    assert.deepEqual(
      stateB.projection,
      stateC.projection,
      `partial terminal state must remain identical across third read.\nB=${JSON.stringify(stateB.projection)}\nC=${JSON.stringify(stateC.projection)}`
    );

    assert.deepEqual(
      eventsA.projection,
      eventsB.projection,
      `partial terminal events must be parity-stable across repeated reads.\nA=${JSON.stringify(eventsA.projection)}\nB=${JSON.stringify(eventsB.projection)}`
    );
    assert.deepEqual(
      eventsB.projection,
      eventsC.projection,
      `partial terminal events must remain identical across third read.\nB=${JSON.stringify(eventsB.projection)}\nC=${JSON.stringify(eventsC.projection)}`
    );
  }
);