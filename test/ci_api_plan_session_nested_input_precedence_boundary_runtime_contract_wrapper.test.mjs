
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Keep the outer CI reporter from leaking into the nested module-mock test.
 * The nested child owns its own reporter and runs in a fresh process.
 */
function nestedTestEnv() {
  const env = {
    ...process.env
  };

  const parts =
    String(
      env.NODE_OPTIONS ?? ""
    )
      .split(/\s+/)
      .map(
        (part) => part.trim()
      )
      .filter(Boolean);

  const retained = [];

  for (
    let index = 0;
    index < parts.length;
    index += 1
  ) {
    const part =
      parts[index];

    if (
      part ===
        "--test-reporter"
    ) {
      index += 1;
      continue;
    }

    if (
      part.startsWith(
        "--test-reporter="
      )
    ) {
      continue;
    }

    retained.push(
      part
    );
  }

  if (
    retained.length > 0
  ) {
    env.NODE_OPTIONS =
      retained.join(" ");
  }
  else {
    delete env.NODE_OPTIONS;
  }

  return env;
}

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
    'const distBeta16AppPathServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "beta16_app_path_service.js")).href;',
    'const distBeta17CoachManagedServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "beta17_coach_managed_service.js")).href;',
    'const distBetaProductRecordStoreUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "beta_product_record_store.js")).href;',
    'const distBetaProductJourneyServiceUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "beta_product_journey_service.js")).href;',
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
    'mock.module(distBeta16AppPathServiceUrl, {',
    '  namedExports: {',
    '    createBeta16AcknowledgementRecord: () => { throw new Error("createBeta16AcknowledgementRecord should not be called in this test"); },',
    '    createBeta16AuthRecord: () => { throw new Error("createBeta16AuthRecord should not be called in this test"); },',
    '    createBeta16Phase1DeclarationRecord: () => { throw new Error("createBeta16Phase1DeclarationRecord should not be called in this test"); }',
    '  }',
    '});',
    '',
    'mock.module(distBeta17CoachManagedServiceUrl, {',
    '  namedExports: {',
    '    buildBeta17CoachArtefactView: () => { throw new Error("buildBeta17CoachArtefactView should not be called in this test"); },',
    '    createBeta17AssignmentRecord: () => { throw new Error("createBeta17AssignmentRecord should not be called in this test"); },',
    '    createBeta17CoachNoteRecord: () => { throw new Error("createBeta17CoachNoteRecord should not be called in this test"); },',
    '    createBeta17CoachProfileRecord: () => { throw new Error("createBeta17CoachProfileRecord should not be called in this test"); },',
    '    createBeta17RelationshipRecord: () => { throw new Error("createBeta17RelationshipRecord should not be called in this test"); }',
    '  }',
    '});',
    '',
    'mock.module(distBetaProductRecordStoreUrl, {',
    '  namedExports: {',
    '    persistBetaProductRecord: async () => { throw new Error("persistBetaProductRecord should not be called in this test"); }',
    '  }',
    '});',
    '',
    'mock.module(distBetaProductJourneyServiceUrl, {',
    '  namedExports: {',
    '    buildStoredBeta17CoachArtefactResult: async () => { throw new Error("buildStoredBeta17CoachArtefactResult should not be called in this test"); },',
    '    buildStoredBetaAthleteHistoryResult: async () => { throw new Error("buildStoredBetaAthleteHistoryResult should not be called in this test"); },',
    '    createStoredBeta17AssignmentResult: async () => { throw new Error("createStoredBeta17AssignmentResult should not be called in this test"); }',
    '  }',
    '});',
    '',
    'const { planSession } = await import(distHandlerUrl);',
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
      "--test-concurrency=1",
      target
    ],
    {
      cwd: repo,
      encoding: "utf8",
      env: nestedTestEnv()
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
