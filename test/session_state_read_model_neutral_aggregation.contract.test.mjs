import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE_PATH = "src/api/session_state_read_model.ts";

function readSource() {
  return fs.readFileSync(SOURCE_PATH, "utf8");
}

test("neutral aggregation source contract: read model exports neutral aggregation type and builder", () => {
  const src = readSource();
  assert.match(src, /export\s+type\s+NeutralSessionAggregation\s*=\s*\{/);
  assert.match(src, /export\s+function\s+buildNeutralSessionAggregation\s*\(/);
});

test("neutral aggregation source contract: output shape is counts totals explicit boolean and passthrough execution status only", () => {
  const src = readSource();
  assert.match(src, /total_events:\s*number/);
  assert.match(src, /total_completed_exercises:\s*number/);
  assert.match(src, /total_dropped_exercises:\s*number/);
  assert.match(src, /split_count:\s*number/);
  assert.match(src, /has_return_decision:\s*boolean/);
  assert.match(src, /last_event_seq:\s*number\s*\|\s*null/);
  assert.match(src, /completed_ids_count:\s*number/);
  assert.match(src, /dropped_ids_count:\s*number/);
  assert.match(src, /remaining_ids_count:\s*number/);
  assert.match(src, /execution_status:\s*"ready"\s*\|\s*"in_progress"\s*\|\s*"completed"\s*\|\s*"partial"\s*\|\s*null/);
});

test("neutral aggregation source contract: builder remains descriptive and does not expose inferred or scored fields", () => {
  const src = readSource();
  assert.doesNotMatch(src, /\badherence_score\b/);
  assert.doesNotMatch(src, /\bathlete_risk\b/);
  assert.doesNotMatch(src, /\blikely_dropout\b/);
  assert.doesNotMatch(src, /\bengagement_grade\b/);
  assert.doesNotMatch(src, /\bpredicted_completion\b/);
  assert.doesNotMatch(src, /\bfatigue_score\b/);
  assert.doesNotMatch(src, /\brecommendation\b/);
});

test("neutral aggregation source contract: builder reads explicit source facts only and stays out of endpoint concerns", () => {
  const src = readSource();
  assert.match(src, /source\?\.(execution_status|event_log)/);
  assert.match(src, /trace\.(completed_ids|dropped_ids|remaining_ids|event_count|event_type_counts|last_seq_no)/);
  assert.match(src, /runtime\.(completed_ids|dropped_ids|remaining_ids|event_count|event_type_counts|last_seq_no|return_decision_required|split_entered|split_active|execution_status)/);
  assert.doesNotMatch(src, /router\.get|app\.get|req\b|res\b|status\(\d+\)|json\(/);
});
