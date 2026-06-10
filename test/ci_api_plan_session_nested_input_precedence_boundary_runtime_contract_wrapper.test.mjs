import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("CI wrapper: planSession rejects sibling top-level fields when input envelope exists", () => {
  const repo = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-plan-session-input-envelope-sibling-rejection-"));
  const target = path.join(tempDir, "api_plan_session_input_envelope_sibling_rejection_runtime_contract.test.mjs");

  const lines = [
    'import test, { mock } from "node:test";',
    'import assert from "node:assert/strict";',
    'import path from "node:path";',
    'import { pathToFileURL } from "node:url";',
    '',
    'const repo = process.cwd();',
    'const distHandlerUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "sessions.handlers.js")).href;',
    'const distPlanSessionServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "plan_session_service.js")).href;',
    'const distHttpErrorsUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "http_errors.js")).href;',
    'const distSessionStateWriteServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "session_state_write_service.js")).href;',
    'const distSessionEventsQueryServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "session_events_query_service.js")).href;',
    'const distSessionStateQueryServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "session_state_query_service.js")).href;',
    '',
    'const planSessionServiceCalls = [];',
    'const badRequestCalls = [];',
    '',
    'mock.module(distPlanSessionServiceUrl, {',
    '  namedExports: {',
    '    planSessionService: async (input) => {',
    '      planSessionServiceCalls.push(input);',
    '      return { ok: true, result: { session: null }, trace: null };',
    '    }',
    '  }',
    '});',
    '',
    'mock.module(distHttpErrorsUrl, {',
    '  namedExports: {',
    '    badRequest: (message) => {',
    '      badRequestCalls.push(message);',
    '      const error = new Error(message);',
    '      error.status = 400;',
    '      return error;',
    '    },',
    '    notFound: (message) => {',
    '      const error = new Error(message);',
    '      error.status = 404;',
    '      return error;',
    '    }',
    '  }',
    '});',
    '',
    'mock.module(distSessionStateWriteServiceUrl, {',
    '  namedExports: {',
    '    appendRuntimeEventMutation: async () => { throw new Error("appendRuntimeEventMutation should not be called in this test"); },',
    '    extractRawEventFromBody: () => { throw new Error("extractRawEventFromBody should not be called in this test"); },',
    '    startSessionMutation: async () => { throw new Error("startSessionMutation should not be called in this test"); }',
    '  }',
    '});',
    '',
    'mock.module(distSessionEventsQueryServiceUrl, {',
    '  namedExports: {',
    '    listRuntimeEventsQuery: async () => { throw new Error("listRuntimeEventsQuery should not be called in this test"); }',
    '  }',
    '});',
    '',
    'mock.module(distSessionStateQueryServiceUrl, {',
    '  namedExports: {',
    '    getSessionStateQuery: async () => { throw new Error("getSessionStateQuery should not be called in this test"); },',
    '    getDecisionSummaryByRunIdQuery: async () => { throw new Error("getDecisionSummaryByRunIdQuery should not be called in this test"); }',
    '  }',
    '});',
    '',
    'const { planSession } = await import(`${distHandlerUrl}?case=${Date.now()}-${Math.random().toString(16).slice(2)}`);',
    '',
    'test("planSession runtime boundary: input envelope rejects sibling top-level fields and does not delegate", async () => {',
    '  planSessionServiceCalls.length = 0;',
    '  badRequestCalls.length = 0;',
    '',
    '  const req = {',
    '    body: {',
    '      activity: "body-level-should-not-be-accepted",',
    '      athlete_id: "body-level-should-not-be-accepted",',
    '      block_id: "body-level-should-not-be-accepted",',
    '      rogue_flag: true,',
    '      input: {',
    '        activity: "powerlifting",',
    '        athlete_id: "ath-nested",',
    '        block_id: "block-nested",',
    '        options: { mode: "nested" }',
    '      }',
    '    }',
    '  };',
    '',
    '  const res = {',
    '    statusCode: undefined,',
    '    jsonBody: undefined,',
    '    status(code) {',
    '      this.statusCode = code;',
    '      return this;',
    '    },',
    '    json(payload) {',
    '      this.jsonBody = payload;',
    '      return this;',
    '    }',
    '  };',
    '',
    '  await assert.rejects(',
    '    () => planSession(req, res),',
    '    (error) => error && error.status === 400',
    '  );',
    '',
    '  assert.equal(planSessionServiceCalls.length, 0);',
    '  assert.equal(res.statusCode, undefined);',
    '  assert.equal(res.jsonBody, undefined);',
    '  assert.equal(badRequestCalls.length, 1);',
    '  assert.match(badRequestCalls[0], /Unexpected top-level field\\(s\\):/);',
    '  assert.match(badRequestCalls[0], /activity/);',
    '  assert.match(badRequestCalls[0], /athlete_id/);',
    '  assert.match(badRequestCalls[0], /block_id/);',
    '  assert.match(badRequestCalls[0], /rogue_flag/);',
    '});'
  ];

  fs.writeFileSync(target, lines.join("\n"), "utf8");

  const out = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--test",
      target
    ],
    {
      cwd: repo,
      encoding: "utf8"
    }
  );

  try {
    if (out.status !== 0) {
      console.error(out.stdout);
      console.error(out.stderr);
    }

    assert.equal(out.status, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
