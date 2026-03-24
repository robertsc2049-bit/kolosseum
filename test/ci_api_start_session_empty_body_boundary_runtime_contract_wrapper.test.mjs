import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("CI wrapper: startSession empty-body boundary passes with experimental module mocks", () => {
  const repo = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-start-session-empty-body-"));
  const target = path.join(tempDir, "api_start_session_empty_body_boundary_runtime_contract.test.mjs");

  const lines = [
    'import test, { mock } from "node:test";',
    'import assert from "node:assert/strict";',
    'import path from "node:path";',
    'import { pathToFileURL } from "node:url";',
    '',
    'const repo = process.cwd();',
    'const distHandlerUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "sessions.handlers.js")).href;',
    'const distHttpErrorsUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "http_errors.js")).href;',
    'const distSessionStateWriteServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "session_state_write_service.js")).href;',
    'const distSessionEventsQueryServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "session_events_query_service.js")).href;',
    'const distSessionStateQueryServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "session_state_query_service.js")).href;',
    'const distPlanSessionServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "plan_session_service.js")).href;',
    '',
    'const startSessionMutationCalls = [];',
    'const badRequestCalls = [];',
    '',
    'let startSessionMutationImpl = async () => ({',
    '  ok: true,',
    '  session: null,',
    '  trace: null',
    '});',
    '',
    'mock.module(distSessionStateWriteServiceUrl, {',
    '  namedExports: {',
    '    appendRuntimeEventMutation: async () => { throw new Error("appendRuntimeEventMutation should not be called in this test"); },',
    '    extractRawEventFromBody: () => { throw new Error("extractRawEventFromBody should not be called in this test"); },',
    '    startSessionMutation: async (sessionId) => {',
    '      startSessionMutationCalls.push(sessionId);',
    '      return await startSessionMutationImpl(sessionId);',
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
    'mock.module(distPlanSessionServiceUrl, {',
    '  namedExports: {',
    '    planSessionService: async () => { throw new Error("planSessionService should not be called in this test"); }',
    '  }',
    '});',
    '',
    'function makeReq(body) {',
    '  return {',
    '    params: { session_id: "session-1" },',
    '    body',
    '  };',
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
    'const { startSession } = await import(`${distHandlerUrl}?case=${Date.now()}-${Math.random().toString(16).slice(2)}`);',
    '',
    'test("startSession runtime boundary: undefined, null, and empty object bodies are accepted without shape drift and preserve pass-through success shape", async () => {',
    '  startSessionMutationCalls.length = 0;',
    '  badRequestCalls.length = 0;',
    '',
    '  const expectedOut = {',
    '    ok: true,',
    '    session: {',
    '      id: "session-1",',
    '      status: "started"',
    '    },',
    '    trace: {',
    '      source: "wrapper-test",',
    '      empty_body_boundary: true',
    '    },',
    '    service_only_field: "must-leak-because-handler-is-pass-through"',
    '  };',
    '',
    '  startSessionMutationImpl = async () => expectedOut;',
    '',
    '  const undefinedReq = makeReq(undefined);',
    '  const nullReq = makeReq(null);',
    '  const emptyReq = makeReq({});',
    '  const undefinedRes = makeRes();',
    '  const nullRes = makeRes();',
    '  const emptyRes = makeRes();',
    '',
    '  await startSession(undefinedReq, undefinedRes);',
    '  await startSession(nullReq, nullRes);',
    '  await startSession(emptyReq, emptyRes);',
    '',
    '  assert.deepEqual(startSessionMutationCalls, ["session-1", "session-1", "session-1"]);',
    '  assert.deepEqual(badRequestCalls, []);',
    '',
    '  assert.equal(undefinedRes.statusCode, 200);',
    '  assert.equal(nullRes.statusCode, 200);',
    '  assert.equal(emptyRes.statusCode, 200);',
    '',
    '  assert.deepEqual(undefinedRes.jsonBody, nullRes.jsonBody);',
    '  assert.deepEqual(nullRes.jsonBody, emptyRes.jsonBody);',
    '  assert.deepEqual(undefinedRes.jsonBody, expectedOut);',
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
