import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE_PATH = "src/api/facility_metrics.ts";

function readSource() {
  return fs.readFileSync(SOURCE_PATH, "utf8");
}

test("facility metrics source contract: exports pure builder and closed output shape", () => {
  const src = readSource();
  assert.match(src, /export\s+function\s+buildFacilityMetrics\s*\(/);
  assert.match(src, /export\s+type\s+FacilityMetrics\s*=\s*\{/);
  assert.match(src, /occupancy_peak:\s*number/);
  assert.match(src, /occupancy_current:\s*number/);
  assert.match(src, /bottleneck_equipment_ids:\s*string\[\]/);
});

test("facility metrics source contract: derives from factual events and declared facility context only", () => {
  const src = readSource();
  assert.match(src, /facilityContext:\s*FacilityContext/);
  assert.match(src, /eventLog:\s*FacilityEvent\[\]/);
  assert.doesNotMatch(src, /\bpredict/i);
  assert.doesNotMatch(src, /\bforecast/i);
  assert.doesNotMatch(src, /\blikely/i);
  assert.doesNotMatch(src, /\brecommend/i);
  assert.doesNotMatch(src, /\bscore\b/i);
  assert.doesNotMatch(src, /\brisk\b/i);
});

test("facility metrics source contract: module stays aggregation-only and avoids endpoint concerns", () => {
  const src = readSource();
  assert.doesNotMatch(src, /router\.get|router\.post|app\.get|app\.post|req\b|res\b|status\(\d+\)|json\(/);
});
