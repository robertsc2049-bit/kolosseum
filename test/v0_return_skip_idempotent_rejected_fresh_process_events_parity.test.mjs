/* test/v0_return_skip_idempotent_rejected_fresh_process_events_parity.test.mjs */
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

function assertTerminalSkipState(statePayload, expectedCompletedIds, expectedDroppedIds, label) {
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
  const currentStepExerciseId = state.current_step?.exercise?.exercise_id ?? null;

  assertNoLegacyGateLeak(trace, label);

  assert.equal(
    state.current_step ?? null,
    null,
    `${label}: expected terminal null current_step.\nstate=${JSON.stringify(state)}`
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

  assert.deepEqual(
    completedIds,
    expectedCompletedIds,
    `${label}: completed_ids drifted.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    droppedIds,
    expectedDroppedIds,
    `${label}: dropped_ids drifted.\ntrace=${JSON.stringify(trace)}`
  );

  assert.ok(
    remainingIds.every((id) => !expectedDroppedIds.includes(id)),
    `${label}: dropped ids must not reappear in remaining_ids.\ntrace=${JSON.stringify(trace)}`
  );

  assert.ok(
    completedIds.every((id) => !expectedDroppedIds.includes(id)),
    `${label}: dropped ids must not reappear in completed_ids.\ntrace=${JSON.stringify(trace)}`
  );

  if (typeof currentStepExerciseId === "string" && currentStepExerciseId.length > 0) {
    assert.ok(
      !expectedDroppedIds.includes(currentStepExerciseId),
      `${label}: current_step must not resurrect dropped work.\nstate=${JSON.stringify(state)}`
    );
  }
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
    `${label}: raw payload drifted.\nbefore=${expected.text}\nafter=${actual.text}`
  );
  assert.deepEqual(
    actual.json,
    expected.json,
    `${label}: JSON payload drifted.\nbefore=${JSON.stringify(expected.json)}\nafter=${JSON.stringify(actual.json)}`
  );
}

test(
  "test(v0): prove RETURN_SKIP remains idempotent-rejected after terminal skip and preserves append-only /events parity across repeated fresh-process reloads",
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

    const stateAfterComplete = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      stateAfterComplete.res.status,
      200,
      `state after first complete expected 200, got ${stateAfterComplete.res.status}. raw=${stateAfterComplete.text}`
    );

    const secondExerciseId = stateAfterComplete.json?.current_step?.exercise?.exercise_id;
    assert.ok(
      typeof secondExerciseId === "string" && secondExerciseId.length > 0,
      `expected second exercise id.\nraw=${stateAfterComplete.text}`
    );
    assert.notEqual(
      secondExerciseId,
      firstExerciseId,
      `expected second exercise after first completion.\nstate=${stateAfterComplete.text}`
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

    const expectedCompletedIds = cloneJson(splitState.json?.trace?.completed_ids ?? []);
    const expectedDroppedIds = cloneJson(splitState.json?.trace?.remaining_ids ?? []);

    assert.deepEqual(
      expectedCompletedIds,
      [firstExerciseId],
      `expected split completed_ids to preserve first complete.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );
    assert.ok(
      expectedDroppedIds.length >= 1,
      `expected remaining_ids at split.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );
    assert.equal(
      expectedDroppedIds[0],
      secondExerciseId,
      `expected dropped candidate to start with second exercise.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );

    const skipAccepted = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );
    assert.equal(
      skipAccepted.res.status,
      201,
      `RETURN_SKIP expected 201, got ${skipAccepted.res.status}. raw=${skipAccepted.text}`
    );

    const acceptedTerminalState = await httpJson(
      "GET",
      `${http.baseUrl}/sessions/${sessionId}/state`
    );
    assertTerminalSkipState(
      acceptedTerminalState,
      expectedCompletedIds,
      expectedDroppedIds,
      "accepted terminal skip state"
    );

    const acceptedEvents = await httpJson(
      "GET",
      `${http.baseUrl}/sessions/${sessionId}/events`
    );
    assertEventsPayload(acceptedEvents, "accepted events after RETURN_SKIP");

    assert.deepEqual(
      acceptedEvents.json.events.map((x) => x.seq),
      [1, 2, 3, 4],
      `expected seq [1,2,3,4], got ${JSON.stringify(acceptedEvents.json.events)}`
    );
    assert.deepEqual(
      acceptedEvents.json.events.map((x) => x.event?.type),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
      `unexpected event order after accepted RETURN_SKIP.\ngot ${JSON.stringify(acceptedEvents.json.events)}`
    );
    assert.equal(
      acceptedEvents.json.events[1]?.event?.exercise_id,
      firstExerciseId,
      `expected first COMPLETE_EXERCISE row to stay stable.\ngot ${JSON.stringify(acceptedEvents.json.events[1])}`
    );

    const acceptedTerminalStateSnapshot = cloneJson(acceptedTerminalState);
    const acceptedEventsSnapshot = cloneJson(acceptedEvents);

    for (const attempt of [1, 2, 3]) {
      const replaySkip = await httpJson(
        "POST",
        `${http.baseUrl}/sessions/${sessionId}/events`,
        { event: { type: "RETURN_SKIP" } }
      );

      assert.notEqual(
        replaySkip.res.status,
        201,
        `replayed RETURN_SKIP attempt ${attempt} must be rejected. raw=${replaySkip.text}`
      );
      assert.ok(
        [400, 409, 422].includes(replaySkip.res.status),
        `replayed RETURN_SKIP attempt ${attempt} expected 400/409/422, got ${replaySkip.res.status}. raw=${replaySkip.text}`
      );

      const stateAfterReplayReject = await httpJson(
        "GET",
        `${http.baseUrl}/sessions/${sessionId}/state`
      );
      const eventsAfterReplayReject = await httpJson(
        "GET",
        `${http.baseUrl}/sessions/${sessionId}/events`
      );

      assertTerminalSkipState(
        stateAfterReplayReject,
        expectedCompletedIds,
        expectedDroppedIds,
        `state after replay reject attempt ${attempt}`
      );
      assertEventsPayload(
        eventsAfterReplayReject,
        `events after replay reject attempt ${attempt}`
      );

      assertStablePayload(
        stateAfterReplayReject,
        acceptedTerminalStateSnapshot,
        `state parity after replay reject attempt ${attempt}`
      );
      assertStablePayload(
        eventsAfterReplayReject,
        acceptedEventsSnapshot,
        `events parity after replay reject attempt ${attempt}`
      );

      assert.deepEqual(
        eventsAfterReplayReject.json.events.map((x) => x.seq),
        [1, 2, 3, 4],
        `attempt ${attempt}: event seq must remain append-only and unchanged.\ngot ${JSON.stringify(eventsAfterReplayReject.json.events)}`
      );
      assert.deepEqual(
        eventsAfterReplayReject.json.events.map((x) => x.event?.type),
        ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
        `attempt ${attempt}: event types must remain unchanged.\ngot ${JSON.stringify(eventsAfterReplayReject.json.events)}`
      );
    }

    const cacheB = await loadSessionStateCache(root, `b-${Date.now()}`);
    cacheB.clear();

    const freshState1 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const freshEvents1 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
    const freshState2 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const freshEvents2 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
    const freshState3 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);

    assertTerminalSkipState(
      freshState1,
      expectedCompletedIds,
      expectedDroppedIds,
      "fresh state1 after repeated rejected RETURN_SKIP"
    );
    assertTerminalSkipState(
      freshState2,
      expectedCompletedIds,
      expectedDroppedIds,
      "fresh state2 after repeated rejected RETURN_SKIP"
    );
    assertTerminalSkipState(
      freshState3,
      expectedCompletedIds,
      expectedDroppedIds,
      "fresh state3 after repeated rejected RETURN_SKIP"
    );

    assertEventsPayload(freshEvents1, "fresh events1 after repeated rejected RETURN_SKIP");
    assertEventsPayload(freshEvents2, "fresh events2 after repeated rejected RETURN_SKIP");

    assertStablePayload(
      freshState1,
      acceptedTerminalStateSnapshot,
      "fresh state1 vs accepted terminal skip snapshot"
    );
    assertStablePayload(
      freshEvents1,
      acceptedEventsSnapshot,
      "fresh events1 vs accepted events snapshot"
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

    assert.deepEqual(
      freshEvents1.json.events.map((x) => x.seq),
      [1, 2, 3, 4],
      `fresh events1 seq drifted.\ngot ${JSON.stringify(freshEvents1.json.events)}`
    );
    assert.deepEqual(
      freshEvents2.json.events.map((x) => x.seq),
      [1, 2, 3, 4],
      `fresh events2 seq drifted.\ngot ${JSON.stringify(freshEvents2.json.events)}`
    );

    const cacheC = await loadSessionStateCache(root, `c-${Date.now()}`);
    cacheC.clear();

    const secondFreshState = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const secondFreshEvents = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);

    assertTerminalSkipState(
      secondFreshState,
      expectedCompletedIds,
      expectedDroppedIds,
      "second fresh-process terminal skip state"
    );
    assertEventsPayload(
      secondFreshEvents,
      "second fresh-process events parity after repeated rejected RETURN_SKIP"
    );

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