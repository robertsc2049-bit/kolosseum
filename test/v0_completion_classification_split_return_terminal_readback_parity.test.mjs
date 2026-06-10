/* test/v0_completion_classification_split_return_terminal_readback_parity.test.mjs */
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

function assertStablePayload(actual, expected, label) {
  assert.equal(
    actual.text,
    expected.text,
    `${label}: raw payload drifted.` +
      `\nbefore=${expected.text}` +
      `\nafter=${actual.text}`
  );
  assert.deepEqual(
    actual.json,
    expected.json,
    `${label}: JSON payload drifted.` +
      `\nbefore=${JSON.stringify(expected.json)}` +
      `\nafter=${JSON.stringify(actual.json)}`
  );
}

function assertNoLegacyGateLeak(trace, label) {
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

function readExecutionStatus(statePayload) {
  const state = statePayload?.json ?? {};
  return (
    state.execution_status ??
    state.executionState?.execution_status ??
    state.execution?.status ??
    state.status ??
    null
  );
}

function readCurrentExerciseId(statePayload) {
  return statePayload?.json?.current_step?.exercise?.exercise_id ?? null;
}

function readTrace(statePayload) {
  return statePayload?.json?.trace ?? {};
}

function isTerminal(statePayload) {
  const trace = readTrace(statePayload);
  const remainingIds = Array.isArray(trace.remaining_ids) ? trace.remaining_ids : [];
  return remainingIds.length === 0 && readCurrentExerciseId(statePayload) === null;
}

async function captureMixedReadCycle(baseUrl, sessionId) {
  const state1 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  const events1 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  const state2 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  const events2 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  const state3 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  return { state1, events1, state2, events2, state3 };
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

async function completeUntilTerminal(baseUrl, sessionId, limit = 20) {
  const completedIds = [];
  let state = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  assert.equal(state.res.status, 200, `initial state read failed. raw=${state.text}`);

  for (let i = 0; i < limit; i += 1) {
    if (isTerminal(state)) {
      return { state, completedIds };
    }

    const nextExerciseId = readCurrentExerciseId(state);
    assert.ok(
      typeof nextExerciseId === "string" && nextExerciseId.length > 0,
      `expected current exercise before completion loop iteration ${i}.\nstate=${state.text}`
    );

    const complete = await httpJson(
      "POST",
      `${baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: nextExerciseId } }
    );
    assert.equal(
      complete.res.status,
      201,
      `COMPLETE_EXERCISE expected 201, got ${complete.res.status}. raw=${complete.text}`
    );

    completedIds.push(nextExerciseId);
    state = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
    assert.equal(state.res.status, 200, `loop state read failed. raw=${state.text}`);
  }

  assert.fail(`session did not reach terminal state within ${limit} completions`);
}

test(
  "test(v0): prove split return decisions preserve deterministic completion classification and byte-stable terminal readback",
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

    const continueInitial = await httpJson("GET", `${http.baseUrl}/sessions/${continueSessionId}/state`);
    const continueFirstExerciseId = readCurrentExerciseId(continueInitial);
    assert.ok(
      typeof continueFirstExerciseId === "string" && continueFirstExerciseId.length > 0,
      `continue path missing first exercise.\nstate=${continueInitial.text}`
    );

    const continueCompleteFirst = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${continueSessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: continueFirstExerciseId } }
    );
    assert.equal(
      continueCompleteFirst.res.status,
      201,
      `continue path first COMPLETE_EXERCISE expected 201, got ${continueCompleteFirst.res.status}. raw=${continueCompleteFirst.text}`
    );

    const continueAfterFirst = await httpJson("GET", `${http.baseUrl}/sessions/${continueSessionId}/state`);
    const continueGatedExerciseId = readCurrentExerciseId(continueAfterFirst);
    assert.ok(
      typeof continueGatedExerciseId === "string" && continueGatedExerciseId.length > 0,
      `continue path missing gated exercise.\nstate=${continueAfterFirst.text}`
    );

    const continueSplit = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${continueSessionId}/events`,
      { event: { type: "SPLIT_SESSION" } }
    );
    assert.equal(
      continueSplit.res.status,
      201,
      `continue path SPLIT_SESSION expected 201, got ${continueSplit.res.status}. raw=${continueSplit.text}`
    );

    const continueDecision = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${continueSessionId}/events`,
      { event: { type: "RETURN_CONTINUE" } }
    );
    assert.equal(
      continueDecision.res.status,
      201,
      `continue path RETURN_CONTINUE expected 201, got ${continueDecision.res.status}. raw=${continueDecision.text}`
    );

    const continuePreTerminalStatus = readExecutionStatus(
      await httpJson("GET", `${http.baseUrl}/sessions/${continueSessionId}/state`)
    );

    const continueTerminal = await completeUntilTerminal(http.baseUrl, continueSessionId);
    const continueTerminalState = continueTerminal.state;
    const continueTrace = readTrace(continueTerminalState);
    const continueCompletedIds = Array.isArray(continueTrace.completed_ids) ? continueTrace.completed_ids : [];
    const continueDroppedIds = Array.isArray(continueTrace.dropped_ids) ? continueTrace.dropped_ids : [];

    assert.equal(
      isTerminal(continueTerminalState),
      true,
      `continue path expected terminal state.\nstate=${continueTerminalState.text}`
    );
    assertNoLegacyGateLeak(continueTrace, "continue terminal trace");
    assert.deepEqual(
      continueDroppedIds,
      [],
      `continue path must not drop work.\ntrace=${JSON.stringify(continueTrace)}`
    );
    assert.equal(
      continueCompletedIds.includes(continueGatedExerciseId),
      true,
      `continue path must include gated exercise in completed ids.\ntrace=${JSON.stringify(continueTrace)}`
    );

    const continueTerminalStatus = readExecutionStatus(continueTerminalState);
    assert.ok(
      continueTerminalStatus !== null,
      `continue path terminal execution status must exist.\nstate=${continueTerminalState.text}`
    );
    assert.notEqual(
      continueTerminalStatus,
      "terminated",
      `continue path terminal state must not classify as terminated.\nstate=${continueTerminalState.text}`
    );

    // SKIP PATH
    const skipSessionId = await startCompiledSession(http.baseUrl, phase1);

    const skipInitial = await httpJson("GET", `${http.baseUrl}/sessions/${skipSessionId}/state`);
    const skipFirstExerciseId = readCurrentExerciseId(skipInitial);
    assert.ok(
      typeof skipFirstExerciseId === "string" && skipFirstExerciseId.length > 0,
      `skip path missing first exercise.\nstate=${skipInitial.text}`
    );

    const skipCompleteFirst = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${skipSessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: skipFirstExerciseId } }
    );
    assert.equal(
      skipCompleteFirst.res.status,
      201,
      `skip path first COMPLETE_EXERCISE expected 201, got ${skipCompleteFirst.res.status}. raw=${skipCompleteFirst.text}`
    );

    const skipAfterFirst = await httpJson("GET", `${http.baseUrl}/sessions/${skipSessionId}/state`);
    const skipGatedExerciseId = readCurrentExerciseId(skipAfterFirst);
    assert.ok(
      typeof skipGatedExerciseId === "string" && skipGatedExerciseId.length > 0,
      `skip path missing gated exercise.\nstate=${skipAfterFirst.text}`
    );

    const skipSplit = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${skipSessionId}/events`,
      { event: { type: "SPLIT_SESSION" } }
    );
    assert.equal(
      skipSplit.res.status,
      201,
      `skip path SPLIT_SESSION expected 201, got ${skipSplit.res.status}. raw=${skipSplit.text}`
    );

    const skipDecision = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${skipSessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );
    assert.equal(
      skipDecision.res.status,
      201,
      `skip path RETURN_SKIP expected 201, got ${skipDecision.res.status}. raw=${skipDecision.text}`
    );

    const skipPreTerminalStatus = readExecutionStatus(
      await httpJson("GET", `${http.baseUrl}/sessions/${skipSessionId}/state`)
    );

    const skipTerminal = await completeUntilTerminal(http.baseUrl, skipSessionId);
    const skipTerminalState = skipTerminal.state;
    const skipTrace = readTrace(skipTerminalState);
    const skipCompletedIds = Array.isArray(skipTrace.completed_ids) ? skipTrace.completed_ids : [];
    const skipDroppedIds = Array.isArray(skipTrace.dropped_ids) ? skipTrace.dropped_ids : [];

    assert.equal(
      isTerminal(skipTerminalState),
      true,
      `skip path expected terminal state.\nstate=${skipTerminalState.text}`
    );
    assertNoLegacyGateLeak(skipTrace, "skip terminal trace");
    assert.equal(
      skipDroppedIds.includes(skipGatedExerciseId),
      true,
      `skip path must include gated exercise in dropped ids.\ntrace=${JSON.stringify(skipTrace)}`
    );
    assert.equal(
      skipCompletedIds.includes(skipGatedExerciseId),
      false,
      `skip path must not include gated exercise in completed ids.\ntrace=${JSON.stringify(skipTrace)}`
    );

    const skipTerminalStatus = readExecutionStatus(skipTerminalState);
    assert.ok(
      skipTerminalStatus !== null,
      `skip path terminal execution status must exist.\nstate=${skipTerminalState.text}`
    );
    assert.notEqual(
      skipTerminalStatus,
      "terminated",
      `skip path terminal state must not classify as terminated.\nstate=${skipTerminalState.text}`
    );

    // Cross-path classification checks
    assert.ok(
      continueTerminalStatus === "completed" || continueTerminalStatus === "partial",
      `continue path terminal status must be completed or partial.\nstate=${continueTerminalState.text}`
    );
    assert.ok(
      skipTerminalStatus === "completed" || skipTerminalStatus === "partial",
      `skip path terminal status must be completed or partial.\nstate=${skipTerminalState.text}`
    );

    assert.equal(
      continueTerminalStatus,
      "completed",
      `continue path should classify terminal all-work-done flow as completed.\nstate=${continueTerminalState.text}`
    );
    assert.equal(
      skipTerminalStatus,
      "partial",
      `skip path should classify terminal skipped-work flow as partial.\nstate=${skipTerminalState.text}`
    );

    if (continuePreTerminalStatus !== null) {
      assert.notEqual(
        continuePreTerminalStatus,
        "terminated",
        `continue pre-terminal status must not be terminated after lawful return decision.`
      );
    }

    if (skipPreTerminalStatus !== null) {
      assert.notEqual(
        skipPreTerminalStatus,
        "terminated",
        `skip pre-terminal status must not be terminated after lawful return decision.`
      );
    }

    // Terminal mixed-read parity: continue
    const continueWarmCycle = await captureMixedReadCycle(http.baseUrl, continueSessionId);
    assertStablePayload(
      continueWarmCycle.state2,
      continueWarmCycle.state1,
      "continue warm cycle state2 vs state1"
    );
    assertStablePayload(
      continueWarmCycle.state3,
      continueWarmCycle.state1,
      "continue warm cycle state3 vs state1"
    );
    assertStablePayload(
      continueWarmCycle.events2,
      continueWarmCycle.events1,
      "continue warm cycle events2 vs events1"
    );
    assertStablePayload(
      continueWarmCycle.state1,
      continueTerminalState,
      "continue warm cycle state1 vs terminal snapshot"
    );

    const continueWarmEventTypes = continueWarmCycle.events1.json.events.map((x) => x.event?.type);
    assert.deepEqual(
      continueWarmEventTypes.slice(0, 4),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
      `continue path event prefix drifted.\nevents=${JSON.stringify(continueWarmCycle.events1.json.events)}`
    );

    const continueWarmStateSnapshot = cloneJson(continueWarmCycle.state1);
    const continueWarmEventsSnapshot = cloneJson(continueWarmCycle.events1);

    // Terminal mixed-read parity: skip
    const skipWarmCycle = await captureMixedReadCycle(http.baseUrl, skipSessionId);
    assertStablePayload(
      skipWarmCycle.state2,
      skipWarmCycle.state1,
      "skip warm cycle state2 vs state1"
    );
    assertStablePayload(
      skipWarmCycle.state3,
      skipWarmCycle.state1,
      "skip warm cycle state3 vs state1"
    );
    assertStablePayload(
      skipWarmCycle.events2,
      skipWarmCycle.events1,
      "skip warm cycle events2 vs events1"
    );
    assertStablePayload(
      skipWarmCycle.state1,
      skipTerminalState,
      "skip warm cycle state1 vs terminal snapshot"
    );

    const skipWarmEventTypes = skipWarmCycle.events1.json.events.map((x) => x.event?.type);
    assert.deepEqual(
      skipWarmEventTypes.slice(0, 4),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
      `skip path event prefix drifted.\nevents=${JSON.stringify(skipWarmCycle.events1.json.events)}`
    );

    const skipWarmStateSnapshot = cloneJson(skipWarmCycle.state1);
    const skipWarmEventsSnapshot = cloneJson(skipWarmCycle.events1);

    // Cold cache parity for both paths
    const cacheB = await loadSessionStateCache(root, `b-${Date.now()}`);
    cacheB.clear();

    const continueColdCycle = await captureMixedReadCycle(http.baseUrl, continueSessionId);
    assertStablePayload(
      continueColdCycle.state1,
      continueWarmStateSnapshot,
      "continue cold state1 vs warm snapshot"
    );
    assertStablePayload(
      continueColdCycle.events1,
      continueWarmEventsSnapshot,
      "continue cold events1 vs warm snapshot"
    );

    const skipColdCycle = await captureMixedReadCycle(http.baseUrl, skipSessionId);
    assertStablePayload(
      skipColdCycle.state1,
      skipWarmStateSnapshot,
      "skip cold state1 vs warm snapshot"
    );
    assertStablePayload(
      skipColdCycle.events1,
      skipWarmEventsSnapshot,
      "skip cold events1 vs warm snapshot"
    );
  }
);