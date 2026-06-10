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

test("test(v0): terminal state cannot be mutated or resurrected", async (t) => {
  const http = await bootHttpVerticalSlice(t, {
    requiredFlagEnvVar: "KOLOSSEUM_STRICT_HTTP_E2E",
  });
  if (!http) return;

  const helloPath = path.join(process.cwd(), "examples", "hello_world.json");
  const phase1 = JSON.parse(await fs.readFile(helloPath, "utf8"));

  // --- compile ---
  const compile = await httpJson("POST", ${http.baseUrl}/blocks/compile, {
    phase1_input: phase1,
    runtime_events: [],
    create_session: true,
  });

  assert.equal(compile.res.status, 200);

  const sessionId =
    compile.json?.session_id ||
    compile.json?.session?.session_id ||
    compile.json?.created_session?.session_id;

  assert.ok(sessionId, "missing session_id");

  // --- start ---
  await httpJson("POST", ${http.baseUrl}/sessions//start, {});

  // --- complete all exercises ---
  await httpJson("POST", ${http.baseUrl}/sessions//events, {
    type: "COMPLETE_EXERCISE",
    exercise_id: "ex_barbell_back_squat",
  });
  await httpJson("POST", ${http.baseUrl}/sessions//events, {
    type: "COMPLETE_EXERCISE",
    exercise_id: "ex_barbell_bench_press",
  });
  await httpJson("POST", ${http.baseUrl}/sessions//events, {
    type: "COMPLETE_EXERCISE",
    exercise_id: "ex_barbell_deadlift",
  });

  // --- confirm terminal ---
  const terminal = await httpJson(
    "GET",
    ${http.baseUrl}/sessions//state
  );

  assert.equal(
    terminal.json.execution_status || terminal.json?.state?.execution_status,
    "completed",
    "expected terminal completed state"
  );

  // --- attempt mutation AFTER terminal ---
  const illegalEvent = await httpJson(
    "POST",
    ${http.baseUrl}/sessions//events,
    {
      type: "COMPLETE_EXERCISE",
      exercise_id: "ex_barbell_back_squat",
    }
  );

  // --- assert rejection ---
  assert.ok(
    illegalEvent.res.status >= 400,
    expected rejection after terminal, got 
  );

  // --- confirm state unchanged ---
  const after = await httpJson(
    "GET",
    ${http.baseUrl}/sessions//state
  );

  assert.deepEqual(
    terminal.json,
    after.json,
    "terminal state must not change after illegal mutation attempt"
  );
});