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

function assertTerminalContinueState(statePayload, expectedCompletedIds, label) {
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
    droppedIds,
    [],
    `${label}: expected no dropped_ids on continue path.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    completedIds,
    expectedCompletedIds,
    `${label}: completed_ids drifted.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    remainingIds,
    [],
    `${label}: expected terminal empty remaining_ids.\ntrace=${JSON.stringify(trace)}`
  );
}

test(
  "test(v0): prove RETURN_CONTINUE remains idempotent-rejected after terminal completion and preserves fresh-process state/events parity",
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

    for (let i = 0; i < 32; i++) {
      const live = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
      if (live.json?.execution_status === "completed" || live.json?.execution_status === "partial") {
        break;
      }

      const nextExerciseId =
        live.json?.current_step?.type === "EXERCISE"
          ? live.json?.current_step?.exercise?.exercise_id
          : null;

      assert.ok(
        typeof nextExerciseId === "string" && nextExerciseId.length > 0,
        `continue-drain-${i}: expected live exercise before terminal state.\nstate=${live.text}`
      );

      const drainAppend = await httpJson(
        "POST",
        `${http.baseUrl}/sessions/${sessionId}/events`,
        { event: { type: "COMPLETE_EXERCISE", exercise_id: nextExerciseId } }
      );
      assert.equal(
        drainAppend.res.status,
        201,
        `continue drain COMPLETE_EXERCISE ${i} expected 201, got ${drainAppend.res.status}. raw=${drainAppend.text}`
      );
    }

    const terminalState = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const terminalEvents = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);

    const expectedCompletedIds = Array.isArray(terminalState.json?.completed_exercises)
      ? terminalState.json.completed_exercises.map((x) => x?.exercise_id).filter(Boolean)
      : [];

    assertTerminalContinueState(
      terminalState,
      expectedCompletedIds,
      "terminal continue-path state"
    );
    assertEventsPayload(
      terminalEvents,
      "terminal continue-path events"
    );

    assert.deepEqual(
      terminalEvents.json.events.map((x) => x.seq),
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      `expected seq [1,2,3,4,5,6,7,8,9], got ${JSON.stringify(terminalEvents.json.events)}`
    );
    assert.deepEqual(
      terminalEvents.json.events.map((x) => x.event?.type),
      [
        "START_SESSION",
        "COMPLETE_EXERCISE",
        "SPLIT_SESSION",
        "RETURN_CONTINUE",
        "COMPLETE_EXERCISE",
        "COMPLETE_EXERCISE",
        "COMPLETE_EXERCISE",
        "COMPLETE_EXERCISE",
        "COMPLETE_EXERCISE"
      ],
      `unexpected terminal continue-path event order.\ngot ${JSON.stringify(terminalEvents.json.events)}`
    );
    assert.equal(
      terminalEvents.json.events[1]?.event?.exercise_id,
      firstExerciseId,
      `expected first COMPLETE_EXERCISE row to stay stable.\ngot ${JSON.stringify(terminalEvents.json.events[1])}`
    );
    assert.equal(
      terminalEvents.json.events[4]?.event?.exercise_id,
      secondExerciseId,
      `expected second COMPLETE_EXERCISE row to stay stable.\ngot ${JSON.stringify(terminalEvents.json.events[4])}`
    );

    const terminalStateSnapshot = cloneJson(terminalState);
    const terminalEventsSnapshot = cloneJson(terminalEvents);

    for (const attempt of [1, 2, 3]) {
      const replayContinue = await httpJson(
        "POST",
        `${http.baseUrl}/sessions/${sessionId}/events`,
        { event: { type: "RETURN_CONTINUE" } }
      );

      assert.notEqual(
        replayContinue.res.status,
        201,
        `replayed RETURN_CONTINUE attempt ${attempt} must be rejected. raw=${replayContinue.text}`
      );
      assert.ok(
        [400, 409, 422].includes(replayContinue.res.status),
        `replayed RETURN_CONTINUE attempt ${attempt} expected 400/409/422, got ${replayContinue.res.status}. raw=${replayContinue.text}`
      );

      const stateAfterReplayReject = await httpJson(
        "GET",
        `${http.baseUrl}/sessions/${sessionId}/state`
      );
      const eventsAfterReplayReject = await httpJson(
        "GET",
        `${http.baseUrl}/sessions/${sessionId}/events`
      );

      assertTerminalContinueState(
        stateAfterReplayReject,
        expectedCompletedIds,
        `state after replay reject attempt ${attempt}`
      );
      assertEventsPayload(
        eventsAfterReplayReject,
        `events after replay reject attempt ${attempt}`
      );

      assertStablePayload(
        stateAfterReplayReject,
        terminalStateSnapshot,
        `state parity after replay reject attempt ${attempt}`
      );
      assertStablePayload(
        eventsAfterReplayReject,
        terminalEventsSnapshot,
        `events parity after replay reject attempt ${attempt}`
      );

      assert.deepEqual(
        eventsAfterReplayReject.json.events.map((x) => x.seq),
        terminalEvents.json.events.map((x) => x.seq),
        `attempt ${attempt}: event seq must remain append-only and unchanged.\ngot ${JSON.stringify(eventsAfterReplayReject.json.events)}`
      );
      assert.deepEqual(
        eventsAfterReplayReject.json.events.map((x) => x.event?.type),
        terminalEvents.json.events.map((x) => x.event?.type),
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

    assertTerminalContinueState(
      freshState1,
      expectedCompletedIds,
      "fresh state1 after repeated rejected RETURN_CONTINUE"
    );
    assertTerminalContinueState(
      freshState2,
      expectedCompletedIds,
      "fresh state2 after repeated rejected RETURN_CONTINUE"
    );
    assertTerminalContinueState(
      freshState3,
      expectedCompletedIds,
      "fresh state3 after repeated rejected RETURN_CONTINUE"
    );

    assertEventsPayload(freshEvents1, "fresh events1 after repeated rejected RETURN_CONTINUE");
    assertEventsPayload(freshEvents2, "fresh events2 after repeated rejected RETURN_CONTINUE");

    assertStablePayload(
      freshState1,
      terminalStateSnapshot,
      "fresh state1 vs terminal continue snapshot"
    );
    assertStablePayload(
      freshEvents1,
      terminalEventsSnapshot,
      "fresh events1 vs terminal events snapshot"
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

    assertTerminalContinueState(
      secondFreshState,
      expectedCompletedIds,
      "second fresh-process terminal continue state"
    );
    assertEventsPayload(
      secondFreshEvents,
      "second fresh-process terminal continue events"
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