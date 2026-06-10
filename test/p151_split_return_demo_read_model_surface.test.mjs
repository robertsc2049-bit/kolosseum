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

test("P151 contract doc exists and locks the factual split-return summary boundary", () => {
  const src = read("docs/v0/P151_SPLIT_RETURN_DEMO_READ_MODEL_SURFACE.md");
  assert.match(src, /# P151/);
  assert.match(src, /Split\/Return Demo Read Model Surface/);
  assert.match(src, /without reading raw runtime event streams/);
  assert.match(src, /split_entered/);
  assert.match(src, /split_return_decision/);
  assert.match(src, /execution_status/);
  assert.match(src, /No advisory, safety, recommendation, optimisation, or narrative language is permitted/);
});

test("P151 session state read model remains the factual summary surface", () => {
  const src = read("src/api/session_state_read_model.ts");

  assert.match(src, /session_state_summary/, "session_state_read_model.ts must read session_state_summary");
  assert.match(src, /planned_session/, "session_state_read_model.ts must read planned_session");

  mustNotMatch(
    src,
    [/\brecommend/i, /\bshould\b/i, /\bsafer?\b/i, /\breadiness\b/i, /\boptimi[sz]/i],
    "session_state_read_model.ts"
  );
});

test("P151 existing split-return regression surfaces exist in repo", () => {
  const required = [
    "test/api.return_gate.regression.test.mjs",
    "test/api.return_continue_append_only_history.regression.test.mjs",
    "test/api.return_skip.regression.test.mjs",
    "test/api.state_replay_projection_after_return_continue.regression.test.mjs",
    "test/api.state_replay_projection_after_split_decisions.regression.test.mjs"
  ];

  for (const relPath of required) {
    const full = path.join(root, relPath);
    assert.ok(fs.existsSync(full), `required split/return regression surface missing: ${relPath}`);
  }
});

test("P151 session handlers expose summary and raw-event surfaces separately", () => {
  const src = read("src/api/sessions.handlers.ts");

  assert.match(src, /getSessionState/i, "sessions.handlers.ts must expose getSessionState");
  assert.match(src, /listRuntimeEvents/i, "sessions.handlers.ts must expose listRuntimeEvents");
});

test("P151 contract explicitly excludes raw event stream as required demo surface", () => {
  const src = read("docs/v0/P151_SPLIT_RETURN_DEMO_READ_MODEL_SURFACE.md");

  assert.match(src, /deterministic summary surface/);
  assert.match(src, /raw event stream as required demo surface/i);
  assert.match(src, /without opening raw runtime events/i);
});

test("P151 read-model and session-state contract surfaces already project split-return outcomes", () => {
  const projectionA = read("test/api.state_replay_projection_after_return_continue.regression.test.mjs");
  const projectionB = read("test/api.state_replay_projection_after_split_decisions.regression.test.mjs");
  const summaryContract = read("test/api_session_state_public_trace_contract.regression.test.mjs");
  const neutralAggregation = read("test/session_state_read_model_neutral_aggregation.contract.test.mjs");

  assert.match(projectionA, /return/i, "projection test must cover return continue surface");
  assert.match(projectionB, /split/i, "projection test must cover split decision surface");
  assert.match(summaryContract, /session/i, "public trace contract must exist for session state surface");
  assert.doesNotMatch(neutralAggregation, /\bathlete_risk\b/i, "neutral aggregation must remain non-advisory");
});

test("P151 deterministic projection intent is anchored to the existing query/read surfaces", () => {
  const queryService = read("src/api/session_state_query_service.ts");
  const readModel = read("src/api/session_state_read_model.ts");

  assert.match(queryService, /session_state_read_model\.js/, "query service must bind to read model");
  assert.match(queryService, /normalizeSummary/, "query service must normalize summary deterministically");
  assert.match(readModel, /export/i, "read model file should expose callable projection helpers");
});

test("P151 excluded broader-runtime and proof-layer surfaces stay out of the contract", () => {
  const src = read("docs/v0/P151_SPLIT_RETURN_DEMO_READ_MODEL_SURFACE.md");

  assert.match(src, /no org, team, unit, dashboard, export, or proof-layer surfaces are required/);
  assert.match(src, /Phase 7 truth projection/);
  assert.match(src, /Phase 8 evidence sealing/);
});

test("P151 contract and read-model surfaces remain non-advisory in operative language", () => {
  const contract = read("docs/v0/P151_SPLIT_RETURN_DEMO_READ_MODEL_SURFACE.md");
  const readModel = read("src/api/session_state_read_model.ts");

  const bannedContractOperative = [
    /\byou should\b/i,
    /\bshould continue\b/i,
    /\bshould skip\b/i,
    /\brecommended path\b/i,
    /\bbest option\b/i,
    /\bbetter option\b/i,
    /\bsafer option\b/i,
    /\bprotect/i
  ];

  const bannedReadModel = [
    /\brecommend/i,
    /\bshould\b/i,
    /\bbetter\b/i,
    /\bbest\b/i,
    /\bsafer?\b/i,
    /\bprotect/i,
    /\boptim/i
  ];

  mustNotMatch(contract, bannedContractOperative, "P151 contract operative language");
  mustNotMatch(readModel, bannedReadModel, "session_state_read_model.ts");
});