/* test/api.split_decision_replay_after_return_skip_idempotency.regression.test.mjs */
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

test("API regression: split-decision replay is idempotent-rejected after RETURN_SKIP and remains byte-stable across cache clear", async (t) => {
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
    `state after RETURN_SKIP expected JSON. raw=${stateAfterSkip.text}`
  );
  assert.ok(
    stateAfterSkip.json.trace && typeof stateAfterSkip.json.trace === "object",
    `state after RETURN_SKIP expected trace. raw=${stateAfterSkip.text}`
  );
  assert.equal(
    stateAfterSkip.json.trace.return_decision_required,
    false,
    `expected gate cleared after RETURN_SKIP. trace=${JSON.stringify(stateAfterSkip.json.trace)}`
  );
  assert.deepEqual(
    stateAfterSkip.json.trace.return_decision_options,
    [],
    `expected no return options after RETURN_SKIP. trace=${JSON.stringify(stateAfterSkip.json.trace)}`
  );
  assert.deepEqual(
    stateAfterSkip.json.trace.completed_ids,
    splitCompletedIds,
    `expected completed_ids preserved after RETURN_SKIP. trace=${JSON.stringify(stateAfterSkip.json.trace)}`
  );
  assert.deepEqual(
    stateAfterSkip.json.trace.dropped_ids,
    splitRemainingIds,
    `expected dropped_ids to equal split remaining_ids. trace=${JSON.stringify(stateAfterSkip.json.trace)}`
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(stateAfterSkip.json.trace, "split_active"),
    false,
    "trace must not expose split_active"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(stateAfterSkip.json.trace, "return_gate_required"),
    false,
    "trace must not expose return_gate_required"
  );

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
    `expected persisted first COMPLETE_EXERCISE row to stay stable. got ${JSON.stringify(eventsAfterSkip.json.events[1])}`
  );

  const replaySkip = await httpJson(
    "POST",
    `${http.baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "RETURN_SKIP" } }
  );

  assert.notEqual(
    replaySkip.res.status,
    201,
    `replayed RETURN_SKIP must be rejected after ungate. raw=${replaySkip.text}`
  );
  assert.ok(
    [400, 409, 422].includes(replaySkip.res.status),
    `replayed RETURN_SKIP expected 400/409/422, got ${replaySkip.res.status}. raw=${replaySkip.text}`
  );

  const stateAfterReplayReject = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterReplayReject.res.status,
    200,
    `state after replay reject expected 200, got ${stateAfterReplayReject.res.status}. raw=${stateAfterReplayReject.text}`
  );
  assert.deepEqual(
    stateAfterReplayReject.json,
    stateAfterSkip.json,
    `state changed after rejected replay.` +
      `\nbefore=${JSON.stringify(stateAfterSkip.json)}` +
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
    eventsAfterSkip.json,
    `events changed after rejected replay.` +
      `\nbefore=${JSON.stringify(eventsAfterSkip.json)}` +
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
    stateAfterClear.json.trace.dropped_ids,
    splitRemainingIds,
    `dropped_ids changed after cache clear. trace=${JSON.stringify(stateAfterClear.json.trace)}`
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
  assert.deepEqual(
    eventsAfterClear.json.events.map((x) => x.seq),
    [1, 2, 3, 4],
    `event seq ordering changed after cache clear. got ${JSON.stringify(eventsAfterClear.json.events.map((x) => x.seq))}`
  );
  assert.deepEqual(
    eventsAfterClear.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_SKIP"],
    `persisted event history changed after cache clear. got ${JSON.stringify(eventsAfterClear.json.events)}`
  );
});