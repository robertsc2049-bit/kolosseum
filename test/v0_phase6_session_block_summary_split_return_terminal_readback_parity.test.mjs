/* test/v0_phase6_session_block_summary_split_return_terminal_readback_parity.test.mjs */
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

function readTrace(statePayload) {
  return statePayload?.json?.trace ?? {};
}

function readCurrentExerciseId(statePayload) {
  return statePayload?.json?.current_step?.exercise?.exercise_id ?? null;
}

function isTerminal(statePayload) {
  const trace = readTrace(statePayload);
  const remainingIds = Array.isArray(trace.remaining_ids) ? trace.remaining_ids : [];
  return remainingIds.length === 0 && readCurrentExerciseId(statePayload) === null;
}

function requireSessionSummary(statePayload, label) {
  const value = statePayload?.json?.session_execution_summary;
  assert.ok(
    Array.isArray(value) && value.length >= 1,
    `${label}: expected non-empty session_execution_summary.\nstate=${statePayload?.text}`
  );
  return value;
}

function requireBlockSummary(statePayload, label) {
  const value = statePayload?.json?.block_execution_summary;
  assert.ok(
    Array.isArray(value) && value.length >= 1,
    `${label}: expected non-empty block_execution_summary.\nstate=${statePayload?.text}`
  );
  return value;
}

function assertSingleSessionSummaryAligned(
  statePayload,
  expectedDecision,
  expectedWorkItemsDone,
  expectedWorkItemsTotal,
  label
) {
  const trace = readTrace(statePayload);
  assertNoLegacyGateLeak(trace, label);

  const sessionSummary = requireSessionSummary(statePayload, label);
  assert.equal(
    sessionSummary.length,
    1,
    `${label}: expected exactly one session summary entry.\nsummary=${JSON.stringify(sessionSummary)}`
  );

  const s = sessionSummary[0];

  assert.equal(
    s.session_ended,
    true,
    `${label}: session_ended must be true.\nsummary=${JSON.stringify(s)}`
  );
  assert.equal(
    s.work_items_done,
    expectedWorkItemsDone,
    `${label}: work_items_done drifted.\nsummary=${JSON.stringify(s)}`
  );
  assert.equal(
    s.work_items_total,
    expectedWorkItemsTotal,
    `${label}: work_items_total drifted.\nsummary=${JSON.stringify(s)}`
  );
  assert.equal(
    s.split_entered,
    true,
    `${label}: split_entered must be true.\nsummary=${JSON.stringify(s)}`
  );
  assert.equal(
    s.split_return_decision,
    expectedDecision,
    `${label}: split_return_decision drifted.\nsummary=${JSON.stringify(s)}`
  );

  const completedIds = Array.isArray(trace.completed_ids) ? trace.completed_ids : [];
  assert.equal(
    s.work_items_done,
    completedIds.length,
    `${label}: session summary work_items_done must align with trace.completed_ids length.\nsummary=${JSON.stringify(s)}\ntrace=${JSON.stringify(trace)}`
  );
}

