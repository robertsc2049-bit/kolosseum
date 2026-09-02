// DEV NOTE: LAUNCH-03 authoritative integration cluster manifest guard.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("LAUNCH-03 integration manifest is well-formed, non-empty, unique, and node-test-only", () => {
  const manifestPath = "ci/contracts/test_ci_integration_launch_03_account_access_manifest.json";
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.ok(manifest && typeof manifest === "object" && !Array.isArray(manifest));
  assert.equal(manifest.label, "test:ci:integration LAUNCH-03 public account access");
  assert.ok(Array.isArray(manifest.commands));
  assert.ok(manifest.commands.length > 0);
  assert.equal(new Set(manifest.commands).size, manifest.commands.length);

  for (const command of manifest.commands) {
    assert.match(command, /^node test\/.+\.test\.mjs$/);
  }
});
