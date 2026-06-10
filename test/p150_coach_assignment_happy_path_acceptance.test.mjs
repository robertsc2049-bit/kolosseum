import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  const full = path.join(root, relPath);
  assert.ok(fs.existsSync(full), `required file missing: ${relPath}`);
  return fs.readFileSync(full, "utf8");
}

function mustNotMatch(text, patterns, label) {
  for (const pattern of patterns) {
    assert.doesNotMatch(text, pattern, `${label} must not include ${pattern}`);
  }
}

test("P150 contract doc exists and locks the v0 boundary", () => {
  const src = read("docs/v0/P150_COACH_ASSIGNMENT_HAPPY_PATH_ACCEPTANCE.md");
  assert.match(src, /P150 — Coach Assignment Happy-Path Acceptance/);
  assert.match(src, /coach-operable claim/);
  assert.match(src, /Phase 1–6 only/);
  assert.match(src, /no org, team, unit, gym, dashboard, export, or proof-layer surfaces involved/);
});

test("P150 happy-path anchor remains coach-managed and single-athlete", () => {
  const src = read("test/founder_demo_path_contract.test.mjs");
  assert.match(src, /actor_type,\s*"coach"/);
  assert.match(src, /execution_scope,\s*"coach_managed"/);
  assert.match(src, /runtime_shape,\s*"single_athlete"/);
});

test("P150 compile path exists on block handlers and routes", () => {
  const handlers = read("src/api/blocks.handlers.ts");
  const routes = read("src/api/blocks.routes.ts");

  assert.match(handlers, /compile/i, "blocks.handlers.ts must expose compile surface");
  assert.match(handlers, /createSessionFromBlock|create_session/i, "blocks.handlers.ts must expose create-session surface after compile");
  assert.match(routes, /compile/i, "blocks.routes.ts must route compile surface");

  mustNotMatch(
    handlers,
    [/\borg_managed\b/i, /\bteam\b/i, /\bunit\b/i],
    "blocks.handlers.ts"
  );
});

test("P150 execution path exists on session handlers and routes", () => {
  const handlers = read("src/api/sessions.handlers.ts");
  const routes = read("src/api/sessions.routes.ts");

  assert.match(handlers, /startSession/i, "sessions.handlers.ts must expose startSession");
  assert.match(handlers, /appendRuntimeEvent/i, "sessions.handlers.ts must expose appendRuntimeEvent");
  assert.match(handlers, /getSessionState/i, "sessions.handlers.ts must expose getSessionState");
  assert.match(handlers, /listRuntimeEvents/i, "sessions.handlers.ts must expose listRuntimeEvents");

  assert.match(routes, /start/i, "sessions.routes.ts must route start surface");
  assert.match(routes, /state/i, "sessions.routes.ts must route state surface");
  assert.match(routes, /events/i, "sessions.routes.ts must route events surface");

  mustNotMatch(
    handlers,
    [/\borg_managed\b/i, /\bteam\b/i, /\bunit\b/i],
    "sessions.handlers.ts"
  );
});

test("P150 factual artefact readback exists through neutral session state model", () => {
  const src = read("src/api/session_state_read_model.ts");

  assert.match(src, /session_state_summary/, "session_state_read_model.ts must read session_state_summary");
  assert.match(src, /planned_session/, "session_state_read_model.ts must read planned_session");
  assert.doesNotMatch(src, /\bathlete_risk\b/i, "read model must remain neutral");
  assert.doesNotMatch(src, /\breadiness\b/i, "read model must not introduce readiness scoring");
  assert.doesNotMatch(src, /\brecommend/i, "read model must not recommend");
});

test("P150 happy-path surfaces do not require proof-layer or export surfaces", () => {
  const blockHandlers = read("src/api/blocks.handlers.ts");
  const sessionHandlers = read("src/api/sessions.handlers.ts");

  const banned = [
    /evidence_activation_v1/i,
    /data_export_v1/i,
    /dashboard_v1/i,
    /phase7/i,
    /phase8/i,
    /evidence/i
  ];

  mustNotMatch(blockHandlers, banned, "blocks.handlers.ts");
  mustNotMatch(sessionHandlers, banned, "sessions.handlers.ts");
});

test("P150 repo already contains session-state execution contracts needed for the happy path", () => {
  const getStateContract = read("test/api_get_session_state_executed_handler_http_contract.test.mjs");
  const startContract = read("test/api_start_session_executed_handler_http_contract.test.mjs");
  const appendContract = read("test/api_append_runtime_event_executed_handler_http_contract.test.mjs");

  assert.match(getStateContract, /getSessionState/);
  assert.match(startContract, /startSession/);
  assert.match(appendContract, /appendRuntimeEvent/);
});

test("P150 drift guard: excluded broader-runtime surfaces stay out of the contract itself", () => {
  const src = read("docs/v0/P150_COACH_ASSIGNMENT_HAPPY_PATH_ACCEPTANCE.md");

  assert.match(src, /org, team, unit, gym/);
  assert.match(src, /dashboard/);
  assert.match(src, /export/);
  assert.match(src, /Phase 7 truth projection/);
  assert.match(src, /Phase 8 evidence sealing/);
});