function assertSingleBlockSummaryAligned(
  statePayload,
  expectedWorkItemsDone,
  expectedWorkItemsTotal,
  label
) {
  const blockSummary = requireBlockSummary(statePayload, label);
  assert.equal(
    blockSummary.length,
    1,
    `${label}: expected exactly one block summary entry.\nsummary=${JSON.stringify(blockSummary)}`
  );

  const b = blockSummary[0];

  assert.equal(
    b.sessions_total,
    1,
    `${label}: sessions_total must be 1.\nsummary=${JSON.stringify(b)}`
  );
  assert.equal(
    b.sessions_ended,
    1,
    `${label}: sessions_ended must be 1.\nsummary=${JSON.stringify(b)}`
  );
  assert.equal(
    b.work_items_done,
    expectedWorkItemsDone,
    `${label}: block work_items_done drifted.\nsummary=${JSON.stringify(b)}`
  );
  assert.equal(
    b.work_items_total,
    expectedWorkItemsTotal,
    `${label}: block work_items_total drifted.\nsummary=${JSON.stringify(b)}`
  );
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
  "test(v0): prove Phase 6 session and block execution summaries stay aligned with split return terminal truth and mixed-read restart parity",
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
    assert.equal(continueCompleteFirst.res.status, 201);

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
    assert.equal(continueSplit.res.status, 201);

    const continueDecision = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${continueSessionId}/events`,
      { event: { type: "RETURN_CONTINUE" } }
    );
    assert.equal(continueDecision.res.status, 201);

    const continueTerminal = await completeUntilTerminal(http.baseUrl, continueSessionId);
    const continueTerminalState = continueTerminal.state;
    const continueTrace = readTrace(continueTerminalState);
    const continueCompletedIds = Array.isArray(continueTrace.completed_ids) ? continueTrace.completed_ids : [];
    const continueDroppedIds = Array.isArray(continueTrace.dropped_ids) ? continueTrace.dropped_ids : [];
    const continueRemainingIds = Array.isArray(continueTrace.remaining_ids) ? continueTrace.remaining_ids : [];

    assert.equal(isTerminal(continueTerminalState), true);
    assert.equal(continueDroppedIds.length, 0);
    assert.equal(continueCompletedIds.includes(continueGatedExerciseId), true);

    const continueWorkItemsTotal = continueCompletedIds.length + continueDroppedIds.length + continueRemainingIds.length;
    assert.ok(
      continueWorkItemsTotal >= continueCompletedIds.length,
      `continue path invalid work_items_total derivation.\ntrace=${JSON.stringify(continueTrace)}`
    );

    assertSingleSessionSummaryAligned(
      continueTerminalState,
      "continue",
      continueCompletedIds.length,
      continueWorkItemsTotal,
      "continue terminal state"
    );
    assertSingleBlockSummaryAligned(
      continueTerminalState,
      continueCompletedIds.length,
      continueWorkItemsTotal,
      "continue terminal state"
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
    assert.equal(skipCompleteFirst.res.status, 201);

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
    assert.equal(skipSplit.res.status, 201);

    const skipDecision = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${skipSessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );
    assert.equal(skipDecision.res.status, 201);

    const skipTerminal = await completeUntilTerminal(http.baseUrl, skipSessionId);
    const skipTerminalState = skipTerminal.state;
    const skipTrace = readTrace(skipTerminalState);
    const skipCompletedIds = Array.isArray(skipTrace.completed_ids) ? skipTrace.completed_ids : [];
    const skipDroppedIds = Array.isArray(skipTrace.dropped_ids) ? skipTrace.dropped_ids : [];
    const skipRemainingIds = Array.isArray(skipTrace.remaining_ids) ? skipTrace.remaining_ids : [];

    assert.equal(isTerminal(skipTerminalState), true);
    assert.equal(skipDroppedIds.includes(skipGatedExerciseId), true);
    assert.equal(skipCompletedIds.includes(skipGatedExerciseId), false);

    const skipWorkItemsTotal = skipCompletedIds.length + skipDroppedIds.length + skipRemainingIds.length;
    assert.ok(
      skipWorkItemsTotal >= skipCompletedIds.length + skipDroppedIds.length,
      `skip path invalid work_items_total derivation.\ntrace=${JSON.stringify(skipTrace)}`
    );

    assertSingleSessionSummaryAligned(
      skipTerminalState,
      "skip",
      skipCompletedIds.length,
      skipWorkItemsTotal,
      "skip terminal state"
    );
    assertSingleBlockSummaryAligned(
      skipTerminalState,
      skipCompletedIds.length,
      skipWorkItemsTotal,
      "skip terminal state"
    );

    // Cross-path truth checks
    assert.equal(
      continueWorkItemsTotal,
      skipWorkItemsTotal,
      `expected same underlying hello_world session structure across both paths.\ncontinueTrace=${JSON.stringify(continueTrace)}\nskipTrace=${JSON.stringify(skipTrace)}`
    );

    assert.equal(
      continueCompletedIds.length,
      skipCompletedIds.length + 1,
      `continue path should complete exactly one more work item than skip path (the gated item).\ncontinueTrace=${JSON.stringify(continueTrace)}\nskipTrace=${JSON.stringify(skipTrace)}`
    );

    assert.equal(
      skipDroppedIds.length,
      1,
      `skip path should drop exactly one gated work item.\ntrace=${JSON.stringify(skipTrace)}`
    );

    // Warm mixed-read parity
    const continueWarmCycle = await captureMixedReadCycle(http.baseUrl, continueSessionId);
    assertStablePayload(continueWarmCycle.state2, continueWarmCycle.state1, "continue warm state2 vs state1");
    assertStablePayload(continueWarmCycle.state3, continueWarmCycle.state1, "continue warm state3 vs state1");
    assertStablePayload(continueWarmCycle.events2, continueWarmCycle.events1, "continue warm events2 vs events1");
    assertStablePayload(continueWarmCycle.state1, continueTerminalState, "continue warm state1 vs terminal snapshot");
    assertSingleSessionSummaryAligned(
      continueWarmCycle.state1,
      "continue",
      continueCompletedIds.length,
      continueWorkItemsTotal,
      "continue warm state1"
    );
    assertSingleBlockSummaryAligned(
      continueWarmCycle.state1,
      continueCompletedIds.length,
      continueWorkItemsTotal,
      "continue warm state1"
    );

    const skipWarmCycle = await captureMixedReadCycle(http.baseUrl, skipSessionId);
    assertStablePayload(skipWarmCycle.state2, skipWarmCycle.state1, "skip warm state2 vs state1");
    assertStablePayload(skipWarmCycle.state3, skipWarmCycle.state1, "skip warm state3 vs state1");
    assertStablePayload(skipWarmCycle.events2, skipWarmCycle.events1, "skip warm events2 vs events1");
    assertStablePayload(skipWarmCycle.state1, skipTerminalState, "skip warm state1 vs terminal snapshot");
    assertSingleSessionSummaryAligned(
      skipWarmCycle.state1,
      "skip",
      skipCompletedIds.length,
      skipWorkItemsTotal,
      "skip warm state1"
    );
    assertSingleBlockSummaryAligned(
      skipWarmCycle.state1,
      skipCompletedIds.length,
      skipWorkItemsTotal,
      "skip warm state1"
    );

    const continueWarmStateSnapshot = cloneJson(continueWarmCycle.state1);
    const continueWarmEventsSnapshot = cloneJson(continueWarmCycle.events1);
    const skipWarmStateSnapshot = cloneJson(skipWarmCycle.state1);
    const skipWarmEventsSnapshot = cloneJson(skipWarmCycle.events1);

    // Cold cache parity
    const cacheB = await loadSessionStateCache(root, `b-${Date.now()}`);
    cacheB.clear();

    const continueColdCycle = await captureMixedReadCycle(http.baseUrl, continueSessionId);
    assertStablePayload(continueColdCycle.state1, continueWarmStateSnapshot, "continue cold state1 vs warm snapshot");
    assertStablePayload(continueColdCycle.events1, continueWarmEventsSnapshot, "continue cold events1 vs warm snapshot");

    const skipColdCycle = await captureMixedReadCycle(http.baseUrl, skipSessionId);
    assertStablePayload(skipColdCycle.state1, skipWarmStateSnapshot, "skip cold state1 vs warm snapshot");
    assertStablePayload(skipColdCycle.events1, skipWarmEventsSnapshot, "skip cold events1 vs warm snapshot");
  }
);