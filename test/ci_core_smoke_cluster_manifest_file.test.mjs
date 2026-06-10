import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("core smoke cluster CI manifest file is well-formed, non-empty, unique, and node-test-only", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "core_smoke_ci_cluster.json");

  const raw = fs.readFileSync(manifestPath, "utf8");
  let manifest;
  assert.doesNotThrow(() => {
    manifest = JSON.parse(raw);
  }, "expected core smoke cluster CI manifest to be valid JSON");

  assert.ok(manifest && typeof manifest === "object" && !Array.isArray(manifest), "expected manifest object");
  assert.ok(Array.isArray(manifest.cluster), "expected manifest.cluster array");
  assert.ok(manifest.cluster.length > 0, "expected non-empty manifest.cluster");

  const seen = new Set();
  for (const entry of manifest.cluster) {
    assert.equal(typeof entry, "string", "expected each manifest entry to be a string");
    assert.notEqual(entry.trim(), "", "expected manifest entry to be non-empty");
    assert.equal(entry, entry.trim(), "expected manifest entry without leading/trailing whitespace");
    assert.match(
      entry,
      /^node test\/[A-Za-z0-9._/-]+\.test\.mjs$/,
      "expected manifest entries to be node test/... .test.mjs commands only"
    );
    assert.ok(!seen.has(entry), `expected unique manifest entry: ${entry}`);
    seen.add(entry);
  }
});