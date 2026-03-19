/* test/v0_rejected_split_decision_replay_mixed_read_terminal_no_resurrection.test.mjs */
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

function assertNoResurrection(stateJson, droppedIds, label) {
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
      `${label}: current_step must not resurrect a dropped exercise.\ncurrent_step=${JSON.stringify(stateJson.current_step)}\ntrace=${JSON.stringify(trace)}`
    );
  }
}

function assertTerminalStateShape(stateJson, droppedIds, label) {
  const trace = stateJson.trace ?? {};

  assertNoResurrection(stateJson, droppedIds, label);

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

function assertEventsContract(eventsPayload, label) {
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
    `${label}: expected /events array. raw=${eventsPayload.text}`
  );
}

function assertStateContract(statePayload, droppedIds, label) {
  assert.equal(
    statePayload.res.status,
    200,
    `${label}: expected /state 200, got ${statePayload.res.status}. raw=${statePayload.text}`
  );
  assert.ok(
    statePayload.json && typeof statePayload.json === "object",
    `${label}: expected /state JSON object. raw=${statePayload.text}`
  );
  assertTerminalStateShape(statePayload.json, droppedIds, label);
}

function assertStateStable(actual, expected, label) {
  assert.equal(
    actual.text,
    expected.text,
    `${label}: /state raw payload drifted.\nbefore=${expected.text}\nafter=${actual.text}`
  );

  assert.deepEqual(
    actual.json,
    expected.json,
    `${label}: /state JSON drifted.\nbefore=${JSON.stringify(expected.json)}\nafter=${JSON.stringify(actual.json)}`
  );
}

function assertEventsStable(actual, expected, label) {
  assert.equal(
    actual.text,
    expected.text,
    `${label}: /events raw payload drifted.\nbefore=${expected.text}\nafter=${actual.text}`
  );

  assert.deepEqual(
    actual.json,
    expected.json,
    `${label}: /events JSON drifted.\nbefore=${JSON.stringify(expected.json)}\nafter=${JSON.stringify(actual.json)}`
  );
}

async function captureMixedReadCycle(baseUrl, sessionId, label) {
  const state1 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  const events1 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  const state2 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);
  const events2 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);
  const state3 = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);

  return {
    label,
    state1,
    events1,
    state2,
    events2,
    state3,
  };
}

function assertMixedReadCycleStable(cycle, droppedIds, expectedEventsSnapshot, label) {
  assertStateContract(cycle.state1, droppedIds, `${label} state1`);
  assertStateContract(cycle.state2, droppedIds, `${label} state2`);
  assertStateContract(cycle.state3, droppedIds, `${label} state3`);

  assertEventsContract(cycle.events1, `${label} events1`);
  assertEventsContract(cycle.events2, `${label} events2`);

  assertStateStable(cycle.state2, cycle.state1, `${label}: state2 vs state1`);
  assertStateStable(cycle.state3, cycle.state1, `${label}: state3 vs state1`);
  assertEventsStable(cycle.events2, cycle.events1, `${label}: events2 vs events1`);

  assertEventsStable(
    cycle.events1,
    expectedEventsSnapshot,
    `${label}: events1 vs accepted snapshot`
  );
}

