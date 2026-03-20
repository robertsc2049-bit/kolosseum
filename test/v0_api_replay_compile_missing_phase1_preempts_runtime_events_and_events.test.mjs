/* test/v0_api_replay_compile_missing_phase1_preempts_runtime_events_and_events.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
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

function assertBadRequest(payload, expectedFragment, label) {
  assert.equal(
    payload.res.status,
    400,
    `${label}: expected 400, got ${payload.res.status}. raw=${payload.text}`
  );

  assert.match(
    payload.text,
    new RegExp(expectedFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${label}: expected error fragment "${expectedFragment}". raw=${payload.text}`
  );
}

function assertExactParity(a, b, labelA, labelB) {
  assert.equal(
    a.res.status,
    b.res.status,
    `${labelA}/${labelB}: status drifted. a=${a.res.status} b=${b.res.status}`
  );

  assert.equal(
    a.text,
    b.text,
    `${labelA}/${labelB}: raw payload drifted.` +
      `\n${labelA}=${a.text}` +
      `\n${labelB}=${b.text}`
  );

  assert.deepEqual(
    a.json,
    b.json,
    `${labelA}/${labelB}: JSON payload drifted.` +
      `\n${labelA}=${JSON.stringify(a.json)}` +
      `\n${labelB}=${JSON.stringify(b.json)}`
  );
}

test(
  "test(v0): prove /blocks/compile missing phase1_input fails before replay payload parsing for runtime_events and events",
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

    const expectedMissingPhase1 = "Missing phase1_input";

    const runtimeEventsMissingPhase1 = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        runtime_events: [],
      }
    );

    const eventsMissingPhase1 = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        events: [],
      }
    );

    assertBadRequest(
      runtimeEventsMissingPhase1,
      expectedMissingPhase1,
      "runtime_events missing phase1_input"
    );
    assertBadRequest(
      eventsMissingPhase1,
      expectedMissingPhase1,
      "events missing phase1_input"
    );
    assertExactParity(
      runtimeEventsMissingPhase1,
      eventsMissingPhase1,
      "runtime_events missing phase1_input",
      "events missing phase1_input"
    );

    const runtimeEventsInvalidNonArrayMissingPhase1 = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        runtime_events: { type: "RETURN_CONTINUE" },
      }
    );

    const eventsInvalidNonArrayMissingPhase1 = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        events: { type: "RETURN_CONTINUE" },
      }
    );

    assertBadRequest(
      runtimeEventsInvalidNonArrayMissingPhase1,
      expectedMissingPhase1,
      "runtime_events invalid non-array missing phase1_input"
    );
    assertBadRequest(
      eventsInvalidNonArrayMissingPhase1,
      expectedMissingPhase1,
      "events invalid non-array missing phase1_input"
    );
    assertExactParity(
      runtimeEventsInvalidNonArrayMissingPhase1,
      eventsInvalidNonArrayMissingPhase1,
      "runtime_events invalid non-array missing phase1_input",
      "events invalid non-array missing phase1_input"
    );

    const dualKeyMissingPhase1 = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        runtime_events: [
          { type: "START_SESSION" },
          { nope: true },
        ],
        events: [
          { type: "START_SESSION" },
          { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
          { type: "SPLIT_SESSION" },
          { type: "RETURN_SKIP" },
          { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
        ],
      }
    );

    assertBadRequest(
      dualKeyMissingPhase1,
      expectedMissingPhase1,
      "dual-key missing phase1_input"
    );

    assert.doesNotMatch(
      dualKeyMissingPhase1.text,
      /Invalid runtime_events\/events \(expected array\)|Invalid runtime_events\/events \(event failed validation\)/,
      `dual-key missing phase1_input should fail before replay validation. raw=${dualKeyMissingPhase1.text}`
    );
  }
);