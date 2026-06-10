/* test/v0_api_replay_compile_repeat_byte_stable_full_response_surface.test.mjs */
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

async function replayOnce(baseUrl, body, label) {
  const replay = await httpJson("POST", `${baseUrl}/blocks/compile`, body);

  assert.ok(
    replay.res.status === 200 || replay.res.status === 201,
    `${label}: replay compile expected 200/201, got ${replay.res.status}. raw=${replay.text}`
  );

  const stateLike = extractReplayStateEnvelope(replay, label);
  assertNoLegacyGateLeak(stateLike, label);

  return {
    replay,
    stateLike,
    projection: projectReplaySurface(stateLike),
    eventTypes: requireEventTypes(replay, label),
  };
}

test(
  "test(v0): prove repeated identical replay compile requests are byte-stable across full response surface",
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

    const continueBody = { phase1_input: phase1, runtime_events: continueEvents };
    const skipBody = { phase1_input: phase1, runtime_events: skipEvents };

    const continueA = await replayOnce(http.baseUrl, continueBody, "continue-A");
    const continueB = await replayOnce(http.baseUrl, continueBody, "continue-B");
    const continueC = await replayOnce(http.baseUrl, continueBody, "continue-C");

    assert.equal(
      continueA.replay.text,
      continueB.replay.text,
      `continue replay raw payload drifted between A and B.\nA=${continueA.replay.text}\nB=${continueB.replay.text}`
    );
    assert.equal(
      continueA.replay.text,
      continueC.replay.text,
      `continue replay raw payload drifted between A and C.\nA=${continueA.replay.text}\nC=${continueC.replay.text}`
    );
    assert.deepEqual(
      continueA.replay.json,
      continueB.replay.json,
      `continue replay JSON drifted between A and B.\nA=${JSON.stringify(continueA.replay.json)}\nB=${JSON.stringify(continueB.replay.json)}`
    );
    assert.deepEqual(
      continueA.replay.json,
      continueC.replay.json,
      `continue replay JSON drifted between A and C.\nA=${JSON.stringify(continueA.replay.json)}\nC=${JSON.stringify(continueC.replay.json)}`
    );
    assert.deepEqual(
      continueA.projection,
      continueB.projection,
      `continue replay projection drifted between A and B.\nA=${JSON.stringify(continueA.projection)}\nB=${JSON.stringify(continueB.projection)}`
    );
    assert.deepEqual(
      continueA.projection,
      continueC.projection,
      `continue replay projection drifted between A and C.\nA=${JSON.stringify(continueA.projection)}\nC=${JSON.stringify(continueC.projection)}`
    );
    assert.deepEqual(
      continueA.eventTypes,
      continueB.eventTypes,
      `continue replay surfaced events drifted between A and B.\nA=${JSON.stringify(continueA.eventTypes)}\nB=${JSON.stringify(continueB.eventTypes)}`
    );
    assert.deepEqual(
      continueA.eventTypes,
      continueC.eventTypes,
      `continue replay surfaced events drifted between A and C.\nA=${JSON.stringify(continueA.eventTypes)}\nC=${JSON.stringify(continueC.eventTypes)}`
    );

    assert.equal(
      continueA.projection.execution_status,
      "completed",
      `continue replay should remain completed.\nprojection=${JSON.stringify(continueA.projection)}`
    );
    assert.equal(
      continueA.projection.trace.dropped_ids.length,
      0,
      `continue replay should preserve no-drop truth.\nprojection=${JSON.stringify(continueA.projection)}`
    );

    const skipA = await replayOnce(http.baseUrl, skipBody, "skip-A");
    const skipB = await replayOnce(http.baseUrl, skipBody, "skip-B");
    const skipC = await replayOnce(http.baseUrl, skipBody, "skip-C");

    assert.equal(
      skipA.replay.text,
      skipB.replay.text,
      `skip replay raw payload drifted between A and B.\nA=${skipA.replay.text}\nB=${skipB.replay.text}`
    );
    assert.equal(
      skipA.replay.text,
      skipC.replay.text,
      `skip replay raw payload drifted between A and C.\nA=${skipA.replay.text}\nC=${skipC.replay.text}`
    );
    assert.deepEqual(
      skipA.replay.json,
      skipB.replay.json,
      `skip replay JSON drifted between A and B.\nA=${JSON.stringify(skipA.replay.json)}\nB=${JSON.stringify(skipB.replay.json)}`
    );
    assert.deepEqual(
      skipA.replay.json,
      skipC.replay.json,
      `skip replay JSON drifted between A and C.\nA=${JSON.stringify(skipA.replay.json)}\nC=${JSON.stringify(skipC.replay.json)}`
    );
    assert.deepEqual(
      skipA.projection,
      skipB.projection,
      `skip replay projection drifted between A and B.\nA=${JSON.stringify(skipA.projection)}\nB=${JSON.stringify(skipB.projection)}`
    );
    assert.deepEqual(
      skipA.projection,
      skipC.projection,
      `skip replay projection drifted between A and C.\nA=${JSON.stringify(skipA.projection)}\nC=${JSON.stringify(skipC.projection)}`
    );
    assert.deepEqual(
      skipA.eventTypes,
      skipB.eventTypes,
      `skip replay surfaced events drifted between A and B.\nA=${JSON.stringify(skipA.eventTypes)}\nB=${JSON.stringify(skipB.eventTypes)}`
    );
    assert.deepEqual(
      skipA.eventTypes,
      skipC.eventTypes,
      `skip replay surfaced events drifted between A and C.\nA=${JSON.stringify(skipA.eventTypes)}\nC=${JSON.stringify(skipC.eventTypes)}`
    );

    assert.equal(
      skipA.projection.execution_status,
      "partial",
      `skip replay should remain partial.\nprojection=${JSON.stringify(skipA.projection)}`
    );
    assert.ok(
      skipA.projection.trace.dropped_ids.length >= 1,
      `skip replay should preserve dropped work.\nprojection=${JSON.stringify(skipA.projection)}`
    );
  }
);