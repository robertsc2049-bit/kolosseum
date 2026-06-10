import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("test:ci:integration vertical slice cluster manifest file is well-formed, non-empty, unique, and node-test-only", () => {
  const manifestPath = "ci/contracts/test_ci_integration_vertical_slice_cluster_manifest.json";
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  assert.ok(manifest && typeof manifest === "object" && !Array.isArray(manifest), "expected manifest object");
  assert.equal(manifest.label, "test:ci:integration vertical slice cluster");
  assert.ok(Array.isArray(manifest.commands), "expected manifest.commands array");
  assert.ok(manifest.commands.length > 0, "expected non-empty manifest.commands");

  const uniqueCommands = new Set(manifest.commands);
  assert.equal(uniqueCommands.size, manifest.commands.length, "expected unique manifest.commands");

  for (const command of manifest.commands) {
    assert.match(command, /^node test\/.+\.test\.mjs$/, `expected node-test-only command: ${command}`);
  }
});