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

async function compileWithSession(baseUrl, phase1Input, label) {
  const payload = await httpJson("POST", `${baseUrl}/blocks/compile`, {
    phase1_input: phase1Input,
    runtime_events: [],
    create_session: true,
  });

  assert.ok(
    payload.res.status === 200 || payload.res.status === 201,
    `${label}: compile expected 200/201, got ${payload.res.status}. raw=${payload.text}`
  );

  return {
    payload,
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

  const events = pickEventsArray(payload, label);
  return {
    payload,
    events,
    projection: projectEvents(events),
  };
}

async function buildCompletedTerminal(baseUrl, phase1) {
  const compiled = await compileWithSession(baseUrl, phase1, "completed-compile");
  await startSession(baseUrl, compiled.sessionId, "completed-start");

  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
    "completed-1"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
    "completed-2"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
    "completed-3"
  );

  return compiled.sessionId;
}

async function buildPartialTerminal(baseUrl, phase1) {
  const compiled = await compileWithSession(baseUrl, phase1, "partial-compile");
  await startSession(baseUrl, compiled.sessionId, "partial-start");

  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
    "partial-1"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "SPLIT_SESSION" },
    "partial-split"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "RETURN_SKIP" },
    "partial-return-skip"
  );
  await appendEvent(
    baseUrl,
    compiled.sessionId,
    { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
    "partial-2"
  );

  return compiled.sessionId;
}

async function readMixedStateEventsState(baseUrl, sessionId, prefix) {
  const stateA = await getState(baseUrl, sessionId, `${prefix}-state-A`);
  const eventsA = await getEvents(baseUrl, sessionId, `${prefix}-events-A`);
  const stateB = await getState(baseUrl, sessionId, `${prefix}-state-B`);

  return {
    stateA,
    eventsA,
    stateB,
  };
}

async function readMixedEventsStateEvents(baseUrl, sessionId, prefix) {
  const eventsA = await getEvents(baseUrl, sessionId, `${prefix}-events-A`);
  const stateA = await getState(baseUrl, sessionId, `${prefix}-state-A`);
  const eventsB = await getEvents(baseUrl, sessionId, `${prefix}-events-B`);

  return {
    eventsA,
    stateA,
    eventsB,
  };
}

async function readMixedStateEventsStateEvents(baseUrl, sessionId, prefix) {
  const stateA = await getState(baseUrl, sessionId, `${prefix}-state-A`);
  const eventsA = await getEvents(baseUrl, sessionId, `${prefix}-events-A`);
  const stateB = await getState(baseUrl, sessionId, `${prefix}-state-B`);
  const eventsB = await getEvents(baseUrl, sessionId, `${prefix}-events-B`);

  return {
    stateA,
    eventsA,
    stateB,
    eventsB,
  };
}

async function readMixedEventsStateEventsState(baseUrl, sessionId, prefix) {
  const eventsA = await getEvents(baseUrl, sessionId, `${prefix}-events-A`);
  const stateA = await getState(baseUrl, sessionId, `${prefix}-state-A`);
  const eventsB = await getEvents(baseUrl, sessionId, `${prefix}-events-B`);
  const stateB = await getState(baseUrl, sessionId, `${prefix}-state-B`);

  return {
    eventsA,
    stateA,
    eventsB,
    stateB,
  };
}

function assertCompletedTerminalSemantics(stateProjection, label) {
  assert.equal(
    stateProjection.execution_status,
    "completed",
    `${label}: expected completed terminal state.\nprojection=${JSON.stringify(stateProjection)}`
  );
  assert.equal(
    stateProjection.trace.dropped_ids.length,
    0,
    `${label}: completed terminal must not drop work.\nprojection=${JSON.stringify(stateProjection)}`
  );
  assert.equal(
    stateProjection.trace.return_decision_required,
    false,
    `${label}: completed terminal must not require return decision.\nprojection=${JSON.stringify(stateProjection)}`
  );
}

