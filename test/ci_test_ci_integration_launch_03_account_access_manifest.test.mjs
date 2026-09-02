// DEV NOTE: LAUNCH-03 authoritative integration composition guard.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("integration composition includes the LAUNCH-03 account access cluster and adjacent guard pair", () => {
  const index = JSON.parse(
    fs.readFileSync("ci/contracts/test_ci_integration_composition.json", "utf8")
  );

  const item = index.items.find((entry) => entry.id === "launch_03_account_access");
  assert.ok(item, "expected launch_03_account_access item");
  assert.equal(
    item.manifest,
    "ci/contracts/test_ci_integration_launch_03_account_access_manifest.json"
  );
  assert.deepEqual(item.guards, [
    "node test/ci_test_ci_integration_launch_03_account_access_manifest_file.test.mjs",
    "node test/ci_test_ci_integration_launch_03_account_access_manifest.test.mjs"
  ]);
});
