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
      completed_ids: Array.isArray(trace.completed_ids) ? structuredClone(trace.completed_ids) : [],
      dropped_ids: Array.isArray(trace.dropped_ids) ? structuredClone(trace.dropped_ids) : [],
      remaining_ids: Array.isArray(trace.remaining_ids) ? structuredClone(trace.remaining_ids) : [],
      return_decision_required:
        typeof trace.return_decision_required === "boolean"
          ? trace.return_decision_required
          : false,
      return_decision_options: Array.isArray(trace.return_decision_options)
        ? structuredClone(trace.return_decision_options)
        : [],
    },
    session_execution_summary: Array.isArray(stateLike?.session_execution_summary)
      ? structuredClone(stateLike.session_execution_summary)
      : [],
    block_execution_summary: Array.isArray(stateLike?.block_execution_summary)
      ? structuredClone(stateLike.block_execution_summary)
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
  "test(v0): partial terminal state cannot be mutated or resurrected after return skip",
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

    const firstComplete = await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "complete-1"
    );
    assert.ok(
      firstComplete.res.status === 200 || firstComplete.res.status === 201,
      `complete-1: expected success, got ${firstComplete.res.status}. raw=${firstComplete.text}`
    );

    const split = await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "SPLIT_SESSION" },
      "split"
    );
    assert.ok(
      split.res.status === 200 || split.res.status === 201,
      `split: expected success, got ${split.res.status}. raw=${split.text}`
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

    const returnSkip = await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "RETURN_SKIP" },
      "return-skip"
    );
    assert.ok(
      returnSkip.res.status === 200 || returnSkip.res.status === 201,
      `return-skip: expected success, got ${returnSkip.res.status}. raw=${returnSkip.text}`
    );

    const finalComplete = await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
      "complete-2"
    );
    assert.ok(
      finalComplete.res.status === 200 || finalComplete.res.status === 201,
      `complete-2: expected success, got ${finalComplete.res.status}. raw=${finalComplete.text}`
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
    const terminalBefore = await getState(http.baseUrl, compiled.sessionId, "terminal-before");
    assert.equal(
      terminalBefore.projection.execution_status,
      "partial",
      `terminal-before: expected partial terminal state.\nprojection=${JSON.stringify(terminalBefore.projection)}`
    );
    assert.ok(
      terminalBefore.projection.trace.dropped_ids.length >= 1,
      `terminal-before: expected dropped work after return skip.\nprojection=${JSON.stringify(terminalBefore.projection)}`
    );
    assert.equal(
      terminalBefore.projection.trace.return_decision_required,
      false,
      `terminal-before: return decision gate must be cleared.\nprojection=${JSON.stringify(terminalBefore.projection)}`
    );

    const illegalMutation = await appendEvent(
      http.baseUrl,
      compiled.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
      "illegal-after-partial-terminal"
    );
    assert.ok(
      illegalMutation.res.status >= 400,
      `illegal-after-partial-terminal: expected rejection after terminal partial state, got ${illegalMutation.res.status}. raw=${illegalMutation.text}`
    );

    const terminalAfter = await getState(http.baseUrl, compiled.sessionId, "terminal-after");

    assert.deepEqual(
      terminalBefore.projection,
      terminalAfter.projection,
      `terminal partial state must remain unchanged after illegal mutation attempt.\nBEFORE=${JSON.stringify(terminalBefore.projection)}\nAFTER=${JSON.stringify(terminalAfter.projection)}`
    );
  }
);