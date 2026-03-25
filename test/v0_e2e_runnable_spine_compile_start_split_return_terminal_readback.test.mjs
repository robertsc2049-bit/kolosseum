import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  bootHttpVerticalSlice,
  readJsonOnce,
} from "../test_support/http_e2e_harness.mjs";

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

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function pickSessionId(payload, label) {
  const candidates = [
    payload?.json?.session_id,
    payload?.json?.session?.session_id,
    payload?.json?.created_session?.session_id,
    payload?.json?.runtime?.session_id,
    payload?.json?.result?.session_id,
  ].filter(Boolean);

  assert.ok(
    candidates.length >= 1,
    `${label}: expected compile response to expose session_id. raw=${payload?.text}`
  );

  return String(candidates[0]);
}

function pickBlockId(payload, label) {
  const candidates = [
    payload?.json?.block_id,
    payload?.json?.block?.block_id,
    payload?.json?.created_block?.block_id,
    payload?.json?.result?.block_id,
  ].filter(Boolean);

  assert.ok(
    candidates.length >= 1,
    `${label}: expected compile response to expose block_id. raw=${payload?.text}`
  );

  return String(candidates[0]);
}

function pickStateEnvelope(payload, label) {
  assert.ok(
    payload?.json && typeof payload.json === "object",
    `${label}: expected JSON object. raw=${payload?.text}`
  );

  const candidates = [
    payload.json.state,
    payload.json.runtime_state,
    payload.json.session_state,
    payload.json.runtime?.state,
    payload.json.runtime,
    payload.json,
  ].filter(Boolean);

  const stateLike = candidates[0];
  assert.ok(
    stateLike && typeof stateLike === "object",
    `${label}: expected state envelope object. raw=${payload?.text}`
  );

  return stateLike;
}

function readTrace(stateLike) {
  return stateLike?.trace ?? {};
}

function readExecutionStatus(stateLike) {
  return (
    stateLike?.execution_status ??
    stateLike?.executionState?.execution_status ??
    stateLike?.execution?.status ??
    stateLike?.status ??
    null
  );
}

function readCurrentExerciseId(stateLike) {
  return (
    stateLike?.current_step?.exercise?.exercise_id ??
    stateLike?.current_step?.exercise_id ??
    stateLike?.current_exercise_id ??
    null
  );
}

function projectState(stateLike) {
  const trace = readTrace(stateLike);

  return {
    execution_status: readExecutionStatus(stateLike),
    current_exercise_id: readCurrentExerciseId(stateLike),
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
    session_execution_summary: Array.isArray(stateLike?.session_execution_summary)
      ? cloneJson(stateLike.session_execution_summary)
      : [],
    block_execution_summary: Array.isArray(stateLike?.block_execution_summary)
      ? cloneJson(stateLike.block_execution_summary)
      : [],
  };
}

function assertNoLegacyGateLeak(stateLike, label) {
  const trace = readTrace(stateLike);

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

function pickEventsArray(payload, label) {
  const candidates = [
    payload?.json?.events,
    payload?.json?.runtime_events,
    payload?.json?.items,
    payload?.json?.data?.events,
  ].filter(Array.isArray);

  assert.ok(
    candidates.length >= 1,
    `${label}: expected events array. raw=${payload?.text}`
  );

  return candidates[0];
}

function projectEvents(events) {
  return events.map((event) => ({
    type: event?.type ?? event?.event?.type ?? null,
    exercise_id:
      event?.exercise_id ??
      event?.event?.exercise_id ??
      event?.payload?.exercise_id ??
      null,
  }));
}

async function compileWithSession(baseUrl, phase1Input, runtimeEvents, label) {
  const payload = await httpJson("POST", `${baseUrl}/blocks/compile`, {
    phase1_input: phase1Input,
    runtime_events: runtimeEvents,
    create_session: true,
  });

  assert.ok(
    payload.res.status === 200 || payload.res.status === 201,
    `${label}: compile expected 200/201, got ${payload.res.status}. raw=${payload.text}`
  );

  return {
    payload,
    blockId: pickBlockId(payload, label),
    sessionId: pickSessionId(payload, label),
  };
}

async function startSession(baseUrl, sessionId, label) {
  const payload = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/start`, {});

  assert.equal(
    payload.res.status,
    200,
    `${label}: start expected 200, got ${payload.res.status}. raw=${payload.text}`
  );

  return payload;
}

async function appendEvent(baseUrl, sessionId, event, label) {
  const payload = await httpJson("POST", `${baseUrl}/sessions/${sessionId}/events`, event);

  assert.ok(
    payload.res.status === 200 || payload.res.status === 201,
    `${label}: append expected 200/201, got ${payload.res.status}. raw=${payload.text}`
  );

  return payload;
}

async function getState(baseUrl, sessionId, label) {
  const payload = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/state`);

  assert.equal(
    payload.res.status,
    200,
    `${label}: state expected 200, got ${payload.res.status}. raw=${payload.text}`
  );

  const stateLike = pickStateEnvelope(payload, label);
  assertNoLegacyGateLeak(stateLike, label);

  return {
    payload,
    stateLike,
    projection: projectState(stateLike),
  };
}

