import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("CI wrapper: planSession input-envelope vs direct-body parity passes with experimental module mocks", () => {
  const repo = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-plan-session-input-envelope-vs-direct-"));
  const target = path.join(tempDir, "api_plan_session_input_envelope_vs_direct_body_runtime_contract.test.mjs");

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
    'test("planSession runtime boundary: explicit input envelope and direct body delegate the same payload and preserve the same success shape", async () => {',
    '  planSessionServiceCalls.length = 0;',
    '',
    '  const payload = {',
    '    activity: "powerlifting",',
    '    athlete_id: "ath-1",',
    '    block_id: "block-1",',
    '    options: { mode: "test" }',
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
    '      input_envelope_vs_direct_body_parity: true',
    '    },',
    '    service_only_field: "must-not-leak"',
    '  };',
    '',
    '  planSessionServiceImpl = async () => expectedOut;',
    '',
    '  const directReq = makeReq(payload);',
    '  const envelopedReq = makeReq({ input: payload });',
    '  const directRes = makeRes();',
    '  const envelopedRes = makeRes();',
    '',
    '  await planSession(directReq, directRes);',
    '  await planSession(envelopedReq, envelopedRes);',
    '',
    '  assert.equal(planSessionServiceCalls.length, 2);',
    '  assert.deepEqual(planSessionServiceCalls[0], payload);',
    '  assert.deepEqual(planSessionServiceCalls[1], payload);',
    '  assert.deepEqual(planSessionServiceCalls[0], planSessionServiceCalls[1]);',
    '',
    '  assert.equal(directRes.statusCode, 200);',
    '  assert.equal(envelopedRes.statusCode, 200);',
    '',
    '  assert.deepEqual(directRes.jsonBody, envelopedRes.jsonBody);',
    '  assert.deepEqual(directRes.jsonBody, {',
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
