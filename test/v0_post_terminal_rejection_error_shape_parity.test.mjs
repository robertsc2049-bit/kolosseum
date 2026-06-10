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

function projectState(stateLike) {
  const trace = readTrace(stateLike);

  return {
    execution_status: readExecutionStatus(stateLike),
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

function normalizeErrorShape(payload) {
  return {
    status: payload?.res?.status ?? null,
    json: cloneJson(payload?.json ?? null),
    text: typeof payload?.text === "string" ? payload.text : "",
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

test(
  "test(v0): rejected post-terminal event error shape is parity-stable for completed and partial terminal sessions",
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

    // completed terminal path
    const completed = await compileWithSession(http.baseUrl, phase1, "completed-compile");
    await startSession(http.baseUrl, completed.sessionId, "completed-start");

    await appendEvent(
      http.baseUrl,
      completed.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "completed-1"
    );
    await appendEvent(
      http.baseUrl,
      completed.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
      "completed-2"
    );
    await appendEvent(
      http.baseUrl,
      completed.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
      "completed-3"
    );

    const completedState = await getState(http.baseUrl, completed.sessionId, "completed-state");
    assert.equal(
      completedState.projection.execution_status,
      "completed",
      `completed-state: expected completed terminal state.\nprojection=${JSON.stringify(completedState.projection)}`
    );

    const completedRejectA = await appendEvent(
      http.baseUrl,
      completed.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "completed-reject-A"
    );
    const completedRejectB = await appendEvent(
      http.baseUrl,
      completed.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "completed-reject-B"
    );

    assert.ok(
      completedRejectA.res.status >= 400,
      `completed-reject-A: expected rejection, got ${completedRejectA.res.status}. raw=${completedRejectA.text}`
    );
    assert.ok(
      completedRejectB.res.status >= 400,
      `completed-reject-B: expected rejection, got ${completedRejectB.res.status}. raw=${completedRejectB.text}`
    );

    assert.deepEqual(
      normalizeErrorShape(completedRejectA),
      normalizeErrorShape(completedRejectB),
      `completed terminal rejection shape must be stable across repeated illegal events.\nA=${JSON.stringify(normalizeErrorShape(completedRejectA))}\nB=${JSON.stringify(normalizeErrorShape(completedRejectB))}`
    );

    // partial terminal path
    const partial = await compileWithSession(http.baseUrl, phase1, "partial-compile");
    await startSession(http.baseUrl, partial.sessionId, "partial-start");

    await appendEvent(
      http.baseUrl,
      partial.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "partial-1"
    );
    await appendEvent(
      http.baseUrl,
      partial.sessionId,
      { type: "SPLIT_SESSION" },
      "partial-split"
    );
    await appendEvent(
      http.baseUrl,
      partial.sessionId,
      { type: "RETURN_SKIP" },
      "partial-return-skip"
    );
    await appendEvent(
      http.baseUrl,
      partial.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
      "partial-2"
    );

    const partialState = await getState(http.baseUrl, partial.sessionId, "partial-state");
    assert.equal(
      partialState.projection.execution_status,
      "partial",
      `partial-state: expected partial terminal state.\nprojection=${JSON.stringify(partialState.projection)}`
    );

    const partialRejectA = await appendEvent(
      http.baseUrl,
      partial.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
      "partial-reject-A"
    );
    const partialRejectB = await appendEvent(
      http.baseUrl,
      partial.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
      "partial-reject-B"
    );

    assert.ok(
      partialRejectA.res.status >= 400,
      `partial-reject-A: expected rejection, got ${partialRejectA.res.status}. raw=${partialRejectA.text}`
    );
    assert.ok(
      partialRejectB.res.status >= 400,
      `partial-reject-B: expected rejection, got ${partialRejectB.res.status}. raw=${partialRejectB.text}`
    );

    assert.deepEqual(
      normalizeErrorShape(partialRejectA),
      normalizeErrorShape(partialRejectB),
      `partial terminal rejection shape must be stable across repeated illegal events.\nA=${JSON.stringify(normalizeErrorShape(partialRejectA))}\nB=${JSON.stringify(normalizeErrorShape(partialRejectB))}`
    );
  }
);