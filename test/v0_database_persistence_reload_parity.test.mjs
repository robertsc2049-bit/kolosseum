// DEV NOTE: S-V0-17 proves the database-backed runtime read path, not a new engine rule.
// The write path persists sessions and runtime events; the read path rehydrates state by
// replaying persisted rows in sequence order. Clearing the process cache must not change
// state payload bytes, event-history bytes, or terminal execution truth.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  bootHttpVerticalSlice,
  readJsonOnce,
} from "../test_support/http_e2e_harness.mjs";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

async function loadSessionStateCache(root, label) {
  const href =
    pathToFileURL(path.join(root, "dist", "src", "api", "session_state_cache.js")).href +
    `?s_v0_17_cache_label=${encodeURIComponent(label)}_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;

  const imported = await import(href);

  assert.ok(
    imported.sessionStateCache && typeof imported.sessionStateCache.clear === "function",
    "expected dist sessionStateCache.clear()"
  );

  return imported.sessionStateCache;
}

function assertStablePayload(actual, expected, label) {
  assert.equal(
    actual.text,
    expected.text,
    `${label}: raw response bytes changed.\nexpected=${expected.text}\nactual=${actual.text}`
  );

  assert.deepEqual(
    actual.json,
    expected.json,
    `${label}: JSON response changed.\nexpected=${JSON.stringify(expected.json)}\nactual=${JSON.stringify(actual.json)}`
  );
}

function assertNoEnvironmentValues(value, label) {
  const serialised = JSON.stringify(value);

  for (const forbidden of [
    "127.0.0.1",
    "localhost",
    "kolosseum_test",
    "DATABASE_URL",
    "SMOKE_NO_DB",
    process.cwd().replace(/\\/g, "/"),
    process.cwd()
  ]) {
    assert.equal(
      serialised.includes(forbidden),
      false,
      `${label}: deterministic payload must not contain environment-specific value ${forbidden}.\npayload=${serialised}`
    );
  }
}

function pickSessionId(payload, label) {
  const sessionId =
    payload?.json?.session_id ??
    payload?.json?.created_session?.session_id ??
    payload?.json?.session?.session_id ??
    payload?.json?.runtime?.session_id ??
    payload?.json?.result?.session_id ??
    null;

  assert.ok(
    typeof sessionId === "string" && sessionId.length > 0,
    `${label}: expected response to expose session_id. raw=${payload?.text}`
  );

  return sessionId;
}

function readTrace(statePayload) {
  return statePayload?.json?.trace ?? {};
}

function readExecutionStatus(statePayload) {
  return (
    statePayload?.json?.execution_status ??
    statePayload?.json?.executionState?.execution_status ??
    statePayload?.json?.execution?.status ??
    statePayload?.json?.status ??
    null
  );
}

function readCurrentExerciseId(statePayload) {
  return (
    statePayload?.json?.current_step?.exercise?.exercise_id ??
    statePayload?.json?.current_step?.exercise_id ??
    statePayload?.json?.current_exercise_id ??
    null
  );
}

function projectState(payload) {
  const trace = readTrace(payload);

  return {
    execution_status: readExecutionStatus(payload),
    current_exercise_id: readCurrentExerciseId(payload),
    trace: {
      completed_ids: Array.isArray(trace.completed_ids) ? cloneJson(trace.completed_ids) : [],
      dropped_ids: Array.isArray(trace.dropped_ids) ? cloneJson(trace.dropped_ids) : [],
      remaining_ids: Array.isArray(trace.remaining_ids) ? cloneJson(trace.remaining_ids) : [],
      return_decision_required:
        typeof trace.return_decision_required === "boolean"
          ? trace.return_decision_required
          : false,
      return_decision_options: Array.isArray(trace.return_decision_options)
        ? cloneJson(trace.return_decision_options)
        : [],
    },
    session_execution_summary: Array.isArray(payload?.json?.session_execution_summary)
      ? cloneJson(payload.json.session_execution_summary)
      : [],
    block_execution_summary: Array.isArray(payload?.json?.block_execution_summary)
      ? cloneJson(payload.json.block_execution_summary)
      : [],
  };
}

function projectEvents(payload) {
  assert.ok(
    Array.isArray(payload?.json?.events),
    `expected event-history response to expose events array. raw=${payload?.text}`
  );

  return payload.json.events.map((event) => ({
    seq: event?.seq ?? null,
    type: event?.event?.type ?? event?.type ?? null,
    exercise_id: event?.event?.exercise_id ?? event?.exercise_id ?? null,
  }));
}

async function getState(baseUrl, sessionId, label) {
  const payload = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);

  assert.equal(
    payload.res.status,
    200,
    `${label}: expected /state 200, got ${payload.res.status}. raw=${payload.text}`
  );

  assertNoEnvironmentValues(payload.json, `${label} state`);
  return payload;
}

async function getEvents(baseUrl, sessionId, label) {
  const payload = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);

  assert.equal(
    payload.res.status,
    200,
    `${label}: expected /events 200, got ${payload.res.status}. raw=${payload.text}`
  );

  assertNoEnvironmentValues(payload.json, `${label} events`);
  return payload;
}

async function appendEvent(baseUrl, sessionId, event, label) {
  const payload = await httpJson(
    "POST",
    `${baseUrl}/sessions/${sessionId}/events`,
    { event }
  );

  assert.equal(
    payload.res.status,
    201,
    `${label}: expected event append 201, got ${payload.res.status}. raw=${payload.text}`
  );

  return payload;
}

async function drainToTerminal(baseUrl, sessionId) {
  for (let i = 0; i < 32; i += 1) {
    const state = await getState(baseUrl, sessionId, `drain-state-${i}`);
    const projection = projectState(state);

    if (
      projection.execution_status === "completed" ||
      projection.execution_status === "partial"
    ) {
      return state;
    }

    const exerciseId = projection.current_exercise_id;
    assert.ok(
      typeof exerciseId === "string" && exerciseId.length > 0,
      `drain-state-${i}: expected current exercise while session is not terminal.\nprojection=${JSON.stringify(projection)}`
    );

    await appendEvent(
      baseUrl,
      sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: exerciseId },
      `drain-complete-${i}`
    );
  }

  assert.fail("session did not reach terminal state within 32 completion events");
}

async function captureReadCycle(baseUrl, sessionId, prefix, order) {
  const captures = [];

  for (let i = 0; i < order.length; i += 1) {
    const kind = order[i];

    if (kind === "state") {
      captures.push({
        kind,
        payload: await getState(baseUrl, sessionId, `${prefix}-state-${i}`),
      });
      continue;
    }

    captures.push({
      kind,
      payload: await getEvents(baseUrl, sessionId, `${prefix}-events-${i}`),
    });
  }

  return captures;
}

function firstPayload(captures, kind) {
  const found = captures.find((entry) => entry.kind === kind);
  assert.ok(found, `expected ${kind} capture`);
  return found.payload;
}

function assertCycleStable(captures, expectedState, expectedEvents, label) {
  for (const entry of captures) {
    if (entry.kind === "state") {
      assertStablePayload(entry.payload, expectedState, `${label} state`);
      assert.deepEqual(
        projectState(entry.payload),
        projectState(expectedState),
        `${label}: state projection changed`
      );
      continue;
    }

    assertStablePayload(entry.payload, expectedEvents, `${label} events`);
    assert.deepEqual(
      projectEvents(entry.payload),
      projectEvents(expectedEvents),
      `${label}: event projection changed`
    );
  }
}

test(
  "S-V0-17: persisted create/start/events reload to byte-identical state and event history",
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

    const cacheA = await loadSessionStateCache(root, "warm");
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
      `compile/create-session expected 201, got ${compile.res.status}. raw=${compile.text}`
    );

    const sessionId = pickSessionId(compile, "compile/create-session");

    const start = await httpJson("POST", `${http.baseUrl}/sessions/${sessionId}/start`, {});
    assert.equal(
      start.res.status,
      200,
      `start expected 200, got ${start.res.status}. raw=${start.text}`
    );

    const initialState = await getState(http.baseUrl, sessionId, "initial-state");
    const initialProjection = projectState(initialState);
    const firstExerciseId = initialProjection.current_exercise_id;

    assert.ok(
      typeof firstExerciseId === "string" && firstExerciseId.length > 0,
      `expected first current exercise after start.\nprojection=${JSON.stringify(initialProjection)}`
    );

    await appendEvent(
      http.baseUrl,
      sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: firstExerciseId },
      "first-complete"
    );

    const afterFirstState = await getState(http.baseUrl, sessionId, "after-first-state");
    const secondExerciseId = projectState(afterFirstState).current_exercise_id;

    assert.ok(
      typeof secondExerciseId === "string" && secondExerciseId.length > 0,
      `expected second current exercise after first completion.\nstate=${afterFirstState.text}`
    );

    await appendEvent(
      http.baseUrl,
      sessionId,
      { type: "SPLIT_SESSION" },
      "split"
    );

    const splitState = await getState(http.baseUrl, sessionId, "split-state");
    assert.equal(
      projectState(splitState).trace.return_decision_required,
      true,
      `split must require an explicit return decision.\nprojection=${JSON.stringify(projectState(splitState))}`
    );

    await appendEvent(
      http.baseUrl,
      sessionId,
      { type: "RETURN_CONTINUE" },
      "return-continue"
    );

    const afterContinueState = await getState(http.baseUrl, sessionId, "after-continue-state");
    assert.equal(
      projectState(afterContinueState).current_exercise_id,
      secondExerciseId,
      `RETURN_CONTINUE must resume at the same persisted current exercise.\nstate=${afterContinueState.text}`
    );

    await drainToTerminal(http.baseUrl, sessionId);

    const warmCycle = await captureReadCycle(
      http.baseUrl,
      sessionId,
      "warm",
      ["state", "events", "state", "events"]
    );

    const warmState = firstPayload(warmCycle, "state");
    const warmEvents = firstPayload(warmCycle, "events");

    assert.equal(
      projectState(warmState).execution_status,
      "completed",
      `expected completed terminal state before reload.\nprojection=${JSON.stringify(projectState(warmState))}`
    );

    assert.deepEqual(
      projectState(warmState).trace.dropped_ids,
      [],
      `completed path must not drop work.\nprojection=${JSON.stringify(projectState(warmState))}`
    );

    assert.deepEqual(
      projectEvents(warmEvents).map((event) => event.seq),
      Array.from({ length: projectEvents(warmEvents).length }, (_, i) => i + 1),
      `runtime event seq must remain contiguous from persisted event history.\nevents=${warmEvents.text}`
    );

    assertCycleStable(warmCycle, warmState, warmEvents, "warm mixed read cycle");

    const cacheB = await loadSessionStateCache(root, "cold-a");
    cacheB.clear();

    const coldCycleA = await captureReadCycle(
      http.baseUrl,
      sessionId,
      "cold-a",
      ["events", "state", "events", "state"]
    );

    assertCycleStable(coldCycleA, warmState, warmEvents, "cold mixed read cycle A");

    const cacheC = await loadSessionStateCache(root, "cold-b");
    cacheC.clear();

    const coldCycleB = await captureReadCycle(
      http.baseUrl,
      sessionId,
      "cold-b",
      ["state", "state", "events", "events"]
    );

    assertCycleStable(coldCycleB, warmState, warmEvents, "cold mixed read cycle B");
  }
);