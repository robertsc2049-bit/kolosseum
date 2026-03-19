/* test/v0_fresh_process_read_parity_stable_after_split_replay_and_downstream_progress.test.mjs */
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

function assertTerminalNoResurrection(stateJson, droppedIds, label) {
  const trace = stateJson.trace ?? {};
  const remainingIds = Array.isArray(trace.remaining_ids) ? trace.remaining_ids : [];
  const completedIds = Array.isArray(trace.completed_ids) ? trace.completed_ids : [];
  const droppedTraceIds = Array.isArray(trace.dropped_ids) ? trace.dropped_ids : [];
  const currentStepExerciseId = stateJson.current_step?.exercise?.exercise_id ?? null;

  assertNoLegacyGateLeak(trace, label);

  assert.deepEqual(
    droppedTraceIds,
    droppedIds,
    `${label}: dropped_ids drifted.\ntrace=${JSON.stringify(trace)}`
  );

  assert.ok(
    remainingIds.every((id) => !droppedIds.includes(id)),
    `${label}: dropped ids must never reappear in remaining_ids.\ntrace=${JSON.stringify(trace)}`
  );

  assert.ok(
    completedIds.every((id) => !droppedIds.includes(id)),
    `${label}: dropped ids must never reappear in completed_ids.\ntrace=${JSON.stringify(trace)}`
  );

  if (typeof currentStepExerciseId === "string" && currentStepExerciseId.length > 0) {
    assert.ok(
      !droppedIds.includes(currentStepExerciseId),
      `${label}: current_step must not resurrect dropped work.\nstate=${JSON.stringify(stateJson)}`
    );
  }

  assert.equal(
    stateJson.current_step ?? null,
    null,
    `${label}: expected terminal null current_step.\nstate=${JSON.stringify(stateJson)}`
  );

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
}

function assertStateResponse(payload, droppedIds, label) {
  assert.equal(
    payload.res.status,
    200,
    `${label}: expected /state 200, got ${payload.res.status}. raw=${payload.text}`
  );
  assert.ok(
    payload.json && typeof payload.json === "object",
    `${label}: expected /state JSON object. raw=${payload.text}`
  );
  assertTerminalNoResurrection(payload.json, droppedIds, label);
}

function assertEventsResponse(payload, label) {
  assert.equal(
    payload.res.status,
    200,
    `${label}: expected /events 200, got ${payload.res.status}. raw=${payload.text}`
  );
  assert.ok(
    payload.json && typeof payload.json === "object",
    `${label}: expected /events JSON object. raw=${payload.text}`
  );
  assert.ok(
    Array.isArray(payload.json.events),
    `${label}: expected /events events array. raw=${payload.text}`
  );
}

