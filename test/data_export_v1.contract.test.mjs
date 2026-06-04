import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const SOURCE_PATH = "src/api/data_export_v1.ts";

test("data export v1 source contract: exports a session-only envelope builder", () => {
  const src = fs.readFileSync(SOURCE_PATH, "utf8");

  assert.match(src, /export\s+function\s+buildExportEnvelopeV1\s*\(/);
  assert.match(src, /export\s+type\s+ExportEnvelopeV1\s*=\s*\{/);
  assert.match(src, /export_type:\s*"session_aggregation"/);

  assert.doesNotMatch(src, /facility_metrics/);
  assert.doesNotMatch(src, /dashboard/);
  assert.doesNotMatch(src, /proof/i);
  assert.doesNotMatch(src, /evidence/i);
});

test("data export v1 source contract: documents v0 boundary", () => {
  const src = fs.readFileSync(SOURCE_PATH, "utf8");

  assert.match(src, /DEV NOTE:/);
  assert.match(src, /Only session aggregation is admitted here; all other product envelopes are refused\./);
  assert.match(src, /Unknown export_type values must resolve to session_aggregation/);
});