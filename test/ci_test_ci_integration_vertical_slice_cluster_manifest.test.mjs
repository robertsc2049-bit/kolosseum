import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("test:ci:integration composition index includes pinned vertical slice cluster manifest and adjacent guard pair", () => {
  const raw = fs.readFileSync("ci/contracts/test_ci_integration_composition.json", "utf8");
  const index = JSON.parse(raw);

  const item = index.items.find((entry) => entry.id === "vertical_slice_cluster");
  assert.ok(item, "expected vertical_slice_cluster item");
  assert.equal(
    item.manifest,
    "ci/contracts/test_ci_integration_vertical_slice_cluster_manifest.json"
  );
  assert.deepEqual(item.guards, [
    "node test/ci_test_ci_integration_vertical_slice_cluster_manifest_file.test.mjs",
    "node test/ci_test_ci_integration_vertical_slice_cluster_manifest.test.mjs"
  ]);
});