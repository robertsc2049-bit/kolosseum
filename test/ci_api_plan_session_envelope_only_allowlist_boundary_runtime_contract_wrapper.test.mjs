import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("CI wrapper: planSession envelope-only allowlist boundary passes with experimental module mocks", () => {
  const repo = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-plan-session-envelope-only-allowlist-"));
  const target = path.join(tempDir, "api_plan_session_envelope_only_allowlist_boundary_runtime_contract.test.mjs");

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
    '',
    'let planSessionServiceImpl = async () => ({',
    '  ok: true,',
    '  result: { session: null },',
    '  trace: null',
    '});',
    '',
    'mock.module(distPlanSessionServiceUrl, {',
    '  namedExports: {',
    '    planSessionService: async (input) => {',
    '      planSessionServiceCalls.push(input);',
    '      return await planSessionServiceImpl(input);',
    '    }',
    '  }',
    '});',
    '',
    'mock.module(distHttpErrorsUrl, {',
    '  namedExports: {',
    '    badRequest: (message) => {',
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
    'function makeReq(body) {',
    '  return { body };',
    '}',
    '',
    'function makeRes() {',
    '  return {',
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
    '}',
    '',
    'const { planSession } = await import(`${distHandlerUrl}?case=${Date.now()}-${Math.random().toString(16).slice(2)}`);',
    '',
    'test("planSession runtime boundary: minimal envelope-only top-level shape is accepted, delegates only body.input, and preserves flattened success shape", async () => {',
    '  planSessionServiceCalls.length = 0;',
    '',
    '  const payload = {',
    '    activity: "powerlifting",',
    '    athlete_id: "ath-1",',
    '    block_id: "block-1",',
    '    options: { mode: "envelope-only" }',
    '  };',
    '',
    '  const expectedOut = {',
    '    ok: true,',
    '    result: {',
    '      session: {',
    '        id: "session-1",',
    '        exercises: [],',
    '        activity: "powerlifting"',
    '      }',
    '    },',
    '    trace: {',
    '      source: "wrapper-test",',
    '      envelope_only_allowlist_boundary: true',
    '    },',
    '    service_only_field: "must-not-leak"',
    '  };',
    '',
    '  planSessionServiceImpl = async () => expectedOut;',
    '',
    '  const req = makeReq({ input: payload });',
    '  const res = makeRes();',
    '',
    '  await planSession(req, res);',
    '',
    '  assert.equal(planSessionServiceCalls.length, 1);',
    '  assert.deepEqual(planSessionServiceCalls[0], payload);',
    '  assert.deepEqual(Object.keys(req.body), ["input"]);',
    '',
    '  assert.equal(res.statusCode, 200);',
    '  assert.deepEqual(res.jsonBody, {',
    '    ok: true,',
    '    session: expectedOut.result.session,',
    '    trace: expectedOut.trace',
    '  });',
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
