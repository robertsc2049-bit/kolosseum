/* test/api.split_decision_replay_idempotency.regression.test.mjs */
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
  const init = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(url, init);
  const { text, json } = await readJsonOnce(res);
  return { res, text, json };
}

test("API regression: split-decision replay is idempotent-rejected after RETURN_CONTINUE and remains byte-stable across cache clear", async (t) => {
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

  const http = await bootHttpVerticalSlice(t, { requiredFlagEnvVar: "KOLOSSEUM_STRICT_HTTP_E2E" });
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
    `compile expected 201, got ${compile.res.status}. raw=${compile.text}`
  );
  assert.ok(
    compile.json && typeof compile.json === "object",
    `compile expected JSON object. raw=${compile.text}`
  );
  assert.ok(
    typeof compile.json.session_id === "string" && compile.json.session_id.length > 0,
    `missing session_id. raw=${compile.text}`
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
  assert.ok(
    state0.json && typeof state0.json === "object",
    `initial state expected JSON. raw=${state0.text}`
  );
  assert.equal(
    state0.json.current_step?.type,
    "EXERCISE",
    `expected EXERCISE current_step. raw=${state0.text}`
  );

  const firstExerciseId = state0.json.current_step?.exercise?.exercise_id;
  assert.ok(
    typeof firstExerciseId === "string" && firstExerciseId.length > 0,
    `expected first exercise id. raw=${state0.text}`
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
    `state after first complete expected JSON. raw=${state1.text}`
  );
  assert.deepEqual(
    state1.json.trace?.completed_ids,
    [firstExerciseId],
    `expected completed_ids to contain first exercise. trace=${JSON.stringify(state1.json.trace)}`
  );

  const secondExerciseId = state1.json.current_step?.exercise?.exercise_id;
  assert.ok(
    typeof secondExerciseId === "string" && secondExerciseId.length > 0,
    `expected second exercise id after first complete. raw=${state1.text}`
  );
  assert.notEqual(
    secondExerciseId,
    firstExerciseId,
    `expected current_step to advance after first complete. state=${JSON.stringify(state1.json.current_step)}`
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
    `split state expected JSON. raw=${splitState.text}`
  );
  assert.ok(
    splitState.json.trace && typeof splitState.json.trace === "object",
    `split trace expected object. raw=${splitState.text}`
  );
  assert.equal(
    splitState.json.trace.return_decision_required,
    true,
    `expected return gate at split. trace=${JSON.stringify(splitState.json.trace)}`
  );
  assert.deepEqual(
    [...splitState.json.trace.return_decision_options].slice().sort(),
    ["RETURN_CONTINUE", "RETURN_SKIP"],
    `expected both return options at split. trace=${JSON.stringify(splitState.json.trace)}`
  );

  const splitCompletedIds = cloneJson(splitState.json.trace.completed_ids ?? []);
  const splitRemainingIds = cloneJson(splitState.json.trace.remaining_ids ?? []);

  assert.deepEqual(
    splitCompletedIds,
    [firstExerciseId],
    `expected completed_ids preserved at split. trace=${JSON.stringify(splitState.json.trace)}`
  );
  assert.ok(
    splitRemainingIds.length >= 1,
    `expected remaining_ids at split. trace=${JSON.stringify(splitState.json.trace)}`
  );
  assert.equal(
    splitRemainingIds[0],
    secondExerciseId,
    `expected remaining_ids[0] to align with current step at split. trace=${JSON.stringify(splitState.json.trace)}`
  );

  const continueRes = await httpJson(
    "POST",
    `${http.baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "RETURN_CONTINUE" } }
  );
  assert.equal(
    continueRes.res.status,
    201,
    `RETURN_CONTINUE expected 201, got ${continueRes.res.status}. raw=${continueRes.text}`
  );

  const stateAfterContinue = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterContinue.res.status,
    200,
    `state after RETURN_CONTINUE expected 200, got ${stateAfterContinue.res.status}. raw=${stateAfterContinue.text}`
  );
  assert.ok(
    stateAfterContinue.json && typeof stateAfterContinue.json === "object",
    `state after RETURN_CONTINUE expected JSON. raw=${stateAfterContinue.text}`
  );
  assert.ok(
    stateAfterContinue.json.trace && typeof stateAfterContinue.json.trace === "object",
    `state after RETURN_CONTINUE expected trace. raw=${stateAfterContinue.text}`
  );
  assert.equal(
    stateAfterContinue.json.trace.return_decision_required,
    false,
    `expected gate cleared after RETURN_CONTINUE. trace=${JSON.stringify(stateAfterContinue.json.trace)}`
  );
  assert.deepEqual(
    stateAfterContinue.json.trace.return_decision_options,
    [],
    `expected no return options after RETURN_CONTINUE. trace=${JSON.stringify(stateAfterContinue.json.trace)}`
  );
  assert.deepEqual(
    stateAfterContinue.json.trace.completed_ids,
    splitCompletedIds,
    `expected completed_ids preserved after RETURN_CONTINUE. trace=${JSON.stringify(stateAfterContinue.json.trace)}`
  );
  assert.deepEqual(
    stateAfterContinue.json.trace.remaining_ids,
    splitRemainingIds,
    `expected remaining_ids restored after RETURN_CONTINUE. trace=${JSON.stringify(stateAfterContinue.json.trace)}`
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(stateAfterContinue.json.trace, "split_active"),
    false,
    "trace must not expose split_active"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(stateAfterContinue.json.trace, "return_gate_required"),
    false,
    "trace must not expose return_gate_required"
  );
  assert.equal(
    stateAfterContinue.json.current_step?.exercise?.exercise_id,
    secondExerciseId,
    `expected current_step to realign with remaining_ids[0] after RETURN_CONTINUE. current_step=${JSON.stringify(stateAfterContinue.json.current_step)} trace=${JSON.stringify(stateAfterContinue.json.trace)}`
  );

  const eventsAfterContinue = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterContinue.res.status,
    200,
    `events after RETURN_CONTINUE expected 200, got ${eventsAfterContinue.res.status}. raw=${eventsAfterContinue.text}`
  );
  assert.ok(
    eventsAfterContinue.json && typeof eventsAfterContinue.json === "object",
    `events after RETURN_CONTINUE expected JSON object. raw=${eventsAfterContinue.text}`
  );
  assert.ok(
    Array.isArray(eventsAfterContinue.json.events),
    `events after RETURN_CONTINUE expected events array. raw=${eventsAfterContinue.text}`
  );
  assert.deepEqual(
    eventsAfterContinue.json.events.map((x) => x.seq),
    [1, 2, 3, 4],
    `expected seq [1,2,3,4], got ${JSON.stringify(eventsAfterContinue.json.events)}`
  );
  assert.deepEqual(
    eventsAfterContinue.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
    `expected ordered runtime events, got ${JSON.stringify(eventsAfterContinue.json.events)}`
  );
  assert.equal(
    eventsAfterContinue.json.events[1]?.event?.exercise_id,
    firstExerciseId,
    `expected persisted first COMPLETE_EXERCISE row to stay stable. got ${JSON.stringify(eventsAfterContinue.json.events[1])}`
  );

  const replayContinue = await httpJson(
    "POST",
    `${http.baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "RETURN_CONTINUE" } }
  );

  assert.notEqual(
    replayContinue.res.status,
    201,
    `replayed RETURN_CONTINUE must be rejected after ungate. raw=${replayContinue.text}`
  );
  assert.ok(
    [400, 409, 422].includes(replayContinue.res.status),
    `replayed RETURN_CONTINUE expected 400/409/422, got ${replayContinue.res.status}. raw=${replayContinue.text}`
  );

  const stateAfterReplayReject = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterReplayReject.res.status,
    200,
    `state after replay reject expected 200, got ${stateAfterReplayReject.res.status}. raw=${stateAfterReplayReject.text}`
  );
  assert.deepEqual(
    stateAfterReplayReject.json,
    stateAfterContinue.json,
    `state changed after rejected replay.` +
      `\nbefore=${JSON.stringify(stateAfterContinue.json)}` +
      `\nafter=${JSON.stringify(stateAfterReplayReject.json)}`
  );

  const eventsAfterReplayReject = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterReplayReject.res.status,
    200,
    `events after replay reject expected 200, got ${eventsAfterReplayReject.res.status}. raw=${eventsAfterReplayReject.text}`
  );
  assert.deepEqual(
    eventsAfterReplayReject.json,
    eventsAfterContinue.json,
    `events changed after rejected replay.` +
      `\nbefore=${JSON.stringify(eventsAfterContinue.json)}` +
      `\nafter=${JSON.stringify(eventsAfterReplayReject.json)}`
  );

  const snapshotState = cloneJson(stateAfterReplayReject.json);
  const snapshotEvents = cloneJson(eventsAfterReplayReject.json);

  sessionStateCache.clear();

  const stateAfterClear = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterClear.res.status,
    200,
    `state after cache clear expected 200, got ${stateAfterClear.res.status}. raw=${stateAfterClear.text}`
  );
  assert.deepEqual(
    stateAfterClear.json,
    snapshotState,
    `expected /state payload identical after cache clear.` +
      `\nbefore=${JSON.stringify(snapshotState)}` +
      `\nafter=${JSON.stringify(stateAfterClear.json)}`
  );

  const eventsAfterClear = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterClear.res.status,
    200,
    `events after cache clear expected 200, got ${eventsAfterClear.res.status}. raw=${eventsAfterClear.text}`
  );
  assert.deepEqual(
    eventsAfterClear.json,
    snapshotEvents,
    `expected /events payload identical after cache clear.` +
      `\nbefore=${JSON.stringify(snapshotEvents)}` +
      `\nafter=${JSON.stringify(eventsAfterClear.json)}`
  );

  assert.deepEqual(
    stateAfterClear.json.trace.completed_ids,
    splitCompletedIds,
    `completed_ids changed after cache clear. trace=${JSON.stringify(stateAfterClear.json.trace)}`
  );
  assert.deepEqual(
    stateAfterClear.json.trace.remaining_ids,
    splitRemainingIds,
    `remaining_ids changed after cache clear. trace=${JSON.stringify(stateAfterClear.json.trace)}`
  );
  assert.equal(
    stateAfterClear.json.trace.return_decision_required,
    false,
    `return_decision_required changed after cache clear. trace=${JSON.stringify(stateAfterClear.json.trace)}`
  );
  assert.deepEqual(
    stateAfterClear.json.trace.return_decision_options,
    [],
    `return_decision_options changed after cache clear. trace=${JSON.stringify(stateAfterClear.json.trace)}`
  );
  assert.equal(
    stateAfterClear.json.current_step?.exercise?.exercise_id,
    secondExerciseId,
    `current_step drifted after cache clear. current_step=${JSON.stringify(stateAfterClear.json.current_step)}`
  );
  assert.deepEqual(
    eventsAfterClear.json.events.map((x) => x.seq),
    [1, 2, 3, 4],
    `event seq ordering changed after cache clear. got ${JSON.stringify(eventsAfterClear.json.events.map((x) => x.seq))}`
  );
  assert.deepEqual(
    eventsAfterClear.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
    `persisted event history changed after cache clear. got ${JSON.stringify(eventsAfterClear.json.events)}`
  );
});