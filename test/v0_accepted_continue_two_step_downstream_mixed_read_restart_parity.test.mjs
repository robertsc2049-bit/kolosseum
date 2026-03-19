/* test/v0_accepted_continue_two_step_downstream_mixed_read_restart_parity.test.mjs */
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

function assertContinuePathState(statePayload, expectedCompletedIds, label) {
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
    `${label}: expected no dropped_ids on continue path.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    completedIds,
    expectedCompletedIds,
    `${label}: completed_ids drifted.\ntrace=${JSON.stringify(trace)}`
  );

  assert.ok(
    remainingIds.length === 0 || state.current_step !== null,
    `${label}: remaining_ids/current_step contract drifted.\nstate=${JSON.stringify(state)}`
  );

  if (remainingIds.length === 0) {
    assert.equal(
      state.current_step ?? null,
      null,
      `${label}: expected terminal null current_step when remaining_ids empty.\nstate=${JSON.stringify(state)}`
    );
  } else {
    const currentExerciseId = state.current_step?.exercise?.exercise_id ?? null;
    assert.ok(
      typeof currentExerciseId === "string" && currentExerciseId.length > 0,
      `${label}: expected active current_step exercise id.\nstate=${JSON.stringify(state)}`
    );
    assert.equal(
      remainingIds[0],
      currentExerciseId,
      `${label}: expected remaining_ids[0] to align with current_step.\nstate=${JSON.stringify(state)}`
    );
  }
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
  "test(v0): prove accepted continue path preserves mixed-read restart parity after two-step downstream progress",
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
    const firstExerciseId = initialState.json?.current_step?.exercise?.exercise_id;

    assert.equal(
      initialState.res.status,
      200,
      `initial state expected 200, got ${initialState.res.status}. raw=${initialState.text}`
    );
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
      stateAfterContinue.json?.current_step?.exercise?.exercise_id ?? null,
      secondExerciseId,
      `expected current step to resume at second exercise after RETURN_CONTINUE.\nstate=${stateAfterContinue.text}`
    );

    const complete2 = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: secondExerciseId } }
    );
    assert.equal(
      complete2.res.status,
      201,
      `second COMPLETE_EXERCISE expected 201, got ${complete2.res.status}. raw=${complete2.text}`
    );

    const stateAfterComplete2 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const thirdExerciseId = stateAfterComplete2.json?.current_step?.exercise?.exercise_id ?? null;

    assert.equal(
      stateAfterComplete2.res.status,
      200,
      `state after second complete expected 200, got ${stateAfterComplete2.res.status}. raw=${stateAfterComplete2.text}`
    );
    assert.ok(
      typeof thirdExerciseId === "string" && thirdExerciseId.length > 0,
      `expected third exercise id after second completion.\nraw=${stateAfterComplete2.text}`
    );
    assert.notEqual(
      thirdExerciseId,
      secondExerciseId,
      `expected third exercise to differ from second.\nstate=${stateAfterComplete2.text}`
    );

    const complete3 = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: thirdExerciseId } }
    );
    assert.equal(
      complete3.res.status,
      201,
      `third COMPLETE_EXERCISE expected 201, got ${complete3.res.status}. raw=${complete3.text}`
    );

    const stateAfterComplete3 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      stateAfterComplete3.res.status,
      200,
      `state after third complete expected 200, got ${stateAfterComplete3.res.status}. raw=${stateAfterComplete3.text}`
    );

    const expectedCompletedIds = [firstExerciseId, secondExerciseId, thirdExerciseId];
    assertContinuePathState(
      stateAfterComplete3,
      expectedCompletedIds,
      "state after two-step downstream progress"
    );

    const replaySkipRejected = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );

    assert.notEqual(
      replaySkipRejected.res.status,
      201,
      `replayed RETURN_SKIP must be rejected after accepted continue + two-step downstream progress. raw=${replaySkipRejected.text}`
    );
    assert.ok(
      [400, 409, 422].includes(replaySkipRejected.res.status),
      `replayed RETURN_SKIP expected 400/409/422, got ${replaySkipRejected.res.status}. raw=${replaySkipRejected.text}`
    );

    const warmCycle = await captureMixedReadCycle(http.baseUrl, sessionId);

    assertContinuePathState(warmCycle.state1, expectedCompletedIds, "warm cycle state1");
    assertContinuePathState(warmCycle.state2, expectedCompletedIds, "warm cycle state2");
    assertContinuePathState(warmCycle.state3, expectedCompletedIds, "warm cycle state3");

    assertEventsPayload(warmCycle.events1, "warm cycle events1");
    assertEventsPayload(warmCycle.events2, "warm cycle events2");

    assertStablePayload(warmCycle.state2, warmCycle.state1, "warm cycle state2 vs state1");
    assertStablePayload(warmCycle.state3, warmCycle.state1, "warm cycle state3 vs state1");
    assertStablePayload(warmCycle.events2, warmCycle.events1, "warm cycle events2 vs events1");

    assert.deepEqual(
      warmCycle.events1.json.events.map((x) => x.seq),
      [1, 2, 3, 4, 5, 6],
      `expected seq [1,2,3,4,5,6], got ${JSON.stringify(warmCycle.events1.json.events)}`
    );
    assert.deepEqual(
      warmCycle.events1.json.events.map((x) => x.event?.type),
      [
        "START_SESSION",
        "COMPLETE_EXERCISE",
        "SPLIT_SESSION",
        "RETURN_CONTINUE",
        "COMPLETE_EXERCISE",
        "COMPLETE_EXERCISE",
      ],
      `unexpected event order after accepted continue two-step progress.\ngot ${JSON.stringify(warmCycle.events1.json.events)}`
    );

    const acceptedWarmStateSnapshot = cloneJson(warmCycle.state1);
    const acceptedWarmEventsSnapshot = cloneJson(warmCycle.events1);

    const cacheB = await loadSessionStateCache(root, `b-${Date.now()}`);
    cacheB.clear();

    const coldCycle = await captureMixedReadCycle(http.baseUrl, sessionId);

    assertContinuePathState(coldCycle.state1, expectedCompletedIds, "cold cycle state1");
    assertContinuePathState(coldCycle.state2, expectedCompletedIds, "cold cycle state2");
    assertContinuePathState(coldCycle.state3, expectedCompletedIds, "cold cycle state3");

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