function assertPartialTerminalSemantics(stateProjection, label) {
  assert.equal(
    stateProjection.execution_status,
    "partial",
    `${label}: expected partial terminal state.\nprojection=${JSON.stringify(stateProjection)}`
  );
  assert.ok(
    stateProjection.trace.dropped_ids.length >= 1,
    `${label}: partial terminal must preserve dropped work.\nprojection=${JSON.stringify(stateProjection)}`
  );
  assert.equal(
    stateProjection.trace.return_decision_required,
    false,
    `${label}: partial terminal must keep return gate cleared.\nprojection=${JSON.stringify(stateProjection)}`
  );
}

function assertMixedReadParity(result, label) {
  const stateReads = [];
  const eventReads = [];

  for (const value of Object.values(result)) {
    if (value?.projection?.trace) {
      stateReads.push(value.projection);
    } else if (Array.isArray(value?.projection)) {
      eventReads.push(value.projection);
    }
  }

  for (let i = 1; i < stateReads.length; i += 1) {
    assert.deepEqual(
      stateReads[0],
      stateReads[i],
      `${label}: state projection drifted across mixed read order.\nFIRST=${JSON.stringify(stateReads[0])}\nOTHER=${JSON.stringify(stateReads[i])}`
    );
  }

  for (let i = 1; i < eventReads.length; i += 1) {
    assert.deepEqual(
      eventReads[0],
      eventReads[i],
      `${label}: events projection drifted across mixed read order.\nFIRST=${JSON.stringify(eventReads[0])}\nOTHER=${JSON.stringify(eventReads[i])}`
    );
  }
}

