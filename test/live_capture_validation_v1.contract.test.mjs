import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE_PATH = "src/api/live_capture_validation_v1.ts";

function readSource() {
  return fs.readFileSync(SOURCE_PATH, "utf8");
}

test("live capture validation v1 source contract: exports audit log and reconciliation builders", () => {
  const src = readSource();
  assert.match(src, /export\s+function\s+buildCaptureAuditLogV1\s*\(/);
  assert.match(src, /export\s+function\s+buildCaptureReconciliationV1\s*\(/);
  assert.match(src, /kind:\s*"missing_event"\s*\|\s*"mutated_event"\s*\|\s*"reordered_event"/);
  assert.match(src, /integrity_ok:\s*boolean/);
});

test("live capture validation v1 source contract: layer detects integrity issues without inventing semantics", () => {
  const src = readSource();
  assert.doesNotMatch(src, /\bpredict/i);
  assert.doesNotMatch(src, /\bforecast/i);
  assert.doesNotMatch(src, /\brecommend/i);
  assert.doesNotMatch(src, /\bscore\b/i);
  assert.doesNotMatch(src, /\brisk\b/i);
  assert.doesNotMatch(src, /\binfer/i);
  assert.doesNotMatch(src, /\brepair/i);
});

test("live capture validation v1 source contract: layer stays validation-only and avoids endpoint concerns", () => {
  const src = readSource();
  assert.doesNotMatch(src, /router\.get|router\.post|app\.get|app\.post|req\b|res\b|status\(\d+\)|json\(/);
});
