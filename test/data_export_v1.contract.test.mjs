import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE_PATH = "src/api/data_export_v1.ts";

function readSource() {
  return fs.readFileSync(SOURCE_PATH, "utf8");
}

test("data export v1 source contract: exports closed envelope builder", () => {
  const src = readSource();
  assert.match(src, /export\s+function\s+buildExportEnvelopeV1\s*\(/);
  assert.match(src, /export\s+type\s+ExportEnvelopeV1\s*=\s*\{/);
  assert.match(src, /export_type:\s*"session_aggregation"\s*\|\s*"facility_metrics"\s*\|\s*"dashboard"/);
  assert.match(src, /payload:\s*Record<string,\s*unknown>/);
});

test("data export v1 source contract: exports remain truth-preserving and semantic-safe", () => {
  const src = readSource();
  assert.doesNotMatch(src, /\bpredict/i);
  assert.doesNotMatch(src, /\bforecast/i);
  assert.doesNotMatch(src, /\brecommend/i);
  assert.doesNotMatch(src, /\bscore\b/i);
  assert.doesNotMatch(src, /\brisk\b/i);
  assert.doesNotMatch(src, /\binfer/i);
  assert.doesNotMatch(src, /\bclassif/i);
});

test("data export v1 source contract: layer stays export-only and avoids endpoint concerns", () => {
  const src = readSource();
  assert.doesNotMatch(src, /router\.get|router\.post|app\.get|app\.post|req\b|res\b|status\(\d+\)|json\(/);
});
