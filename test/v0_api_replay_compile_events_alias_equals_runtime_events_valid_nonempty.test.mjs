/* test/v0_api_replay_compile_events_alias_equals_runtime_events_valid_nonempty.test.mjs */
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
  return stateLike?.current_step?.exercise?.exercise_id ?? null;
}

function projectReplaySurface(stateLike) {
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

function extractReplayStateEnvelope(replayPayload, label) {
  assert.ok(
    replayPayload.json && typeof replayPayload.json === "object",
    `${label}: expected JSON object from replay compile. raw=${replayPayload.text}`
  );

  const candidates = [
    replayPayload.json.runtime_state,
    replayPayload.json.state,
    replayPayload.json.session_state,
    replayPayload.json.runtime?.state,
    replayPayload.json.runtime,
  ].filter(Boolean);

  assert.ok(
    candidates.length >= 1,
    `${label}: could not find replay state envelope in compile response.\nraw=${replayPayload.text}`
  );

  const stateLike = candidates[0];
  assert.ok(
    stateLike && typeof stateLike === "object",
    `${label}: replay state candidate must be object.\nraw=${replayPayload.text}`
  );

  return stateLike;
}

function requireEventTypes(replayPayload, label) {
  const raw = replayPayload?.json?.events;
  assert.ok(
    Array.isArray(raw),
    `${label}: expected compile replay response to expose events array.\nraw=${replayPayload?.text}`
  );
  return raw.map((x) => x?.type ?? x?.event?.type ?? null);
}

async function replayProjection(baseUrl, phase1, body, label) {
  const replay = await httpJson("POST", `${baseUrl}/blocks/compile`, body);

  assert.ok(
    replay.res.status === 200 || replay.res.status === 201,
    `${label}: replay compile expected 200/201, got ${replay.res.status}. raw=${replay.text}`
  );

  const replayState = extractReplayStateEnvelope(replay, label);
  assertNoLegacyGateLeak(replayState, label);

  return {
    replay,
    state: replayState,
    projection: projectReplaySurface(replayState),
    eventTypes: requireEventTypes(replay, label),
  };
}

test(
  "test(v0): prove /blocks/compile events alias is replay-equivalent to runtime_events for same valid non-empty payloads",
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

    const continueEvents = [
      { type: "START_SESSION" },
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      { type: "SPLIT_SESSION" },
      { type: "RETURN_CONTINUE" },
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
    ];

    const skipEvents = [
      { type: "START_SESSION" },
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      { type: "SPLIT_SESSION" },
      { type: "RETURN_SKIP" },
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
    ];

    const continueRuntime = await replayProjection(
      http.baseUrl,
      phase1,
      { phase1_input: phase1, runtime_events: continueEvents },
      "continue-runtime"
    );

    const continueAlias = await replayProjection(
      http.baseUrl,
      phase1,
      { phase1_input: phase1, events: continueEvents },
      "continue-alias"
    );

    const skipRuntime = await replayProjection(
      http.baseUrl,
      phase1,
      { phase1_input: phase1, runtime_events: skipEvents },
      "skip-runtime"
    );

    const skipAlias = await replayProjection(
      http.baseUrl,
      phase1,
      { phase1_input: phase1, events: skipEvents },
      "skip-alias"
    );

    assert.deepEqual(
      continueAlias.projection,
      continueRuntime.projection,
      `continue alias projection drifted from runtime_events.\nalias=${JSON.stringify(continueAlias.projection)}\nruntime=${JSON.stringify(continueRuntime.projection)}`
    );

    assert.deepEqual(
      continueAlias.eventTypes,
      continueRuntime.eventTypes,
      `continue alias surfaced event sequence drifted from runtime_events.\nalias=${JSON.stringify(continueAlias.eventTypes)}\nruntime=${JSON.stringify(continueRuntime.eventTypes)}`
    );

    assert.deepEqual(
      skipAlias.projection,
      skipRuntime.projection,
      `skip alias projection drifted from runtime_events.\nalias=${JSON.stringify(skipAlias.projection)}\nruntime=${JSON.stringify(skipRuntime.projection)}`
    );

    assert.deepEqual(
      skipAlias.eventTypes,
      skipRuntime.eventTypes,
      `skip alias surfaced event sequence drifted from runtime_events.\nalias=${JSON.stringify(skipAlias.eventTypes)}\nruntime=${JSON.stringify(skipRuntime.eventTypes)}`
    );

    assert.equal(
      continueRuntime.projection.execution_status,
      "completed",
      `continue runtime path should be completed.\nprojection=${JSON.stringify(continueRuntime.projection)}`
    );

    assert.equal(
      continueAlias.projection.execution_status,
      "completed",
      `continue alias path should be completed.\nprojection=${JSON.stringify(continueAlias.projection)}`
    );

    assert.equal(
      skipRuntime.projection.execution_status,
      "partial",
      `skip runtime path should be partial.\nprojection=${JSON.stringify(skipRuntime.projection)}`
    );

    assert.equal(
      skipAlias.projection.execution_status,
      "partial",
      `skip alias path should be partial.\nprojection=${JSON.stringify(skipAlias.projection)}`
    );

    assert.equal(
      continueAlias.projection.trace.dropped_ids.length,
      0,
      `continue alias path should preserve no-drop truth.\nprojection=${JSON.stringify(continueAlias.projection)}`
    );

    assert.ok(
      skipAlias.projection.trace.dropped_ids.length >= 1,
      `skip alias path should preserve dropped work.\nprojection=${JSON.stringify(skipAlias.projection)}`
    );
  }
);