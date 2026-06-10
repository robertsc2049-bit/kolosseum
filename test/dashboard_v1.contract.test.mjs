import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE_PATH = "src/api/dashboard_v1.ts";

function readSource() {
  return fs.readFileSync(SOURCE_PATH, "utf8");
}

test("dashboard v1 source contract: exports a presentation-only builder with closed top-level shape", () => {
  const src = readSource();
  assert.match(src, /export\s+function\s+buildMinimalDashboardV1\s*\(/);
  assert.match(src, /export\s+type\s+MinimalDashboardV1\s*=\s*\{/);
  assert.match(src, /presentation_mode:\s*"standard"\s*\|\s*"nd_compact"/);
  assert.match(src, /truth:\s*MinimalDashboardTruth/);
  assert.match(src, /cards:\s*MinimalDashboardMetricCard\[\]/);
});

test("dashboard v1 source contract: presentation never mutates engine or data truth", () => {
  const src = readSource();
  assert.doesNotMatch(src, /\bupdate\b/i);
  assert.doesNotMatch(src, /\bmutate\b/i);
  assert.doesNotMatch(src, /\bwrite\b/i);
  assert.doesNotMatch(src, /\binsert\b/i);
  assert.doesNotMatch(src, /\bdelete\b/i);
  assert.doesNotMatch(src, /\bpatch\b/i);
  assert.doesNotMatch(src, /\bengine\b.*=.*>/i);
});

test("dashboard v1 source contract: stays presenter-only and avoids endpoint concerns", () => {
  const src = readSource();
  assert.doesNotMatch(src, /router\.get|router\.post|app\.get|app\.post|req\b|res\b|status\(\d+\)|json\(/);
});
