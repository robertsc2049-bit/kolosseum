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

function extractReplayStateEnvelope(payload) {
  return (
    payload?.json?.runtime_state ??
    payload?.json?.replay_state ??
    payload?.json?.state ??
    payload?.json?.session_state ??
    payload?.json?.runtime?.state ??
    payload?.json?.runtime ??
    payload?.json?.result?.runtime_state ??
    payload?.json?.result?.replay_state ??
    payload?.json?.result?.state ??
    payload?.json?.result?.session_state ??
    payload?.json?.result?.session ??
    null
  );
}

test("test(v0): /blocks/compile treats START_SESSION replay marker as a no-op against accepted compile replay surface", async (t) => {
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
  const phase1Input = JSON.parse(await fs.readFile(helloPath, "utf8"));

  const withoutStart = await httpJson("POST", `${http.baseUrl}/blocks/compile`, {
    phase1_input: phase1Input,
    runtime_events: [],
  });

  const withStart = await httpJson("POST", `${http.baseUrl}/blocks/compile`, {
    phase1_input: phase1Input,
    runtime_events: [{ type: "START_SESSION" }],
  });

  assert.ok(
    withoutStart.res.status === 200 || withoutStart.res.status === 201,
    `withoutStart expected 200/201, got ${withoutStart.res.status}. raw=${withoutStart.text}`
  );

  assert.ok(
    withStart.res.status === 200 || withStart.res.status === 201,
    `withStart expected 200/201, got ${withStart.res.status}. raw=${withStart.text}`
  );

  const a = extractReplayStateEnvelope(withoutStart);
  const b = extractReplayStateEnvelope(withStart);

  assert.ok(a, `withoutStart: expected replay state envelope. raw=${withoutStart.text}`);
  assert.ok(b, `withStart: expected replay state envelope. raw=${withStart.text}`);

  assert.deepEqual(
    projectReplaySurface(b),
    projectReplaySurface(a),
    `START_SESSION should be replay-no-op at compile boundary.` +
      `\nwithoutStart=${JSON.stringify(projectReplaySurface(a))}` +
      `\nwithStart=${JSON.stringify(projectReplaySurface(b))}`
  );
});
