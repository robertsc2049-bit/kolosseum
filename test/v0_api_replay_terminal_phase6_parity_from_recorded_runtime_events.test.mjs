/* test/v0_api_replay_terminal_phase6_parity_from_recorded_runtime_events.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  bootHttpVerticalSlice,
  readJsonOnce,
} from "../test_support/http_e2e_harness.mjs";

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

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

async function loadSessionStateCache(root, seed) {
  const cacheModuleUrl =
    pathToFileURL(path.join(root, "dist", "src", "api", "session_state_cache.js")).href +
    `?seed=${seed}`;

  const imported = await import(cacheModuleUrl);

  assert.ok(
    imported.sessionStateCache && typeof imported.sessionStateCache.clear === "function",
    "expected dist sessionStateCache.clear()"
  );

  return imported.sessionStateCache;
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
  return stateLike?.current_step?.exercise?.exercise_id ?? null;
}

function isTerminalStateLike(stateLike) {
  const trace = readTrace(stateLike);
  const remainingIds = Array.isArray(trace.remaining_ids) ? trace.remaining_ids : [];
  return remainingIds.length === 0 && readCurrentExerciseId(stateLike) === null;
}

function projectStateLike(stateLike) {
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

function extractReplayStateEnvelope(replayPayload, label) {
  assert.ok(
    replayPayload.json && typeof replayPayload.json === "object",
    `${label}: expected JSON object from replay compile. raw=${replayPayload.text}`
  );

  const candidates = [
    replayPayload.json.runtime_state,
    replayPayload.json.state,
    replayPayload.json.session_state,
    replayPayload.json.runtime?.state,
    replayPayload.json.runtime,
  ].filter(Boolean);

  assert.ok(
    candidates.length >= 1,
    `${label}: could not find replay state envelope in compile response.\nraw=${replayPayload.text}`
  );

  const stateLike = candidates[0];
  assert.ok(
    stateLike && typeof stateLike === "object",
    `${label}: replay state candidate must be object.\nraw=${replayPayload.text}`
  );

  return stateLike;
}

async function captureStableTerminalRead(baseUrl, sessionId, label) {
  const state1 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  const events1 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  const state2 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  const events2 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  const state3 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);

  assert.equal(state1.res.status, 200, `${label}: state1 expected 200, got ${state1.res.status}. raw=${state1.text}`);
  assert.equal(state2.res.status, 200, `${label}: state2 expected 200, got ${state2.res.status}. raw=${state2.text}`);
  assert.equal(state3.res.status, 200, `${label}: state3 expected 200, got ${state3.res.status}. raw=${state3.text}`);
  assert.equal(events1.res.status, 200, `${label}: events1 expected 200, got ${events1.res.status}. raw=${events1.text}`);
  assert.equal(events2.res.status, 200, `${label}: events2 expected 200, got ${events2.res.status}. raw=${events2.text}`);

  assert.deepEqual(state2.json, state1.json, `${label}: state2 drifted from state1`);
  assert.deepEqual(state3.json, state1.json, `${label}: state3 drifted from state1`);
  assert.deepEqual(events2.json, events1.json, `${label}: events2 drifted from events1`);

  return { state: state1, events: events1 };
}

async function startCompiledSession(baseUrl, phase1) {
  const compile = await httpJson(
    "POST",
    `${baseUrl}/blocks/compile?create_session=true`,
    { phase1_input: phase1 }
  );

  assert.equal(
    compile.res.status,
    201,
    `compile expected 201, got ${compile.res.status}. raw=${compile.text}`
  );
  assert.ok(
    typeof compile.json?.session_id === "string" && compile.json.session_id.length > 0,
    `compile missing session_id. raw=${compile.text}`
  );

  const sessionId = compile.json.session_id;

  const start = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});
  assert.ok(
    start.res.status === 200 || start.res.status === 201,
    `start expected 200/201, got ${start.res.status}. raw=${start.text}`
  );

  return sessionId;
}

async function advanceTerminalPath(baseUrl, sessionId, decisionType) {
  const state0 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(state0.res.status, 200, `initial state expected 200. raw=${state0.text}`);

  const firstExerciseId = readCurrentExerciseId(state0.json);
  assert.ok(
    typeof firstExerciseId === "string" && firstExerciseId.length > 0,
    `expected first exercise id.\nstate=${state0.text}`
  );

  const completeFirst = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "COMPLETE_EXERCISE", exercise_id: firstExerciseId } }
  );
  assert.equal(
    completeFirst.res.status,
    201,
    `first COMPLETE_EXERCISE expected 201, got ${completeFirst.res.status}. raw=${completeFirst.text}`
  );

  const afterFirst = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(afterFirst.res.status, 200, `state after first complete expected 200. raw=${afterFirst.text}`);

  const gatedExerciseId = readCurrentExerciseId(afterFirst.json);
  assert.ok(
    typeof gatedExerciseId === "string" && gatedExerciseId.length > 0,
    `expected gated exercise id.\nstate=${afterFirst.text}`
  );

  const split = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "SPLIT_SESSION" } }
  );
  assert.equal(
    split.res.status,
    201,
    `SPLIT_SESSION expected 201, got ${split.res.status}. raw=${split.text}`
  );

  const splitState = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(splitState.res.status, 200, `split state expected 200. raw=${splitState.text}`);
  assert.equal(
    readTrace(splitState.json).return_decision_required,
    true,
    `expected return gate at split.\nstate=${splitState.text}`
  );

  const decision = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event: { type: decisionType } }
  );
  assert.equal(
    decision.res.status,
    201,
    `${decisionType} expected 201, got ${decision.res.status}. raw=${decision.text}`
  );

  let state = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(state.res.status, 200, `post-decision state expected 200. raw=${state.text}`);

  for (let i = 0; i < 20; i += 1) {
    if (isTerminalStateLike(state.json)) {
      return { terminalState: state, gatedExerciseId };
    }

    const nextExerciseId = readCurrentExerciseId(state.json);
    assert.ok(
      typeof nextExerciseId === "string" && nextExerciseId.length > 0,
      `expected current exercise before loop completion ${i}.\nstate=${state.text}`
    );

    const complete = await httpJson(
      "POST",
      `${baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: nextExerciseId } }
    );
    assert.equal(
      complete.res.status,
      201,
      `loop COMPLETE_EXERCISE expected 201, got ${complete.res.status}. raw=${complete.text}`
    );

    state = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
    assert.equal(state.res.status, 200, `loop state expected 200. raw=${state.text}`);
  }

  assert.fail(`session ${sessionId} did not reach terminal state within 20 completions`);
}

async function replayFromRecordedEvents(baseUrl, phase1, runtimeEvents, label) {
  const replay = await httpJson(
    "POST",
    `${baseUrl}/blocks/compile`,
    {
      phase1_input: phase1,
      runtime_events: runtimeEvents,
    }
  );

  assert.ok(
    replay.res.status === 200 || replay.res.status === 201,
    `${label}: replay compile expected 200/201, got ${replay.res.status}. raw=${replay.text}`
  );

  return extractReplayStateEnvelope(replay, label);
}

test(
  "test(v0): prove API replay reconstructs terminal Phase 6 truth from recorded runtime events for continue and skip paths",
  async (t) => {
    const root = process.cwd();
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

    const cacheA = await loadSessionStateCache(root, `a-${Date.now()}`);
    cacheA.clear();

    const helloPath = path.join(root, "examples", "hello_world.json");
    const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

    // CONTINUE PATH
    const continueSessionId = await startCompiledSession(http.baseUrl, phase1);
    const continuePath = await advanceTerminalPath(
      http.baseUrl,
      continueSessionId,
      "RETURN_CONTINUE"
    );

    assert.equal(
      isTerminalStateLike(continuePath.terminalState.json),
      true,
      `continue path expected terminal live state.\nstate=${continuePath.terminalState.text}`
    );
    assertNoLegacyGateLeak(continuePath.terminalState.json, "continue live terminal");

    const continueStable = await captureStableTerminalRead(
      http.baseUrl,
      continueSessionId,
      "continue stable read"
    );
    const continueRuntimeEvents = continueStable.events.json.events.map((x) => x.event);

    assert.deepEqual(
      continueStable.events.json.events.map((x) => x.seq),
      Array.from({ length: continueStable.events.json.events.length }, (_, i) => i + 1),
      `continue path expected contiguous seq values.\nevents=${JSON.stringify(continueStable.events.json.events)}`
    );
    assert.deepEqual(
      continueRuntimeEvents.slice(0, 4).map((x) => x?.type),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
      `continue path event prefix drifted.\nevents=${JSON.stringify(continueStable.events.json.events)}`
    );

    const continueReplayState = await replayFromRecordedEvents(
      http.baseUrl,
      phase1,
      continueRuntimeEvents,
      "continue replay"
    );

    assertNoLegacyGateLeak(continueReplayState, "continue replay state");

    assert.deepEqual(
      projectStateLike(continueReplayState),
      projectStateLike(continueStable.state.json),
      `continue replay projection drifted from live terminal state.\nreplay=${JSON.stringify(projectStateLike(continueReplayState))}\nlive=${JSON.stringify(projectStateLike(continueStable.state.json))}`
    );

    assert.equal(
      readTrace(continueReplayState).dropped_ids?.length ?? 0,
      0,
      `continue replay must preserve no-drop truth.\nstate=${JSON.stringify(continueReplayState)}`
    );
    assert.equal(
      readTrace(continueReplayState).completed_ids?.includes(continuePath.gatedExerciseId) ?? false,
      true,
      `continue replay must preserve gated exercise as completed.\nstate=${JSON.stringify(continueReplayState)}`
    );

    // SKIP PATH
    const skipSessionId = await startCompiledSession(http.baseUrl, phase1);
    const skipPath = await advanceTerminalPath(
      http.baseUrl,
      skipSessionId,
      "RETURN_SKIP"
    );

    assert.equal(
      isTerminalStateLike(skipPath.terminalState.json),
      true,
      `skip path expected terminal live state.\nstate=${skipPath.terminalState.text}`
    );
    assertNoLegacyGateLeak(skipPath.terminalState.json, "skip live terminal");

    const skipStable = await captureStableTerminalRead(
      http.baseUrl,
      skipSessionId,
      "skip stable read"
    );
    const skipRuntimeEvents = skipStable.events.json.events.map((x) => x.event);

    assert.deepEqual(
      skipStable.events.json.events.map((x) => x.seq),
      Array.from({ length: skipStable.events.json.events.length }, (_, i) => i + 1),
      `skip path expected contiguous seq values.\nevents=${JSON.stringify(skipStable.events.json.events)}`
    );
    assert.deepEqual(
      skipRuntimeEvents.slice(0, 4).map((x) => x?.type),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
      `skip path event prefix drifted.\nevents=${JSON.stringify(skipStable.events.json.events)}`
    );

    const skipReplayState = await replayFromRecordedEvents(
      http.baseUrl,
      phase1,
      skipRuntimeEvents,
      "skip replay"
    );

    assertNoLegacyGateLeak(skipReplayState, "skip replay state");

    assert.deepEqual(
      projectStateLike(skipReplayState),
      projectStateLike(skipStable.state.json),
      `skip replay projection drifted from live terminal state.\nreplay=${JSON.stringify(projectStateLike(skipReplayState))}\nlive=${JSON.stringify(projectStateLike(skipStable.state.json))}`
    );

    assert.equal(
      readTrace(skipReplayState).dropped_ids?.includes(skipPath.gatedExerciseId) ?? false,
      true,
      `skip replay must preserve gated exercise as dropped.\nstate=${JSON.stringify(skipReplayState)}`
    );
    assert.equal(
      readTrace(skipReplayState).completed_ids?.includes(skipPath.gatedExerciseId) ?? false,
      false,
      `skip replay must preserve gated exercise as not completed.\nstate=${JSON.stringify(skipReplayState)}`
    );

    // Fresh-process parity after cache clear
    const cacheB = await loadSessionStateCache(root, `b-${Date.now()}`);
    cacheB.clear();

    const continueAfterClear = await httpJson("GET", `${http.baseUrl}/sessions/${continueSessionId}/state`);
    const skipAfterClear = await httpJson("GET", `${http.baseUrl}/sessions/${skipSessionId}/state`);

    assert.equal(continueAfterClear.res.status, 200, `continue after clear expected 200. raw=${continueAfterClear.text}`);
    assert.equal(skipAfterClear.res.status, 200, `skip after clear expected 200. raw=${skipAfterClear.text}`);

    assert.deepEqual(
      projectStateLike(continueAfterClear.json),
      projectStateLike(continueStable.state.json),
      `continue live terminal state drifted after cache clear.\nafterClear=${JSON.stringify(projectStateLike(continueAfterClear.json))}\nbefore=${JSON.stringify(projectStateLike(continueStable.state.json))}`
    );
    assert.deepEqual(
      projectStateLike(skipAfterClear.json),
      projectStateLike(skipStable.state.json),
      `skip live terminal state drifted after cache clear.\nafterClear=${JSON.stringify(projectStateLike(skipAfterClear.json))}\nbefore=${JSON.stringify(projectStateLike(skipStable.state.json))}`
    );
  }
);