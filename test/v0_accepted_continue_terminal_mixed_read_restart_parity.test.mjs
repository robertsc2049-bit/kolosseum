/* test/v0_accepted_continue_terminal_mixed_read_restart_parity.test.mjs */
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

function assertEventsPayload(eventsPayload, label) {
  assert.equal(
    eventsPayload.res.status,
    200,
    `${label}: expected /events 200, got ${eventsPayload.res.status}. raw=${eventsPayload.text}`
  );
  assert.ok(
    eventsPayload.json && typeof eventsPayload.json === "object",
    `${label}: expected /events JSON object. raw=${eventsPayload.text}`
  );
  assert.ok(
    Array.isArray(eventsPayload.json.events),
    `${label}: expected /events events array. raw=${eventsPayload.text}`
  );
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

function assertAcceptedContinueTerminalState(
  statePayload,
  expectedCompletedIds,
  label
) {
  assert.equal(
    statePayload.res.status,
    200,
    `${label}: expected /state 200, got ${statePayload.res.status}. raw=${statePayload.text}`
  );
  assert.ok(
    statePayload.json && typeof statePayload.json === "object",
    `${label}: expected /state JSON object. raw=${statePayload.text}`
  );

  const state = statePayload.json;
  const trace = state.trace ?? {};
  const completedIds = Array.isArray(trace.completed_ids) ? trace.completed_ids : [];
  const remainingIds = Array.isArray(trace.remaining_ids) ? trace.remaining_ids : [];
  const droppedIds = Array.isArray(trace.dropped_ids) ? trace.dropped_ids : [];
  const currentExerciseId = state.current_step?.exercise?.exercise_id ?? null;

  assertNoLegacyGateLeak(trace, label);

  assert.equal(
    trace.return_decision_required,
    false,
    `${label}: expected return_decision_required=false.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    trace.return_decision_options ?? [],
    [],
    `${label}: expected empty return_decision_options.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    droppedIds,
    [],
    `${label}: continue terminal path must not drop work.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    completedIds,
    expectedCompletedIds,
    `${label}: completed_ids drifted.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    remainingIds,
    [],
    `${label}: expected terminal remaining_ids=[].\ntrace=${JSON.stringify(trace)}`
  );

  assert.equal(
    currentExerciseId,
    null,
    `${label}: terminal state must not expose an active current_step.\nstate=${JSON.stringify(state)}`
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

test(
  "test(v0): prove accepted continue path preserves mixed-read restart parity at terminal downstream state",
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

    const compile = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile?create_session=true`,
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

    const start = await httpJson("POST", `${http.baseUrl}/sessions/${sessionId}/start`, {});
    assert.ok(
      start.res.status === 200 || start.res.status === 201,
      `start expected 200/201, got ${start.res.status}. raw=${start.text}`
    );

    const initialState = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      initialState.res.status,
      200,
      `initial state expected 200, got ${initialState.res.status}. raw=${initialState.text}`
    );

    const firstExerciseId = initialState.json?.current_step?.exercise?.exercise_id;
    assert.ok(
      typeof firstExerciseId === "string" && firstExerciseId.length > 0,
      `expected first exercise id.\nraw=${initialState.text}`
    );

    const complete1 = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: firstExerciseId } }
    );
    assert.equal(
      complete1.res.status,
      201,
      `first COMPLETE_EXERCISE expected 201, got ${complete1.res.status}. raw=${complete1.text}`
    );

    const stateAfterComplete1 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      stateAfterComplete1.res.status,
      200,
      `state after first complete expected 200, got ${stateAfterComplete1.res.status}. raw=${stateAfterComplete1.text}`
    );

    const secondExerciseId = stateAfterComplete1.json?.current_step?.exercise?.exercise_id;
    assert.ok(
      typeof secondExerciseId === "string" && secondExerciseId.length > 0,
      `expected second exercise id.\nraw=${stateAfterComplete1.text}`
    );
    assert.notEqual(
      secondExerciseId,
      firstExerciseId,
      `expected second exercise after first completion.\nstate=${stateAfterComplete1.text}`
    );

    const split = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "SPLIT_SESSION" } }
    );
    assert.equal(
      split.res.status,
      201,
      `SPLIT_SESSION expected 201, got ${split.res.status}. raw=${split.text}`
    );

    const splitState = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      splitState.res.status,
      200,
      `split state expected 200, got ${splitState.res.status}. raw=${splitState.text}`
    );
    assert.equal(
      splitState.json?.trace?.return_decision_required,
      true,
      `expected return gate after split.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );

    const splitCompletedIds = cloneJson(splitState.json?.trace?.completed_ids ?? []);
    const splitRemainingIds = cloneJson(splitState.json?.trace?.remaining_ids ?? []);

    assert.deepEqual(
      splitCompletedIds,
      [firstExerciseId],
      `expected split completed_ids to preserve first completion.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );
    assert.ok(
      splitRemainingIds.length >= 2,
      `expected at least two remaining ids for terminal continue path.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );
    assert.equal(
      splitRemainingIds[0],
      secondExerciseId,
      `expected split remaining_ids[0] to align with next exercise.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );

    const continueAccepted = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_CONTINUE" } }
    );
    assert.equal(
      continueAccepted.res.status,
      201,
      `RETURN_CONTINUE expected 201, got ${continueAccepted.res.status}. raw=${continueAccepted.text}`
    );

    const stateAfterContinue = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      stateAfterContinue.res.status,
      200,
      `state after accepted continue expected 200, got ${stateAfterContinue.res.status}. raw=${stateAfterContinue.text}`
    );

    const resumedExerciseId = stateAfterContinue.json?.current_step?.exercise?.exercise_id ?? null;
    assert.equal(
      resumedExerciseId,
      secondExerciseId,
      `accepted continue must resume the previously gated exercise.\nstate=${stateAfterContinue.text}`
    );

    const completeResumed = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: resumedExerciseId } }
    );
    assert.equal(
      completeResumed.res.status,
      201,
      `downstream COMPLETE_EXERCISE expected 201, got ${completeResumed.res.status}. raw=${completeResumed.text}`
    );

    const stateAfterSecondComplete = await httpJson(
      "GET",
      `${http.baseUrl}/sessions/${sessionId}/state`
    );
    assert.equal(
      stateAfterSecondComplete.res.status,
      200,
      `state after second completion expected 200, got ${stateAfterSecondComplete.res.status}. raw=${stateAfterSecondComplete.text}`
    );

    const remainingAfterSecond = cloneJson(stateAfterSecondComplete.json?.trace?.remaining_ids ?? []);
    assert.ok(
      remainingAfterSecond.length >= 1,
      `expected at least one remaining exercise before terminal completion.\nstate=${stateAfterSecondComplete.text}`
    );

    let lastCompletedExerciseId = secondExerciseId;
    let terminalState = stateAfterSecondComplete;

    while (true) {
      const currentExerciseId = terminalState.json?.current_step?.exercise?.exercise_id ?? null;
      if (currentExerciseId === null) {
        break;
      }

      lastCompletedExerciseId = currentExerciseId;

      const complete = await httpJson(
        "POST",
        `${http.baseUrl}/sessions/${sessionId}/events`,
        { event: { type: "COMPLETE_EXERCISE", exercise_id: currentExerciseId } }
      );
      assert.equal(
        complete.res.status,
        201,
        `terminalizing COMPLETE_EXERCISE expected 201, got ${complete.res.status}. raw=${complete.text}`
      );

      terminalState = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
      assert.equal(
        terminalState.res.status,
        200,
        `state after terminalizing completion expected 200, got ${terminalState.res.status}. raw=${terminalState.text}`
      );

      const remainingIds = terminalState.json?.trace?.remaining_ids ?? [];
      const nextCurrentExerciseId = terminalState.json?.current_step?.exercise?.exercise_id ?? null;

      if (Array.isArray(remainingIds) && remainingIds.length === 0) {
        assert.equal(
          nextCurrentExerciseId,
          null,
          `terminal state must not expose current_step once remaining_ids=[].\nstate=${terminalState.text}`
        );
        break;
      }
    }

    const expectedCompletedIds = cloneJson(terminalState.json?.trace?.completed_ids ?? []);

    assert.ok(
      expectedCompletedIds.length >= 2,
      `expected completed_ids to include the pre-split and continued work.\nstate=${terminalState.text}`
    );
    assert.equal(
      expectedCompletedIds[0],
      firstExerciseId,
      `expected first completion to remain first in completed_ids.\nstate=${terminalState.text}`
    );
    assert.ok(
      expectedCompletedIds.includes(secondExerciseId),
      `expected resumed gated exercise to remain completed.\nstate=${terminalState.text}`
    );
    assert.equal(
      expectedCompletedIds[expectedCompletedIds.length - 1],
      lastCompletedExerciseId,
      `expected final completed id to match the last terminalizing completion.\nstate=${terminalState.text}`
    );

    assertAcceptedContinueTerminalState(
      terminalState,
      expectedCompletedIds,
      "state after accepted continue + terminal downstream progress"
    );

    const replaySkipRejected = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );

    assert.notEqual(
      replaySkipRejected.res.status,
      201,
      `replayed RETURN_SKIP must be rejected after accepted continue + terminal progress. raw=${replaySkipRejected.text}`
    );
    assert.ok(
      [400, 409, 422].includes(replaySkipRejected.res.status),
      `replayed RETURN_SKIP expected 400/409/422, got ${replaySkipRejected.res.status}. raw=${replaySkipRejected.text}`
    );

    const replayContinueRejected = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_CONTINUE" } }
    );

    assert.notEqual(
      replayContinueRejected.res.status,
      201,
      `replayed RETURN_CONTINUE must be rejected after accepted continue + terminal progress. raw=${replayContinueRejected.text}`
    );
    assert.ok(
      [400, 409, 422].includes(replayContinueRejected.res.status),
      `replayed RETURN_CONTINUE expected 400/409/422, got ${replayContinueRejected.res.status}. raw=${replayContinueRejected.text}`
    );

    const warmCycle = await captureMixedReadCycle(http.baseUrl, sessionId);

    assertAcceptedContinueTerminalState(
      warmCycle.state1,
      expectedCompletedIds,
      "warm cycle state1"
    );
    assertAcceptedContinueTerminalState(
      warmCycle.state2,
      expectedCompletedIds,
      "warm cycle state2"
    );
    assertAcceptedContinueTerminalState(
      warmCycle.state3,
      expectedCompletedIds,
      "warm cycle state3"
    );

    assertEventsPayload(warmCycle.events1, "warm cycle events1");
    assertEventsPayload(warmCycle.events2, "warm cycle events2");

    assertStablePayload(warmCycle.state2, warmCycle.state1, "warm cycle state2 vs state1");
    assertStablePayload(warmCycle.state3, warmCycle.state1, "warm cycle state3 vs state1");
    assertStablePayload(warmCycle.events2, warmCycle.events1, "warm cycle events2 vs events1");

    const warmEventTypes = warmCycle.events1.json.events.map((x) => x.event?.type);
    const warmSeqs = warmCycle.events1.json.events.map((x) => x.seq);

    assert.equal(
      warmSeqs.length,
      warmEventTypes.length,
      `expected seq count to match event count.\nevents=${JSON.stringify(warmCycle.events1.json.events)}`
    );
    assert.deepEqual(
      warmSeqs,
      Array.from({ length: warmEventTypes.length }, (_, i) => i + 1),
      `expected contiguous seq list starting at 1.\nevents=${JSON.stringify(warmCycle.events1.json.events)}`
    );
    assert.deepEqual(
      warmEventTypes.slice(0, 4),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
      `unexpected prefix event order after accepted continue terminal path.\ngot ${JSON.stringify(warmCycle.events1.json.events)}`
    );

    const postContinueCompleteCount = warmEventTypes.filter((x) => x === "COMPLETE_EXERCISE").length;
    assert.equal(
      postContinueCompleteCount,
      expectedCompletedIds.length,
      `expected COMPLETE_EXERCISE count to equal completed_ids length at terminal state.\nevents=${JSON.stringify(warmCycle.events1.json.events)}`
    );

    const acceptedWarmStateSnapshot = cloneJson(warmCycle.state1);
    const acceptedWarmEventsSnapshot = cloneJson(warmCycle.events1);

    const cacheB = await loadSessionStateCache(root, `b-${Date.now()}`);
    cacheB.clear();

    const coldCycle = await captureMixedReadCycle(http.baseUrl, sessionId);

    assertAcceptedContinueTerminalState(
      coldCycle.state1,
      expectedCompletedIds,
      "cold cycle state1"
    );
    assertAcceptedContinueTerminalState(
      coldCycle.state2,
      expectedCompletedIds,
      "cold cycle state2"
    );
    assertAcceptedContinueTerminalState(
      coldCycle.state3,
      expectedCompletedIds,
      "cold cycle state3"
    );

    assertEventsPayload(coldCycle.events1, "cold cycle events1");
    assertEventsPayload(coldCycle.events2, "cold cycle events2");

    assertStablePayload(coldCycle.state2, coldCycle.state1, "cold cycle state2 vs state1");
    assertStablePayload(coldCycle.state3, coldCycle.state1, "cold cycle state3 vs state1");
    assertStablePayload(coldCycle.events2, coldCycle.events1, "cold cycle events2 vs events1");

    assertStablePayload(
      coldCycle.state1,
      acceptedWarmStateSnapshot,
      "cold cycle state1 vs warm snapshot"
    );
    assertStablePayload(
      coldCycle.events1,
      acceptedWarmEventsSnapshot,
      "cold cycle events1 vs warm snapshot"
    );
  }
);