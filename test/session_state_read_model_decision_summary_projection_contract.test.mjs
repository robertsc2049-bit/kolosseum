import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE_PATH = "src/api/session_state_read_model.ts";

function readSource() {
  return fs.readFileSync(SOURCE_PATH, "utf8");
}

test("decision summary projection source contract: read model exports the projection builder entrypoint", () => {
  const src = readSource();
  assert.match(src, /export\s+async\s+function\s+buildCoachSessionDecisionSummaryFromRunId\s*\(/);
});

test("decision summary projection source contract: exported payload type includes required top-level groups", () => {
  const src = readSource();
  assert.match(src, /export\s+type\s+CoachSessionDecisionSummary\s*=\s*\{/);
  assert.match(src, /schema:\s*Record<string,\s*unknown>/);
  assert.match(src, /identity:\s*\{/);
  assert.match(src, /currentness:\s*\{/);
  assert.match(src, /outcome:\s*Record<string,\s*unknown>/);
  assert.match(src, /drivers:\s*unknown\[\]/);
  assert.match(src, /timeline:\s*Record<string,\s*unknown>/);
  assert.match(src, /audit:\s*Record<string,\s*unknown>/);
  assert.match(src, /issues:\s*unknown\[\]/);
});

test("decision summary projection source contract: identity is keyed by run_id for TICKET-A happy path", () => {
  const src = readSource();
  assert.match(src, /run_id:\s*string/);
  assert.match(src, /identity:\s*\{\s*run_id:\s*runId\s*\}/s);
});

test("decision summary projection source contract: currentness state enum is explicit and closed", () => {
  const src = readSource();
  assert.match(src, /state:\s*"current"\s*\|\s*"stale"\s*\|\s*"superseded"\s*\|\s*"incomplete"/);
});

test("decision summary projection source contract: builder exposes explicit invalid_input and not_found failures", () => {
  const src = readSource();
  assert.match(src, /throw new Error\("invalid_input: run_id required"\)/);
  assert.match(src, /throw new Error\("not_found: run_id"\)/);
});

test("decision summary projection source contract: builder derives currentness deterministically from explicit flags", () => {
  const src = readSource();
  assert.match(src, /const isStale = Boolean\(run\.is_stale\)/);
  assert.match(src, /const isSuperseded = Boolean\(run\.is_superseded\)/);
  assert.match(src, /const isIncomplete = Boolean\(run\.is_incomplete\)/);
  assert.match(src, /if \(isIncomplete\)\s*\{\s*currentness = "incomplete"\s*\}\s*else if \(isSuperseded\)\s*\{\s*currentness = "superseded"\s*\}\s*else if \(isStale\)\s*\{\s*currentness = "stale"\s*\}/s);
});

test("decision summary projection source contract: builder maps required audit and timeline fields", () => {
  const src = readSource();
  assert.match(src, /timeline:\s*\{\s*created_at:\s*run\.created_at\s*\?\?\s*null,\s*completed_at:\s*run\.completed_at\s*\?\?\s*null\s*\}/s);
  assert.match(src, /audit:\s*\{\s*source:\s*"engine_run",\s*resolved_from:\s*"run_id"\s*\}/s);
});

test("decision summary projection source contract: builder keeps read-model scope and does not embed endpoint concerns", () => {
  const src = readSource();
  assert.doesNotMatch(src, /router\.get|app\.get|req\b|res\b|status\(\d+\)|json\(/);
});

test("decision summary projection source contract: builder loads authoritative truth from engine run persistence seam", () => {
  const src = readSource();
  assert.match(src, /import\("\\.\/engine_run_persistence_service"\)/);
});