function assertStablePayload(actual, expected, label) {
  assert.equal(
    actual.text,
    expected.text,
    `${label}: raw payload drifted.\nbefore=${expected.text}\nafter=${actual.text}`
  );
  assert.deepEqual(
    actual.json,
    expected.json,
    `${label}: JSON payload drifted.\nbefore=${JSON.stringify(expected.json)}\nafter=${JSON.stringify(actual.json)}`
  );
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

test(
  "test(v0): prove fresh-process read parity remains stable after split decision replay and downstream progress",
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

    const state0 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      state0.res.status,
      200,
      `initial state expected 200, got ${state0.res.status}. raw=${state0.text}`
    );

    const firstExerciseId = state0.json?.current_step?.exercise?.exercise_id;
    assert.ok(
      typeof firstExerciseId === "string" && firstExerciseId.length > 0,
      `expected first exercise id.\nraw=${state0.text}`
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

    const state1 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      state1.res.status,
      200,
      `state after first complete expected 200, got ${state1.res.status}. raw=${state1.text}`
    );

    const secondExerciseId = state1.json?.current_step?.exercise?.exercise_id;
    assert.ok(
      typeof secondExerciseId === "string" && secondExerciseId.length > 0,
      `expected second exercise id.\nraw=${state1.text}`
    );
    assert.notEqual(
      secondExerciseId,
      firstExerciseId,
      `expected next exercise after first complete.\nstate=${state1.text}`
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
      splitRemainingIds.length >= 1,
      `expected split remaining_ids.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );
    assert.equal(
      splitRemainingIds[0],
      secondExerciseId,
      `expected split remaining_ids[0] to align with current step.\ntrace=${JSON.stringify(splitState.json?.trace)}`
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
      `state after RETURN_CONTINUE expected 200, got ${stateAfterContinue.res.status}. raw=${stateAfterContinue.text}`
    );
    assert.equal(
      stateAfterContinue.json?.trace?.return_decision_required,
      false,
      `expected cleared return gate after RETURN_CONTINUE.\ntrace=${JSON.stringify(stateAfterContinue.json?.trace)}`
    );
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

    const stateAfterProgress = await httpJson(
      "GET",
      `${http.baseUrl}/sessions/${sessionId}/state`
    );
    assert.equal(
      stateAfterProgress.res.status,
      200,
      `state after downstream progress expected 200, got ${stateAfterProgress.res.status}. raw=${stateAfterProgress.text}`
    );

    const nextExerciseId = stateAfterProgress.json?.current_step?.exercise?.exercise_id ?? null;
    assert.ok(
      nextExerciseId === null || nextExerciseId !== secondExerciseId,
      `expected downstream progress to advance or terminate.\nstate=${stateAfterProgress.text}`
    );

    const replaySkipRejected = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );
    assert.notEqual(
      replaySkipRejected.res.status,
      201,
      `replayed RETURN_SKIP must be rejected after accepted RETURN_CONTINUE + downstream progress. raw=${replaySkipRejected.text}`
    );
    assert.ok(
      [400, 409, 422].includes(replaySkipRejected.res.status),
      `replayed RETURN_SKIP expected 400/409/422, got ${replaySkipRejected.res.status}. raw=${replaySkipRejected.text}`
    );

    const warmState = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const warmEvents = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);

    assert.equal(
      warmState.res.status,
      200,
      `warm state expected 200, got ${warmState.res.status}. raw=${warmState.text}`
    );
    assert.equal(
      warmEvents.res.status,
      200,
      `warm events expected 200, got ${warmEvents.res.status}. raw=${warmEvents.text}`
    );

    assert.ok(
      Array.isArray(warmEvents.json?.events),
      `warm events expected array. raw=${warmEvents.text}`
    );
    assert.deepEqual(
      warmEvents.json.events.map((x) => x.seq),
      [1, 2, 3, 4, 5],
      `expected seq [1,2,3,4,5]. got ${JSON.stringify(warmEvents.json.events)}`
    );
    assert.deepEqual(
      warmEvents.json.events.map((x) => x.event?.type),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE", "COMPLETE_EXERCISE"],
      `unexpected runtime event order.\ngot ${JSON.stringify(warmEvents.json.events)}`
    );

    const completedIdsAfterProgress = cloneJson(warmState.json?.trace?.completed_ids ?? []);
    assert.deepEqual(
      completedIdsAfterProgress,
      [firstExerciseId, secondExerciseId],
      `expected downstream progress to persist first + second completion.\ntrace=${JSON.stringify(warmState.json?.trace)}`
    );

    const droppedIdsAfterProgress = cloneJson(warmState.json?.trace?.dropped_ids ?? []);
    assert.deepEqual(
      droppedIdsAfterProgress,
      [],
      `expected no dropped_ids after continue path progress.\ntrace=${JSON.stringify(warmState.json?.trace)}`
    );

    assertNoLegacyGateLeak(warmState.json?.trace ?? {}, "warm state after replay reject + progress");

    const acceptedWarmStateSnapshot = cloneJson(warmState);
    const acceptedWarmEventsSnapshot = cloneJson(warmEvents);

    const cacheB = await loadSessionStateCache(root, `b-${Date.now()}`);
    cacheB.clear();

    const freshState1 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const freshEvents1 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
    const freshState2 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const freshEvents2 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
    const freshState3 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);

    assert.equal(
      freshState1.res.status,
      200,
      `fresh state1 expected 200, got ${freshState1.res.status}. raw=${freshState1.text}`
    );
    assert.equal(
      freshState2.res.status,
      200,
      `fresh state2 expected 200, got ${freshState2.res.status}. raw=${freshState2.text}`
    );
    assert.equal(
      freshState3.res.status,
      200,
      `fresh state3 expected 200, got ${freshState3.res.status}. raw=${freshState3.text}`
    );

    assertEventsResponse(freshEvents1, "fresh events1");
    assertEventsResponse(freshEvents2, "fresh events2");

    assertNoLegacyGateLeak(freshState1.json?.trace ?? {}, "fresh state1");
    assertNoLegacyGateLeak(freshState2.json?.trace ?? {}, "fresh state2");
    assertNoLegacyGateLeak(freshState3.json?.trace ?? {}, "fresh state3");

    assert.deepEqual(
      freshState1.json?.trace?.completed_ids ?? [],
      completedIdsAfterProgress,
      `fresh state1 completed_ids drifted.\ntrace=${JSON.stringify(freshState1.json?.trace)}`
    );
    assert.deepEqual(
      freshState2.json?.trace?.completed_ids ?? [],
      completedIdsAfterProgress,
      `fresh state2 completed_ids drifted.\ntrace=${JSON.stringify(freshState2.json?.trace)}`
    );
    assert.deepEqual(
      freshState3.json?.trace?.completed_ids ?? [],
      completedIdsAfterProgress,
      `fresh state3 completed_ids drifted.\ntrace=${JSON.stringify(freshState3.json?.trace)}`
    );

    assert.deepEqual(
      freshState1.json?.trace?.dropped_ids ?? [],
      [],
      `fresh state1 dropped_ids drifted.\ntrace=${JSON.stringify(freshState1.json?.trace)}`
    );
    assert.deepEqual(
      freshState2.json?.trace?.dropped_ids ?? [],
      [],
      `fresh state2 dropped_ids drifted.\ntrace=${JSON.stringify(freshState2.json?.trace)}`
    );
    assert.deepEqual(
      freshState3.json?.trace?.dropped_ids ?? [],
      [],
      `fresh state3 dropped_ids drifted.\ntrace=${JSON.stringify(freshState3.json?.trace)}`
    );

    assertStablePayload(
      freshState1,
      acceptedWarmStateSnapshot,
      "fresh state1 vs warm accepted snapshot"
    );
    assertStablePayload(
      freshEvents1,
      acceptedWarmEventsSnapshot,
      "fresh events1 vs warm accepted snapshot"
    );
    assertStablePayload(
      freshState2,
      freshState1,
      "fresh state2 vs fresh state1"
    );
    assertStablePayload(
      freshState3,
      freshState1,
      "fresh state3 vs fresh state1"
    );
    assertStablePayload(
      freshEvents2,
      freshEvents1,
      "fresh events2 vs fresh events1"
    );

    const cacheC = await loadSessionStateCache(root, `c-${Date.now()}`);
    cacheC.clear();

    const secondFreshState = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const secondFreshEvents = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);

    assertStablePayload(
      secondFreshState,
      freshState1,
      "second fresh-process state parity"
    );
    assertStablePayload(
      secondFreshEvents,
      freshEvents1,
      "second fresh-process events parity"
    );
  }
);