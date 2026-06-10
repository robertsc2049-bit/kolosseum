import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("phase6 output contract CI cluster manifest file is well-formed, non-empty, unique, and node-test-only", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "phase6_output_contract_ci_cluster.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(typeof manifest.version, "number", "expected numeric manifest version");
  assert.ok(Array.isArray(manifest.tests), "expected tests array");
  assert.ok(manifest.tests.length > 0, "expected non-empty tests array");

  const unique = new Set(manifest.tests);
  assert.equal(unique.size, manifest.tests.length, "expected unique manifest entries");

  for (const entry of manifest.tests) {
    assert.equal(typeof entry, "string", "expected test entry string");
    assert.match(entry, /^test\/.+\.test\.mjs$/, "expected node-test-only manifest entry");
  }
});
