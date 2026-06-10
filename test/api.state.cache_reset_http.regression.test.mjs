/* test/api.state.cache_reset_http.regression.test.mjs */
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

test("API regression: /state remains byte-stable across cache reset after runtime progress", async (t) => {
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
    `COMPLETE_EXERCISE expected 201, got ${complete1.res.status}. raw=${complete1.text}`
  );

  const stateAfterProgress = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterProgress.res.status,
    200,
    `state after progress expected 200, got ${stateAfterProgress.res.status}. raw=${stateAfterProgress.text}`
  );
  assert.ok(
    stateAfterProgress.json && typeof stateAfterProgress.json === "object",
    `state after progress expected JSON. raw=${stateAfterProgress.text}`
  );
  assert.ok(
    stateAfterProgress.json.trace && typeof stateAfterProgress.json.trace === "object",
    `state after progress expected trace. raw=${stateAfterProgress.text}`
  );
  assert.deepEqual(
    stateAfterProgress.json.trace.completed_ids,
    [firstExerciseId],
    `expected completed_ids to contain first exercise. trace=${JSON.stringify(stateAfterProgress.json.trace)}`
  );
  assert.equal(
    stateAfterProgress.json.trace.return_decision_required,
    false,
    `did not expect return decision gate. trace=${JSON.stringify(stateAfterProgress.json.trace)}`
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(stateAfterProgress.json.trace, "split_active"),
    false,
    "trace must not expose split_active"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(stateAfterProgress.json.trace, "return_gate_required"),
    false,
    "trace must not expose return_gate_required"
  );

  const nextExerciseId = stateAfterProgress.json.current_step?.exercise?.exercise_id;
  assert.ok(
    typeof nextExerciseId === "string" && nextExerciseId.length > 0,
    `expected next exercise id after progress. raw=${stateAfterProgress.text}`
  );
  assert.notEqual(
    nextExerciseId,
    firstExerciseId,
    `expected current_step to advance after progress. current_step=${JSON.stringify(stateAfterProgress.json.current_step)}`
  );

  const eventsAfterProgress = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterProgress.res.status,
    200,
    `events after progress expected 200, got ${eventsAfterProgress.res.status}. raw=${eventsAfterProgress.text}`
  );
  assert.ok(
    eventsAfterProgress.json && typeof eventsAfterProgress.json === "object",
    `events after progress expected JSON object. raw=${eventsAfterProgress.text}`
  );
  assert.ok(
    Array.isArray(eventsAfterProgress.json.events),
    `events after progress expected events array. raw=${eventsAfterProgress.text}`
  );
  assert.deepEqual(
    eventsAfterProgress.json.events.map((x) => x.seq),
    [1, 2],
    `expected seq [1,2], got ${JSON.stringify(eventsAfterProgress.json.events)}`
  );
  assert.deepEqual(
    eventsAfterProgress.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE"],
    `expected START_SESSION then COMPLETE_EXERCISE, got ${JSON.stringify(eventsAfterProgress.json.events)}`
  );
  assert.equal(
    eventsAfterProgress.json.events[1]?.event?.exercise_id,
    firstExerciseId,
    `expected persisted COMPLETE_EXERCISE row to target first exercise. got ${JSON.stringify(eventsAfterProgress.json.events[1])}`
  );

  const beforeClearState = cloneJson(stateAfterProgress.json);
  const beforeClearEvents = cloneJson(eventsAfterProgress.json);

  sessionStateCache.clear();

  const stateAfterClear = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterClear.res.status,
    200,
    `state after cache clear expected 200, got ${stateAfterClear.res.status}. raw=${stateAfterClear.text}`
  );
  assert.deepEqual(
    stateAfterClear.json,
    beforeClearState,
    `expected /state payload identical after cache clear.\nbefore=${JSON.stringify(beforeClearState)}\nafter=${JSON.stringify(stateAfterClear.json)}`
  );

  const eventsAfterClear = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterClear.res.status,
    200,
    `events after cache clear expected 200, got ${eventsAfterClear.res.status}. raw=${eventsAfterClear.text}`
  );
  assert.deepEqual(
    eventsAfterClear.json,
    beforeClearEvents,
    `expected /events payload identical after cache clear.\nbefore=${JSON.stringify(beforeClearEvents)}\nafter=${JSON.stringify(eventsAfterClear.json)}`
  );

  assert.deepEqual(
    stateAfterClear.json.trace.completed_ids,
    [firstExerciseId],
    `completed_ids changed after cache clear. trace=${JSON.stringify(stateAfterClear.json.trace)}`
  );
  assert.equal(
    stateAfterClear.json.current_step?.exercise?.exercise_id,
    nextExerciseId,
    `current_step drifted after cache clear. current_step=${JSON.stringify(stateAfterClear.json.current_step)}`
  );
  assert.deepEqual(
    eventsAfterClear.json.events.map((x) => x.seq),
    [1, 2],
    `event seq ordering changed after cache clear. got ${JSON.stringify(eventsAfterClear.json.events.map((x) => x.seq))}`
  );
  assert.deepEqual(
    eventsAfterClear.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE"],
    `persisted event history changed after cache clear. got ${JSON.stringify(eventsAfterClear.json.events)}`
  );
});