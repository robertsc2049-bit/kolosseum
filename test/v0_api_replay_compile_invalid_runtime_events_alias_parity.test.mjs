/* test/v0_api_replay_compile_invalid_runtime_events_alias_parity.test.mjs */
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

function assertBadRequestAliasParity(actual, expectedTextFragment, label) {
  assert.equal(
    actual.res.status,
    400,
    `${label}: expected 400, got ${actual.res.status}. raw=${actual.text}`
  );

  assert.match(
    actual.text,
    new RegExp(expectedTextFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${label}: expected error text fragment "${expectedTextFragment}". raw=${actual.text}`
  );
}

function assertExactAliasParity(a, b, labelA, labelB) {
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
  "test(v0): prove /blocks/compile rejects malformed runtime_events/events with exact alias parity",
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

    const nonArrayRuntimeEvents = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        runtime_events: { type: "RETURN_CONTINUE" },
      }
    );

    const nonArrayEventsAlias = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        events: { type: "RETURN_CONTINUE" },
      }
    );

    assertBadRequestAliasParity(
      nonArrayRuntimeEvents,
      "Invalid runtime_events/events (expected array)",
      "non-array runtime_events"
    );
    assertBadRequestAliasParity(
      nonArrayEventsAlias,
      "Invalid runtime_events/events (expected array)",
      "non-array events alias"
    );
    assertExactAliasParity(
      nonArrayRuntimeEvents,
      nonArrayEventsAlias,
      "non-array runtime_events",
      "non-array events alias"
    );

    const invalidMixedRuntimeEvents = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        runtime_events: [
          { type: "START_SESSION" },
          { nope: true },
        ],
      }
    );

    const invalidMixedEventsAlias = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        events: [
          { type: "START_SESSION" },
          { nope: true },
        ],
      }
    );

    assertBadRequestAliasParity(
      invalidMixedRuntimeEvents,
      "Invalid runtime_events/events (event failed validation)",
      "invalid mixed runtime_events"
    );
    assertBadRequestAliasParity(
      invalidMixedEventsAlias,
      "Invalid runtime_events/events (event failed validation)",
      "invalid mixed events alias"
    );
    assertExactAliasParity(
      invalidMixedRuntimeEvents,
      invalidMixedEventsAlias,
      "invalid mixed runtime_events",
      "invalid mixed events alias"
    );

    assert.match(
      invalidMixedRuntimeEvents.text,
      /"index"\s*:\s*1/,
      `invalid mixed runtime_events: expected badRequest index=1. raw=${invalidMixedRuntimeEvents.text}`
    );
    assert.match(
      invalidMixedEventsAlias.text,
      /"index"\s*:\s*1/,
      `invalid mixed events alias: expected badRequest index=1. raw=${invalidMixedEventsAlias.text}`
    );

    const validEmptyRuntimeEvents = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        runtime_events: [],
      }
    );

    const validEmptyEventsAlias = await httpJson(
      "POST",
      `${http.baseUrl}/blocks/compile`,
      {
        phase1_input: phase1,
        events: [],
      }
    );

    assert.ok(
      validEmptyRuntimeEvents.res.status === 200 || validEmptyRuntimeEvents.res.status === 201,
      `valid empty runtime_events expected 200/201, got ${validEmptyRuntimeEvents.res.status}. raw=${validEmptyRuntimeEvents.text}`
    );
    assert.ok(
      validEmptyEventsAlias.res.status === 200 || validEmptyEventsAlias.res.status === 201,
      `valid empty events alias expected 200/201, got ${validEmptyEventsAlias.res.status}. raw=${validEmptyEventsAlias.text}`
    );

    assertExactAliasParity(
      validEmptyRuntimeEvents,
      validEmptyEventsAlias,
      "valid empty runtime_events",
      "valid empty events alias"
    );
  }
);