test(
  "test(v0): completed and partial terminal projections remain parity-stable across mixed state/events read order",
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

    const completedSessionId = await buildCompletedTerminal(http.baseUrl, phase1);
    const partialSessionId = await buildPartialTerminal(http.baseUrl, phase1);

    const completedSeq1 = await readMixedStateEventsState(
      http.baseUrl,
      completedSessionId,
      "completed-seq1"
    );
    const completedSeq2 = await readMixedEventsStateEvents(
      http.baseUrl,
      completedSessionId,
      "completed-seq2"
    );
    const completedSeq3 = await readMixedStateEventsStateEvents(
      http.baseUrl,
      completedSessionId,
      "completed-seq3"
    );
    const completedSeq4 = await readMixedEventsStateEventsState(
      http.baseUrl,
      completedSessionId,
      "completed-seq4"
    );

    const partialSeq1 = await readMixedStateEventsState(
      http.baseUrl,
      partialSessionId,
      "partial-seq1"
    );
    const partialSeq2 = await readMixedEventsStateEvents(
      http.baseUrl,
      partialSessionId,
      "partial-seq2"
    );
    const partialSeq3 = await readMixedStateEventsStateEvents(
      http.baseUrl,
      partialSessionId,
      "partial-seq3"
    );
    const partialSeq4 = await readMixedEventsStateEventsState(
      http.baseUrl,
      partialSessionId,
      "partial-seq4"
    );

    assertCompletedTerminalSemantics(
      completedSeq1.stateA.projection,
      "completed-seq1-state-A"
    );
    assertCompletedTerminalSemantics(
      completedSeq2.stateA.projection,
      "completed-seq2-state-A"
    );
    assertCompletedTerminalSemantics(
      completedSeq3.stateA.projection,
      "completed-seq3-state-A"
    );
    assertCompletedTerminalSemantics(
      completedSeq4.stateA.projection,
      "completed-seq4-state-A"
    );

    assertPartialTerminalSemantics(
      partialSeq1.stateA.projection,
      "partial-seq1-state-A"
    );
    assertPartialTerminalSemantics(
      partialSeq2.stateA.projection,
      "partial-seq2-state-A"
    );
    assertPartialTerminalSemantics(
      partialSeq3.stateA.projection,
      "partial-seq3-state-A"
    );
    assertPartialTerminalSemantics(
      partialSeq4.stateA.projection,
      "partial-seq4-state-A"
    );

    assertMixedReadParity(completedSeq1, "completed-seq1");
    assertMixedReadParity(completedSeq2, "completed-seq2");
    assertMixedReadParity(completedSeq3, "completed-seq3");
    assertMixedReadParity(completedSeq4, "completed-seq4");

    assertMixedReadParity(partialSeq1, "partial-seq1");
    assertMixedReadParity(partialSeq2, "partial-seq2");
    assertMixedReadParity(partialSeq3, "partial-seq3");
    assertMixedReadParity(partialSeq4, "partial-seq4");

    assert.deepEqual(
      completedSeq1.stateA.projection,
      completedSeq2.stateA.projection,
      `completed terminal state must remain identical across mixed read sequences.\nSEQ1=${JSON.stringify(completedSeq1.stateA.projection)}\nSEQ2=${JSON.stringify(completedSeq2.stateA.projection)}`
    );
    assert.deepEqual(
      completedSeq1.stateA.projection,
      completedSeq3.stateA.projection,
      `completed terminal state must remain identical across longer mixed read sequences.\nSEQ1=${JSON.stringify(completedSeq1.stateA.projection)}\nSEQ3=${JSON.stringify(completedSeq3.stateA.projection)}`
    );
    assert.deepEqual(
      completedSeq1.stateA.projection,
      completedSeq4.stateA.projection,
      `completed terminal state must remain identical across events-first mixed read sequences.\nSEQ1=${JSON.stringify(completedSeq1.stateA.projection)}\nSEQ4=${JSON.stringify(completedSeq4.stateA.projection)}`
    );

    assert.deepEqual(
      completedSeq1.eventsA.projection,
      completedSeq2.eventsA.projection,
      `completed terminal events must remain identical across mixed read sequences.\nSEQ1=${JSON.stringify(completedSeq1.eventsA.projection)}\nSEQ2=${JSON.stringify(completedSeq2.eventsA.projection)}`
    );
    assert.deepEqual(
      completedSeq1.eventsA.projection,
      completedSeq3.eventsA.projection,
      `completed terminal events must remain identical across longer mixed read sequences.\nSEQ1=${JSON.stringify(completedSeq1.eventsA.projection)}\nSEQ3=${JSON.stringify(completedSeq3.eventsA.projection)}`
    );
    assert.deepEqual(
      completedSeq1.eventsA.projection,
      completedSeq4.eventsA.projection,
      `completed terminal events must remain identical across events-first mixed read sequences.\nSEQ1=${JSON.stringify(completedSeq1.eventsA.projection)}\nSEQ4=${JSON.stringify(completedSeq4.eventsA.projection)}`
    );

    assert.deepEqual(
      partialSeq1.stateA.projection,
      partialSeq2.stateA.projection,
      `partial terminal state must remain identical across mixed read sequences.\nSEQ1=${JSON.stringify(partialSeq1.stateA.projection)}\nSEQ2=${JSON.stringify(partialSeq2.stateA.projection)}`
    );
    assert.deepEqual(
      partialSeq1.stateA.projection,
      partialSeq3.stateA.projection,
      `partial terminal state must remain identical across longer mixed read sequences.\nSEQ1=${JSON.stringify(partialSeq1.stateA.projection)}\nSEQ3=${JSON.stringify(partialSeq3.stateA.projection)}`
    );
    assert.deepEqual(
      partialSeq1.stateA.projection,
      partialSeq4.stateA.projection,
      `partial terminal state must remain identical across events-first mixed read sequences.\nSEQ1=${JSON.stringify(partialSeq1.stateA.projection)}\nSEQ4=${JSON.stringify(partialSeq4.stateA.projection)}`
    );

    assert.deepEqual(
      partialSeq1.eventsA.projection,
      partialSeq2.eventsA.projection,
      `partial terminal events must remain identical across mixed read sequences.\nSEQ1=${JSON.stringify(partialSeq1.eventsA.projection)}\nSEQ2=${JSON.stringify(partialSeq2.eventsA.projection)}`
    );
    assert.deepEqual(
      partialSeq1.eventsA.projection,
      partialSeq3.eventsA.projection,
      `partial terminal events must remain identical across longer mixed read sequences.\nSEQ1=${JSON.stringify(partialSeq1.eventsA.projection)}\nSEQ3=${JSON.stringify(partialSeq3.eventsA.projection)}`
    );
    assert.deepEqual(
      partialSeq1.eventsA.projection,
      partialSeq4.eventsA.projection,
      `partial terminal events must remain identical across events-first mixed read sequences.\nSEQ1=${JSON.stringify(partialSeq1.eventsA.projection)}\nSEQ4=${JSON.stringify(partialSeq4.eventsA.projection)}`
    );
  }
);