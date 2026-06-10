/* test/api.complete_step_events_state_parity.regression.test.mjs */
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

test("API regression: COMPLETE_EXERCISE preserves /events and /state parity across cache clear", async (t) => {
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

  const stateBefore = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateBefore.res.status,
    200,
    `state before complete expected 200, got ${stateBefore.res.status}. raw=${stateBefore.text}`
  );
  assert.ok(
    stateBefore.json && typeof stateBefore.json === "object",
    `state before complete expected JSON. raw=${stateBefore.text}`
  );
  assert.ok(
    stateBefore.json.current_step && typeof stateBefore.json.current_step === "object",
    `expected current_step before complete. raw=${stateBefore.text}`
  );
  assert.equal(
    stateBefore.json.current_step.type,
    "EXERCISE",
    `expected EXERCISE current_step before complete. raw=${stateBefore.text}`
  );

  const firstExerciseId = stateBefore.json.current_step.exercise?.exercise_id;
  assert.ok(
    typeof firstExerciseId === "string" && firstExerciseId.length > 0,
    `expected first exercise id. raw=${stateBefore.text}`
  );

  const eventsBefore = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsBefore.res.status,
    200,
    `events before complete expected 200, got ${eventsBefore.res.status}. raw=${eventsBefore.text}`
  );
  assert.ok(
    eventsBefore.json && typeof eventsBefore.json === "object",
    `events before complete expected JSON object. raw=${eventsBefore.text}`
  );
  assert.ok(
    Array.isArray(eventsBefore.json.events),
    `events before complete expected events array. raw=${eventsBefore.text}`
  );
  assert.deepEqual(
    eventsBefore.json.events.map((x) => x.seq),
    [1],
    `expected seq [1] before complete, got ${JSON.stringify(eventsBefore.json.events)}`
  );
  assert.deepEqual(
    eventsBefore.json.events.map((x) => x.event?.type),
    ["START_SESSION"],
    `expected START_SESSION only before complete, got ${JSON.stringify(eventsBefore.json.events)}`
  );

  const complete = await httpJson(
    "POST",
    `${http.baseUrl}/sessions/${sessionId}/events`,
    { event: { type: "COMPLETE_EXERCISE", exercise_id: firstExerciseId } }
  );
  assert.equal(
    complete.res.status,
    201,
    `COMPLETE_EXERCISE expected 201, got ${complete.res.status}. raw=${complete.text}`
  );

  const eventsAfter = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfter.res.status,
    200,
    `events after complete expected 200, got ${eventsAfter.res.status}. raw=${eventsAfter.text}`
  );
  assert.ok(
    eventsAfter.json && typeof eventsAfter.json === "object",
    `events after complete expected JSON object. raw=${eventsAfter.text}`
  );
  assert.ok(
    Array.isArray(eventsAfter.json.events),
    `events after complete expected events array. raw=${eventsAfter.text}`
  );
  assert.deepEqual(
    eventsAfter.json.events.map((x) => x.seq),
    [1, 2],
    `expected seq [1,2] after complete, got ${JSON.stringify(eventsAfter.json.events)}`
  );
  assert.deepEqual(
    eventsAfter.json.events.map((x) => x.event?.type),
    ["START_SESSION", "COMPLETE_EXERCISE"],
    `expected START_SESSION then COMPLETE_EXERCISE, got ${JSON.stringify(eventsAfter.json.events)}`
  );
  assert.equal(
    eventsAfter.json.events[1]?.event?.exercise_id,
    firstExerciseId,
    `expected COMPLETE_EXERCISE row to target first exercise. got ${JSON.stringify(eventsAfter.json.events[1])}`
  );

  const stateAfter = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfter.res.status,
    200,
    `state after complete expected 200, got ${stateAfter.res.status}. raw=${stateAfter.text}`
  );
  assert.ok(
    stateAfter.json && typeof stateAfter.json === "object",
    `state after complete expected JSON. raw=${stateAfter.text}`
  );
  assert.ok(
    stateAfter.json.trace && typeof stateAfter.json.trace === "object",
    `expected trace after complete. raw=${stateAfter.text}`
  );
  assert.equal(
    stateAfter.json.trace.return_decision_required,
    false,
    `did not expect return decision gate after simple complete. trace=${JSON.stringify(stateAfter.json.trace)}`
  );
  assert.ok(
    Array.isArray(stateAfter.json.trace.completed_ids),
    `expected completed_ids array. trace=${JSON.stringify(stateAfter.json.trace)}`
  );
  assert.deepEqual(
    stateAfter.json.trace.completed_ids,
    [firstExerciseId],
    `expected completed_ids to contain first exercise. trace=${JSON.stringify(stateAfter.json.trace)}`
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(stateAfter.json.trace, "split_active"),
    false,
    "trace must not expose split_active"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(stateAfter.json.trace, "return_gate_required"),
    false,
    "trace must not expose return_gate_required"
  );

  assert.ok(
    stateAfter.json.current_step && typeof stateAfter.json.current_step === "object",
    `expected current_step after complete. raw=${stateAfter.text}`
  );
  assert.equal(
    stateAfter.json.current_step.type,
    "EXERCISE",
    `expected EXERCISE current_step after complete. raw=${stateAfter.text}`
  );

  const nextExerciseId = stateAfter.json.current_step.exercise?.exercise_id;
  assert.ok(
    typeof nextExerciseId === "string" && nextExerciseId.length > 0,
    `expected next exercise id after complete. raw=${stateAfter.text}`
  );
  assert.notEqual(
    nextExerciseId,
    firstExerciseId,
    `expected next current_step to advance after complete. state=${JSON.stringify(stateAfter.json.current_step)}`
  );

  const snapshotEvents = cloneJson(eventsAfter.json);
  const snapshotState = cloneJson(stateAfter.json);

  sessionStateCache.clear();

  const eventsAfterClear = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/events`);
  assert.equal(
    eventsAfterClear.res.status,
    200,
    `events after cache clear expected 200, got ${eventsAfterClear.res.status}. raw=${eventsAfterClear.text}`
  );
  assert.deepEqual(
    eventsAfterClear.json,
    snapshotEvents,
    `expected /events payload identical after cache clear.\nbefore=${JSON.stringify(snapshotEvents)}\nafter=${JSON.stringify(eventsAfterClear.json)}`
  );

  const stateAfterClear = await httpJson("GET", `${http.baseUrl}/sessions/${sessionId}/state`);
  assert.equal(
    stateAfterClear.res.status,
    200,
    `state after cache clear expected 200, got ${stateAfterClear.res.status}. raw=${stateAfterClear.text}`
  );
  assert.deepEqual(
    stateAfterClear.json,
    snapshotState,
    `expected /state payload identical after cache clear.\nbefore=${JSON.stringify(snapshotState)}\nafter=${JSON.stringify(stateAfterClear.json)}`
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
  assert.equal(
    eventsAfterClear.json.events[1]?.event?.exercise_id,
    firstExerciseId,
    `persisted COMPLETE_EXERCISE row drifted after cache clear. got ${JSON.stringify(eventsAfterClear.json.events[1])}`
  );
  assert.deepEqual(
    stateAfterClear.json.trace.completed_ids,
    [firstExerciseId],
    `completed_ids changed after cache clear. trace=${JSON.stringify(stateAfterClear.json.trace)}`
  );
  assert.equal(
    stateAfterClear.json.current_step.exercise?.exercise_id,
    nextExerciseId,
    `current_step drifted after cache clear. current_step=${JSON.stringify(stateAfterClear.json.current_step)}`
  );
});