test(
  "test(v0): prove repeated mixed /state -> /events -> /state reads after rejected split-decision replay preserve terminal-state shape and no-resurrection invariants",
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

    const cacheModuleUrl =
      pathToFileURL(path.join(root, "dist", "src", "api", "session_state_cache.js")).href +
      `?t=${Date.now()}`;

    const { sessionStateCache } = await import(cacheModuleUrl);

    assert.ok(
      sessionStateCache && typeof sessionStateCache.clear === "function",
      "expected dist sessionStateCache.clear()"
    );

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
      `compile expected 201, got ${compile.res.status}.\nraw=${compile.text}`
    );
    assert.ok(
      compile.json && typeof compile.json === "object",
      `compile expected JSON object. raw=${compile.text}`
    );
    assert.ok(
      typeof compile.json.session_id === "string" && compile.json.session_id.length > 0,
      `missing session_id.\nraw=${compile.text}`
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
    assert.ok(
      initialState.json && typeof initialState.json === "object",
      `initial state expected JSON object. raw=${initialState.text}`
    );
    assert.equal(
      initialState.json.current_step?.type,
      "EXERCISE",
      `expected EXERCISE current_step. raw=${initialState.text}`
    );

    const firstExerciseId = initialState.json.current_step?.exercise?.exercise_id;
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

    const state1 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      state1.res.status,
      200,
      `state after first complete expected 200, got ${state1.res.status}. raw=${state1.text}`
    );
    assert.ok(
      state1.json && typeof state1.json === "object",
      `state after first complete expected JSON object. raw=${state1.text}`
    );
    assert.deepEqual(
      state1.json.trace?.completed_ids,
      [firstExerciseId],
      `expected completed_ids to contain first exercise.\ntrace=${JSON.stringify(state1.json.trace)}`
    );

    const secondExerciseId = state1.json.current_step?.exercise?.exercise_id;
    assert.ok(
      typeof secondExerciseId === "string" && secondExerciseId.length > 0,
      `expected second exercise id after first complete. raw=${state1.text}`
    );
    assert.notEqual(
      secondExerciseId,
      firstExerciseId,
      `expected current_step to advance after first complete.\nstate=${JSON.stringify(state1.json.current_step)}`
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
    assert.ok(
      splitState.json && typeof splitState.json === "object",
      `split state expected JSON object. raw=${splitState.text}`
    );
    assert.ok(
      splitState.json.trace && typeof splitState.json.trace === "object",
      `split state expected trace object. raw=${splitState.text}`
    );
    assert.equal(
      splitState.json.trace.return_decision_required,
      true,
      `expected return gate at split.\ntrace=${JSON.stringify(splitState.json.trace)}`
    );
    assert.deepEqual(
      [...splitState.json.trace.return_decision_options].slice().sort(),
      ["RETURN_CONTINUE", "RETURN_SKIP"],
      `expected both return options at split.\ntrace=${JSON.stringify(splitState.json.trace)}`
    );

    const splitCompletedIds = cloneJson(splitState.json.trace.completed_ids ?? []);
    const splitRemainingIds = cloneJson(splitState.json.trace.remaining_ids ?? []);

    assert.deepEqual(
      splitCompletedIds,
      [firstExerciseId],
      `expected completed_ids preserved at split.\ntrace=${JSON.stringify(splitState.json.trace)}`
    );
    assert.ok(
      splitRemainingIds.length >= 1,
      `expected remaining_ids at split.\ntrace=${JSON.stringify(splitState.json.trace)}`
    );
    assert.equal(
      splitRemainingIds[0],
      secondExerciseId,
      `expected remaining_ids[0] to align with current step at split.\ntrace=${JSON.stringify(splitState.json.trace)}`
    );

    const skipRes = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );

    assert.equal(
      skipRes.res.status,
      201,
      `RETURN_SKIP expected 201, got ${skipRes.res.status}. raw=${skipRes.text}`
    );

    const stateAfterSkip = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      stateAfterSkip.res.status,
      200,
      `state after RETURN_SKIP expected 200, got ${stateAfterSkip.res.status}. raw=${stateAfterSkip.text}`
    );
    assert.ok(
      stateAfterSkip.json && typeof stateAfterSkip.json === "object",
      `state after RETURN_SKIP expected JSON object. raw=${stateAfterSkip.text}`
    );
    assert.ok(
      stateAfterSkip.json.trace && typeof stateAfterSkip.json.trace === "object",
      `state after RETURN_SKIP expected trace object. raw=${stateAfterSkip.text}`
    );
    assert.deepEqual(
      stateAfterSkip.json.trace.completed_ids,
      splitCompletedIds,
      `expected completed_ids preserved after RETURN_SKIP.\ntrace=${JSON.stringify(stateAfterSkip.json.trace)}`
    );
    assert.deepEqual(
      stateAfterSkip.json.trace.dropped_ids,
      splitRemainingIds,
      `expected dropped_ids to equal split remaining_ids.\ntrace=${JSON.stringify(stateAfterSkip.json.trace)}`
    );
    assertTerminalStateShape(stateAfterSkip.json, splitRemainingIds, "after RETURN_SKIP");

    const eventsAfterSkip = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
    assert.equal(
      eventsAfterSkip.res.status,
      200,
      `events after RETURN_SKIP expected 200, got ${eventsAfterSkip.res.status}. raw=${eventsAfterSkip.text}`
    );
    assert.ok(
      eventsAfterSkip.json && typeof eventsAfterSkip.json === "object",
      `events after RETURN_SKIP expected JSON object. raw=${eventsAfterSkip.text}`
    );
    assert.ok(
      Array.isArray(eventsAfterSkip.json.events),
      `events after RETURN_SKIP expected events array. raw=${eventsAfterSkip.text}`
    );
    assert.deepEqual(
      eventsAfterSkip.json.events.map((x) => x.seq),
      [1, 2, 3, 4],
      `expected seq [1,2,3,4], got ${JSON.stringify(eventsAfterSkip.json.events)}`
    );
    assert.deepEqual(
      eventsAfterSkip.json.events.map((x) => x.event?.type),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
      `expected ordered runtime events, got ${JSON.stringify(eventsAfterSkip.json.events)}`
    );
    assert.equal(
      eventsAfterSkip.json.events[1]?.event?.exercise_id,
      firstExerciseId,
      `expected persisted first COMPLETE_EXERCISE row to stay stable.\ngot ${JSON.stringify(eventsAfterSkip.json.events[1])}`
    );

    const acceptedStateSnapshot = cloneJson(stateAfterSkip);
    const acceptedEventsSnapshot = cloneJson(eventsAfterSkip);

    const replayContinue = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_CONTINUE" } }
    );

    assert.notEqual(
      replayContinue.res.status,
      201,
      `replayed RETURN_CONTINUE must be rejected after RETURN_SKIP. raw=${replayContinue.text}`
    );
    assert.ok(
      [400, 409, 422].includes(replayContinue.res.status),
      `replayed RETURN_CONTINUE expected 400/409/422, got ${replayContinue.res.status}. raw=${replayContinue.text}`
    );

    const stateAfterReplayReject = await httpJson(
      "GET",
      `${http.baseUrl}/sessions/${sessionId}/state`
    );
    assert.equal(
      stateAfterReplayReject.res.status,
      200,
      `state after replay reject expected 200, got ${stateAfterReplayReject.res.status}. raw=${stateAfterReplayReject.text}`
    );
    assertStateStable(
      stateAfterReplayReject,
      acceptedStateSnapshot,
      "state after rejected replay vs accepted skip snapshot"
    );
    assertTerminalStateShape(
      stateAfterReplayReject.json,
      splitRemainingIds,
      "after rejected replay"
    );

    const eventsAfterReplayReject = await httpJson(
      "GET",
      `${http.baseUrl}/sessions/${sessionId}/events`
    );
    assert.equal(
      eventsAfterReplayReject.res.status,
      200,
      `events after replay reject expected 200, got ${eventsAfterReplayReject.res.status}. raw=${eventsAfterReplayReject.text}`
    );
    assertEventsStable(
      eventsAfterReplayReject,
      acceptedEventsSnapshot,
      "events after rejected replay vs accepted skip snapshot"
    );

    const warmCycle = await captureMixedReadCycle(
      http.baseUrl,
      sessionId,
      "warm mixed read cycle after rejected replay"
    );

    assertMixedReadCycleStable(
      warmCycle,
      splitRemainingIds,
      acceptedEventsSnapshot,
      "warm mixed read cycle after rejected replay"
    );

    assertStateStable(
      warmCycle.state1,
      acceptedStateSnapshot,
      "warm cycle state1 vs accepted state snapshot"
    );

    sessionStateCache.clear();

    const coldCycle = await captureMixedReadCycle(
      http.baseUrl,
      sessionId,
      "cold mixed read cycle after rejected replay"
    );

    assertMixedReadCycleStable(
      coldCycle,
      splitRemainingIds,
      acceptedEventsSnapshot,
      "cold mixed read cycle after rejected replay"
    );

    assertStateStable(
      coldCycle.state1,
      warmCycle.state1,
      "cold cycle state1 vs warm cycle state1"
    );
    assertStateStable(
      coldCycle.state2,
      warmCycle.state2,
      "cold cycle state2 vs warm cycle state2"
    );
    assertStateStable(
      coldCycle.state3,
      warmCycle.state3,
      "cold cycle state3 vs warm cycle state3"
    );

    assertEventsStable(
      coldCycle.events1,
      warmCycle.events1,
      "cold cycle events1 vs warm cycle events1"
    );
    assertEventsStable(
      coldCycle.events2,
      warmCycle.events2,
      "cold cycle events2 vs warm cycle events2"
    );
  }
);