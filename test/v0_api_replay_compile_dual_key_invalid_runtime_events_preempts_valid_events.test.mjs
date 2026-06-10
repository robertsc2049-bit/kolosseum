/* test/v0_api_replay_compile_dual_key_invalid_runtime_events_preempts_valid_events.test.mjs */
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

function assertBadRequestWithFragment(payload, expectedFragment, label) {
  assert.equal(
    payload.res.status,
    400,
    `${label}: expected 400, got ${payload.res.status}. raw=${payload.text}`
  );

  assert.match(
    payload.text,
    new RegExp(expectedFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${label}: expected fragment "${expectedFragment}". raw=${payload.text}`
  );
}

test(
  "test(v0): prove /blocks/compile validates runtime_events first and rejects even when events alias is valid",
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

    const validEventsAlias = [
      { type: "START_SESSION" },
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
      { type: "SPLIT_SESSION" },
      { type: "RETURN_SKIP" },
      { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
    ];

    const invalidRuntimeEventsNonArray = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        runtime_events: { type: "RETURN_CONTINUE" },
        events: validEventsAlias,
      }
    );

    assertBadRequestWithFragment(
      invalidRuntimeEventsNonArray,
      "Invalid runtime_events/events (expected array)",
      "dual-key invalid runtime_events non-array"
    );

    const validEventsAliasOnly = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        events: validEventsAlias,
      }
    );

    assert.ok(
      validEventsAliasOnly.res.status === 200 || validEventsAliasOnly.res.status === 201,
      `events alias alone should succeed when valid. got ${validEventsAliasOnly.res.status}. raw=${validEventsAliasOnly.text}`
    );

    const invalidRuntimeEventsMixed = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        runtime_events: [
          { type: "START_SESSION" },
          { nope: true },
        ],
        events: validEventsAlias,
      }
    );

    assertBadRequestWithFragment(
      invalidRuntimeEventsMixed,
      "Invalid runtime_events/events (event failed validation)",
      "dual-key invalid runtime_events mixed"
    );

    assert.match(
      invalidRuntimeEventsMixed.text,
      /"index"\s*:\s*1/,
      `dual-key invalid runtime_events mixed: expected badRequest index=1. raw=${invalidRuntimeEventsMixed.text}`
    );

    const validRuntimeEventsWins = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        runtime_events: validEventsAlias,
        events: [
          { type: "START_SESSION" },
          { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_back_squat" },
          { type: "SPLIT_SESSION" },
          { type: "RETURN_CONTINUE" },
          { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_bench_press" },
          { type: "COMPLETE_EXERCISE", exercise_id: "ex_barbell_deadlift" },
        ],
      }
    );

    assert.ok(
      validRuntimeEventsWins.res.status === 200 || validRuntimeEventsWins.res.status === 201,
      `valid runtime_events should still win when both keys are present. got ${validRuntimeEventsWins.res.status}. raw=${validRuntimeEventsWins.text}`
    );
  }
);