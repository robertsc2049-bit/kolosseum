/* test/api.events_append_only_history.regression.test.mjs */
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

test("API regression: /events remains append-only and byte-stable across split/continue and cache clear", async (t) => {
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

  const ev1 = await httpJson(
    "POST",
    `${http.baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "COMPLETE_EXERCISE", exercise_id: firstExerciseId } }
  );
  assert.equal(
    ev1.res.status,
    201,
    `COMPLETE_EXERCISE expected 201, got ${ev1.res.status}. raw=${ev1.text}`
  );

  const events1 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    events1.res.status,
    200,
    `events after first complete expected 200, got ${events1.res.status}. raw=${events1.text}`
  );
  assert.ok(
    events1.json && typeof events1.json === "object",
    `events1 expected JSON object. raw=${events1.text}`
  );
  assert.ok(
    Array.isArray(events1.json.events),
    `events1 expected events array. raw=${events1.text}`
  );
  assert.deepEqual(
    events1.json.events.map((x) => x.seq),
    [1, 2],
    `expected seq [1,2], got ${JSON.stringify(events1.json.events)}`
  );
  assert.deepEqual(
    events1.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE"],
    `expected START_SESSION then COMPLETE_EXERCISE, got ${JSON.stringify(events1.json.events)}`
  );
  assert.equal(
    events1.json.events[1]?.event?.exercise_id,
    firstExerciseId,
    `expected persisted first COMPLETE_EXERCISE id, got ${JSON.stringify(events1.json.events[1])}`
  );

  const snapshotBeforeSplit = cloneJson(events1.json);

  const ev2 = await httpJson(
    "POST",
    `${http.baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "SPLIT_SESSION" } }
  );
  assert.equal(
    ev2.res.status,
    201,
    `SPLIT_SESSION expected 201, got ${ev2.res.status}. raw=${ev2.text}`
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
    `expected split to gate return decision. trace=${JSON.stringify(splitState.json.trace)}`
  );
  assert.deepEqual(
    [...splitState.json.trace.return_decision_options].slice().sort(),
    ["RETURN_CONTINUE", "RETURN_SKIP"],
    `expected both return options. trace=${JSON.stringify(splitState.json.trace)}`
  );

  const ev3 = await httpJson(
    "POST",
    `${http.baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "RETURN_CONTINUE" } }
  );
  assert.equal(
    ev3.res.status,
    201,
    `RETURN_CONTINUE expected 201, got ${ev3.res.status}. raw=${ev3.text}`
  );

  const events2 = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    events2.res.status,
    200,
    `events after continue expected 200, got ${events2.res.status}. raw=${events2.text}`
  );
  assert.ok(
    events2.json && typeof events2.json === "object",
    `events2 expected JSON object. raw=${events2.text}`
  );
  assert.ok(
    Array.isArray(events2.json.events),
    `events2 expected events array. raw=${events2.text}`
  );

  const rows2 = events2.json.events;
  assert.equal(rows2.length, 4, `expected 4 events after continue, got ${rows2.length}`);
  assert.deepEqual(
    cloneJson(rows2.slice(0, 2)),
    snapshotBeforeSplit.events,
    "historical event rows must remain unchanged after split/continue appends"
  );
  assert.deepEqual(
    rows2.map((x) => x.seq),
    [1, 2, 3, 4],
    `expected seq [1,2,3,4], got ${JSON.stringify(rows2.map((x) => x.seq))}`
  );
  assert.deepEqual(
    rows2.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE", "SPLIT_SESSION", "RETURN_CONTINUE"],
    `expected ordered event types, got ${JSON.stringify(rows2.map((x) => x.event?.type))}`
  );
  assert.equal(
    rows2[1]?.event?.exercise_id,
    firstExerciseId,
    `expected original COMPLETE_EXERCISE row unchanged, got ${JSON.stringify(rows2[1])}`
  );

  const stateAfterContinue = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterContinue.res.status,
    200,
    `state after continue expected 200, got ${stateAfterContinue.res.status}. raw=${stateAfterContinue.text}`
  );
  assert.ok(
    stateAfterContinue.json && typeof stateAfterContinue.json === "object",
    `state after continue expected JSON. raw=${stateAfterContinue.text}`
  );
  assert.equal(
    stateAfterContinue.json.trace?.return_decision_required,
    false,
    `expected return gate cleared after continue. trace=${JSON.stringify(stateAfterContinue.json.trace)}`
  );

  const beforeClearEvents = cloneJson(events2.json);
  const beforeClearState = cloneJson(stateAfterContinue.json);

  sessionStateCache.clear();

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
  assert.equal(
    eventsAfterClear.json.events[1]?.event?.exercise_id,
    firstExerciseId,
    `persisted COMPLETE_EXERCISE row drifted after cache clear. got ${JSON.stringify(eventsAfterClear.json.events[1])}`
  );
});