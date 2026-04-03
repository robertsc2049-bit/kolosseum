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

const bannedHistoryWidening = [
  /\branking/i,
  /\bleaderboard/i,
  /\breadiness/i,
  /\badvice/i,
  /\brecommend/i,
  /\bscoring/i,
  /\bcoach(ing)? judgment/i
];

test("P155 doc exists and locks the minimal factual history boundary", () => {
  const src = read("docs/v0/P155_SESSION_HISTORY_COUNTS_CONTRACT.md");
  assert.match(src, /# P155/);
  assert.match(src, /Session History Counts Contract/);
  assert.match(src, /v0 session history must stay factual and minimal/i);
  assert.match(src, /counts, dates, durations, and completion state/i);
  assert.match(src, /The history surface must not widen into rankings, readiness, advice, recommendations, or scoring/i);
});

test("P155 read model remains the factual source boundary", () => {
  const src = read("src/api/session_state_read_model.ts");
  assert.match(src, /buildSessionExecutionSummary/, "session_state_read_model.ts must expose session execution summary");
  assert.match(src, /buildBlockExecutionSummary/, "session_state_read_model.ts must expose block execution summary");
  assert.match(src, /execution_status/, "session_state_read_model.ts must carry execution status");
  assert.match(src, /work_items_done/, "session_state_read_model.ts must carry work item counts");
  assert.match(src, /work_items_total/, "session_state_read_model.ts must carry work item totals");
  mustNotMatch(src, bannedHistoryWidening, "src/api/session_state_read_model.ts");
});

test("P155 session execution summary stays factual and minimal", () => {
  const src = read("src/api/session_state_read_model.ts");

  assert.match(src, /session_ended/, "session execution summary must expose completion fact");
  assert.match(src, /work_items_done/, "session execution summary must expose done count");
  assert.match(src, /work_items_total/, "session execution summary must expose total count");
  assert.match(src, /split_entered/, "session execution summary must expose split-entered fact");
  assert.match(src, /split_return_decision/, "session execution summary must expose split-return decision fact");
  assert.match(src, /execution_status/, "session execution summary must expose execution status fact");

  mustNotMatch(src, bannedHistoryWidening, "session execution summary source");
});

test("P155 block execution summary stays count-based and factual", () => {
  const src = read("src/api/session_state_read_model.ts");

  assert.match(src, /sessions_total/, "block execution summary must expose sessions_total");
  assert.match(src, /sessions_ended/, "block execution summary must expose sessions_ended");
  assert.match(src, /work_items_done/, "block execution summary must expose work_items_done");
  assert.match(src, /work_items_total/, "block execution summary must expose work_items_total");

  mustNotMatch(src, bannedHistoryWidening, "block execution summary source");
});

test("P155 API and consumer surfaces remain factual and minimal", () => {
  const queryService = read("src/api/session_state_query_service.ts");
  const getStateContract = read("test/api_get_session_state_executed_handler_http_contract.test.mjs");
  const publicTraceContract = read("test/api_session_state_public_trace_contract.regression.test.mjs");

  assert.match(queryService, /normalizeSummary/, "query service must normalize summary rather than widen it");
  assert.match(getStateContract, /getSessionState/i, "get session state contract must exist");
  assert.match(publicTraceContract, /session/i, "public trace contract must exist");

  mustNotMatch(queryService, bannedHistoryWidening, "src/api/session_state_query_service.ts");
  mustNotMatch(getStateContract, bannedHistoryWidening, "api_get_session_state_executed_handler_http_contract.test.mjs");
  mustNotMatch(publicTraceContract, bannedHistoryWidening, "api_session_state_public_trace_contract.regression.test.mjs");
});

test("P155 neutral aggregation contract keeps scored or inferred outputs banned", () => {
  const src = read("test/session_state_read_model_neutral_aggregation.contract.test.mjs");

  assert.match(src, /adherence_score/, "neutral aggregation contract must ban adherence_score");
  assert.match(src, /fatigue_score/, "neutral aggregation contract must ban fatigue_score");
  assert.match(src, /athlete_risk/, "neutral aggregation contract must ban athlete_risk");
  assert.match(src, /recommendation/, "neutral aggregation contract must ban recommendation");
  assert.match(src, /doesNotMatch/, "neutral aggregation contract must enforce banned fields with doesNotMatch checks");
});

test("P155 contract explicitly bans widening claims", () => {
  const src = read("docs/v0/P155_SESSION_HISTORY_COUNTS_CONTRACT.md");
  assert.match(src, /## Explicit Exclusions/);
  assert.match(src, /- rankings/);
  assert.match(src, /- readiness/);
  assert.match(src, /- advice/);
  assert.match(src, /- recommendations/);
  assert.match(src, /- scoring/);
});