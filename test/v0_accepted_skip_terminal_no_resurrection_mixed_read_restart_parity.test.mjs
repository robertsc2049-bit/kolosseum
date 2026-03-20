/* test/v0_accepted_skip_terminal_no_resurrection_mixed_read_restart_parity.test.mjs */
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

function isTerminalStatePayload(statePayload) {
  const state = statePayload?.json ?? {};
  const trace = state.trace ?? {};
  const remainingIds = Array.isArray(trace.remaining_ids) ? trace.remaining_ids : [];
  const currentExerciseId = state.current_step?.exercise?.exercise_id ?? null;
  return remainingIds.length === 0 && currentExerciseId === null;
}

function assertTerminalSkipPathState(
  statePayload,
  expectedCompletedIds,
  expectedDroppedIds,
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
    completedIds,
    expectedCompletedIds,
    `${label}: completed_ids drifted.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    droppedIds,
    expectedDroppedIds,
    `${label}: dropped_ids drifted.\ntrace=${JSON.stringify(trace)}`
  );

  assert.deepEqual(
    remainingIds,
    [],
    `${label}: terminal state must have empty remaining_ids.\ntrace=${JSON.stringify(trace)}`
  );

  assert.equal(
    currentExerciseId,
    null,
    `${label}: terminal state must not expose current_step exercise.\nstate=${JSON.stringify(state)}`
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
  "test(v0): prove accepted skip path preserves terminal no-resurrection invariants across mixed-read restart parity",
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

    const completeFirst = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: firstExerciseId } }
    );
    assert.equal(
      completeFirst.res.status,
      201,
      `first COMPLETE_EXERCISE expected 201, got ${completeFirst.res.status}. raw=${completeFirst.text}`
    );

    const stateAfterFirst = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    const gatedExerciseId = stateAfterFirst.json?.current_step?.exercise?.exercise_id ?? null;
    assert.ok(
      typeof gatedExerciseId === "string" && gatedExerciseId.length > 0,
      `expected gated exercise id after first completion.\nstate=${stateAfterFirst.text}`
    );
    assert.notEqual(
      gatedExerciseId,
      firstExerciseId,
      `expected progress beyond first exercise before split.\nstate=${stateAfterFirst.text}`
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
      `expected at least two remaining ids for terminal skip path proof.\ntrace=${JSON.stringify(splitState.json?.trace)}`
    );
    assert.equal(
      splitRemainingIds[0],
      gatedExerciseId,
      `expected split remaining_ids[0] to align with gated exercise.\ntrace=${JSON.stringify(splitState.json?.trace)}`
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

    const stateAfterSkip = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
    assert.equal(
      stateAfterSkip.res.status,
      200,
      `state after accepted skip expected 200, got ${stateAfterSkip.res.status}. raw=${stateAfterSkip.text}`
    );

    const droppedIdsAfterSkip = cloneJson(stateAfterSkip.json?.trace?.dropped_ids ?? []);
    assert.equal(
      droppedIdsAfterSkip.includes(gatedExerciseId),
      true,
      `accepted skip must drop the gated exercise.\ntrace=${JSON.stringify(stateAfterSkip.json?.trace)}`
    );
    assert.equal(
      stateAfterSkip.json?.trace?.completed_ids?.includes(gatedExerciseId) ?? false,
      false,
      `accepted skip must not mark gated exercise completed.\ntrace=${JSON.stringify(stateAfterSkip.json?.trace)}`
    );

    const completedIds = [firstExerciseId];
    let terminalState = stateAfterSkip;

    for (let i = 0; i < 20; i += 1) {
      if (isTerminalStatePayload(terminalState)) {
        break;
      }

      const nextExerciseId =
        terminalState.json?.current_step?.exercise?.exercise_id ?? null;

      assert.ok(
        typeof nextExerciseId === "string" && nextExerciseId.length > 0,
        `expected nonterminal current exercise before completion loop iteration ${i}.\nstate=${terminalState.text}`
      );
      assert.equal(
        nextExerciseId,
        gatedExerciseId,
        false,
        `skip path must never resurrect the gated exercise inside the completion loop.\nstate=${terminalState.text}`
      );

      const completeNext = await httpJson(
        "POST",
        `${http.baseUrl}/sessions/${sessionId}/events`,
        { event: { type: "COMPLETE_EXERCISE", exercise_id: nextExerciseId } }
      );
      assert.equal(
        completeNext.res.status,
        201,
        `loop COMPLETE_EXERCISE expected 201, got ${completeNext.res.status}. raw=${completeNext.text}`
      );

      completedIds.push(nextExerciseId);
      terminalState = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
      assert.equal(
        terminalState.res.status,
        200,
        `loop state read expected 200, got ${terminalState.res.status}. raw=${terminalState.text}`
      );
    }

    assert.equal(
      isTerminalStatePayload(terminalState),
      true,
      `expected terminal state after exhausting remaining work on skip path.\nstate=${terminalState.text}`
    );

    const expectedCompletedIds = cloneJson(completedIds);
    const expectedDroppedIds = cloneJson(droppedIdsAfterSkip);

    assert.ok(
      expectedCompletedIds.length >= 2,
      `expected at least one completed item after skip beyond the initial completion.\ncompleted=${JSON.stringify(expectedCompletedIds)}`
    );
    assert.deepEqual(
      expectedDroppedIds,
      [gatedExerciseId],
      `expected dropped_ids to contain only the skipped gated exercise.\ndropped=${JSON.stringify(expectedDroppedIds)}`
    );

    assertTerminalSkipPathState(
      terminalState,
      expectedCompletedIds,
      expectedDroppedIds,
      "terminal state after accepted skip"
    );

    const replaySkipRejected = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "RETURN_SKIP" } }
    );
    assert.notEqual(
      replaySkipRejected.res.status,
      201,
      `replayed RETURN_SKIP must be rejected after terminal skip path. raw=${replaySkipRejected.text}`
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
      `replayed RETURN_CONTINUE must be rejected after terminal skip path. raw=${replayContinueRejected.text}`
    );
    assert.ok(
      [400, 409, 422].includes(replayContinueRejected.res.status),
      `replayed RETURN_CONTINUE expected 400/409/422, got ${replayContinueRejected.res.status}. raw=${replayContinueRejected.text}`
    );

    const replayGatedCompletionRejected = await httpJson(
      "POST",
      `${http.baseUrl}/sessions/${sessionId}/events`,
      { event: { type: "COMPLETE_EXERCISE", exercise_id: gatedExerciseId } }
    );
    assert.notEqual(
      replayGatedCompletionRejected.res.status,
      201,
      `skipped gated exercise must not be completable after terminalization. raw=${replayGatedCompletionRejected.text}`
    );
    assert.ok(
      [400, 409, 422].includes(replayGatedCompletionRejected.res.status),
      `replayed COMPLETE_EXERCISE for skipped item expected 400/409/422, got ${replayGatedCompletionRejected.res.status}. raw=${replayGatedCompletionRejected.text}`
    );

    const warmCycle = await captureMixedReadCycle(http.baseUrl, sessionId);

    assertTerminalSkipPathState(
      warmCycle.state1,
      expectedCompletedIds,
      expectedDroppedIds,
      "warm cycle state1"
    );
    assertTerminalSkipPathState(
      warmCycle.state2,
      expectedCompletedIds,
      expectedDroppedIds,
      "warm cycle state2"
    );
    assertTerminalSkipPathState(
      warmCycle.state3,
      expectedCompletedIds,
      expectedDroppedIds,
      "warm cycle state3"
    );

    assertEventsPayload(warmCycle.events1, "warm cycle events1");
    assertEventsPayload(warmCycle.events2, "warm cycle events2");

    assertStablePayload(warmCycle.state2, warmCycle.state1, "warm cycle state2 vs state1");
    assertStablePayload(warmCycle.state3, warmCycle.state1, "warm cycle state3 vs state1");
    assertStablePayload(warmCycle.events2, warmCycle.events1, "warm cycle events2 vs events1");

    const eventTypes = warmCycle.events1.json.events.map((x) => x.event?.type);
    const eventSeqs = warmCycle.events1.json.events.map((x) => x.seq);

    assert.deepEqual(
      eventSeqs,
      Array.from({ length: eventSeqs.length }, (_, i) => i + 1),
      `expected contiguous seq values from 1..n, got ${JSON.stringify(warmCycle.events1.json.events)}`
    );

    assert.deepEqual(
      eventTypes.slice(0, 4),
      ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
      `unexpected event prefix for terminal skip path.\ngot ${JSON.stringify(warmCycle.events1.json.events)}`
    );

    assert.equal(
      eventTypes.filter((x) => x === "COMPLETE_EXERCISE").length,
      expectedCompletedIds.length,
      `COMPLETE_EXERCISE count must align with expected completed ids.\nevents=${JSON.stringify(warmCycle.events1.json.events)}`
    );

    const acceptedWarmStateSnapshot = cloneJson(warmCycle.state1);
    const acceptedWarmEventsSnapshot = cloneJson(warmCycle.events1);

    const cacheB = await loadSessionStateCache(root, `b-${Date.now()}`);
    cacheB.clear();

    const coldCycle = await captureMixedReadCycle(http.baseUrl, sessionId);

    assertTerminalSkipPathState(
      coldCycle.state1,
      expectedCompletedIds,
      expectedDroppedIds,
      "cold cycle state1"
    );
    assertTerminalSkipPathState(
      coldCycle.state2,
      expectedCompletedIds,
      expectedDroppedIds,
      "cold cycle state2"
    );
    assertTerminalSkipPathState(
      coldCycle.state3,
      expectedCompletedIds,
      expectedDroppedIds,
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