async function getEvents(baseUrl, sessionId, label) {
  const payload = await httpJson("GET", `${baseUrl}/sessions/${sessionId}/events`);

  assert.equal(
    payload.res.status,
    200,
    `${label}: events expected 200, got ${payload.res.status}. raw=${payload.text}`
  );

  return {
    payload,
    events: pickEventsArray(payload, label),
    projection: projectEvents(pickEventsArray(payload, label)),
  };
}

test(
  "test(v0): prove runnable spine from compile to terminal session readback for completed and partial paths",
  async (t) => {
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

    const helloPath = path.join(process.cwd(), "examples", "hello_world.json");
    const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

    const completedCompile = await compileWithSession(
      http.baseUrl,
      phase1,
      [],
      "completed-compile"
    );

    await startSession(http.baseUrl, completedCompile.sessionId, "completed-start");

    await appendEvent(
      http.baseUrl,
      completedCompile.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "completed-event-1"
    );
    await appendEvent(
      http.baseUrl,
      completedCompile.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
      "completed-event-2"
    );
    await appendEvent(
      http.baseUrl,
      completedCompile.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
      "completed-event-3"
    );

    for (let i = 0; i < 32; i++) {
      const live = await getState(http.baseUrl, completedCompile.sessionId, `completed-drain-${i}`);
      if (live.projection.execution_status === "completed" || live.projection.execution_status === "partial") {
        break;
      }

      const nextExerciseId = live.projection.current_exercise_id;
      assert.ok(
        typeof nextExerciseId === "string" && nextExerciseId.length > 0,
        `completed-drain-${i}: expected next current_exercise_id while session is live.\nprojection=${JSON.stringify(live.projection)}`
      );

      await appendEvent(
        http.baseUrl,
        completedCompile.sessionId,
        { type: "COMPLETE_EXERCISE", exercise_id: nextExerciseId },
        `completed-drain-event-${i}`
      );
    }

    const completedStateA = await getState(http.baseUrl, completedCompile.sessionId, "completed-state-A");
    const completedEventsA = await getEvents(http.baseUrl, completedCompile.sessionId, "completed-events-A");
    const completedStateB = await getState(http.baseUrl, completedCompile.sessionId, "completed-state-B");
    const completedEventsB = await getEvents(http.baseUrl, completedCompile.sessionId, "completed-events-B");

    assert.equal(
      completedStateA.projection.execution_status,
      "completed",
      `completed path must finish completed.\nprojection=${JSON.stringify(completedStateA.projection)}`
    );
    assert.equal(
      completedStateA.projection.trace.dropped_ids.length,
      0,
      `completed path must not drop work.\nprojection=${JSON.stringify(completedStateA.projection)}`
    );
    assert.deepEqual(
      completedStateA.projection,
      completedStateB.projection,
      `completed state readback must be stable.\nA=${JSON.stringify(completedStateA.projection)}\nB=${JSON.stringify(completedStateB.projection)}`
    );
    assert.deepEqual(
      completedEventsA.projection,
      completedEventsB.projection,
      `completed events readback must be stable.\nA=${JSON.stringify(completedEventsA.projection)}\nB=${JSON.stringify(completedEventsB.projection)}`
    );

    const partialCompile = await compileWithSession(
      http.baseUrl,
      phase1,
      [],
      "partial-compile"
    );

    await startSession(http.baseUrl, partialCompile.sessionId, "partial-start");

    await appendEvent(
      http.baseUrl,
      partialCompile.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      "partial-event-1"
    );
    await appendEvent(
      http.baseUrl,
      partialCompile.sessionId,
      { type: "SPLIT_SESSION" },
      "partial-event-2"
    );

    const partialDuringSplit = await getState(
      http.baseUrl,
      partialCompile.sessionId,
      "partial-state-during-split"
    );

    assert.equal(
      partialDuringSplit.projection.trace.return_decision_required,
      true,
      `split path must require explicit return decision.\nprojection=${JSON.stringify(partialDuringSplit.projection)}`
    );
    assert.deepEqual(
      [...(partialDuringSplit.projection.trace.return_decision_options ?? [])].sort(),
      ["RETURN_CONTINUE", "RETURN_SKIP"],
      `split path must surface continue/skip options.\nprojection=${JSON.stringify(partialDuringSplit.projection)}`
    );

    await appendEvent(
      http.baseUrl,
      partialCompile.sessionId,
      { type: "RETURN_SKIP" },
      "partial-event-3"
    );
    await appendEvent(
      http.baseUrl,
      partialCompile.sessionId,
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
      "partial-event-4"
    );

    let partialStateA = await getState(http.baseUrl, partialCompile.sessionId, "partial-state-A");
    let partialEventsA = await getEvents(http.baseUrl, partialCompile.sessionId, "partial-events-A");

    for (let i = 0; i < 32; i++) {
      if (partialStateA.projection.execution_status === "partial") {
        break;
      }

      assert.equal(
        partialStateA.projection.execution_status,
        "in_progress",
        `split/return skip drain should stay live until terminal partial.\nprojection=${JSON.stringify(partialStateA.projection)}`
      );

      const nextExerciseId = partialStateA.projection.current_exercise_id;
      assert.ok(
        typeof nextExerciseId === "string" && nextExerciseId.length > 0,
        `split/return skip drain ${i}: expected current_exercise_id while still live.\nprojection=${JSON.stringify(partialStateA.projection)}`
      );

      await appendEvent(
        http.baseUrl,
        partialCompile.sessionId,
        { type: "COMPLETE_EXERCISE", exercise_id: nextExerciseId },
        `partial-drain-event-${i}`
      );

      partialStateA = await getState(
        http.baseUrl,
        partialCompile.sessionId,
        `partial-state-after-skip-drain-${i}`
      );
      partialEventsA = await getEvents(
        http.baseUrl,
        partialCompile.sessionId,
        `partial-events-after-skip-drain-${i}`
      );
    }

    const partialStateB = await getState(http.baseUrl, partialCompile.sessionId, "partial-state-B");
    const partialEventsB = await getEvents(http.baseUrl, partialCompile.sessionId, "partial-events-B");

    assert.equal(
      partialStateA.projection.execution_status,
      "partial",
      `split/return skip path must finish partial.\nprojection=${JSON.stringify(partialStateA.projection)}`
    );
    assert.ok(
      partialStateA.projection.trace.dropped_ids.length >= 1,
      `split/return skip path must preserve dropped work.\nprojection=${JSON.stringify(partialStateA.projection)}`
    );
    assert.equal(
      partialStateA.projection.trace.return_decision_required,
      false,
      `terminal partial state must clear return decision requirement.\nprojection=${JSON.stringify(partialStateA.projection)}`
    );
    assert.deepEqual(
      partialStateA.projection,
      partialStateB.projection,
      `partial state readback must be stable.\nA=${JSON.stringify(partialStateA.projection)}\nB=${JSON.stringify(partialStateB.projection)}`
    );
    assert.deepEqual(
      partialEventsA.projection,
      partialEventsB.projection,
      `partial events readback must be stable.\nA=${JSON.stringify(partialEventsA.projection)}\nB=${JSON.stringify(partialEventsB.projection)}`
    );
  }
);