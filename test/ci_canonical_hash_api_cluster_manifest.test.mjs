import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("test:ci composition index includes pinned canonical hash API cluster manifest and adjacent guard pair", () => {
  const repo = process.cwd();
  const indexPath = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  assert.ok(index && typeof index === "object" && !Array.isArray(index), "expected composition object");
  assert.ok(Array.isArray(index.items), "expected composition.items array");

  const items = index.items;
  const manifestPath = "ci/contracts/canonical_hash_api_ci_cluster.json";

  const manifestIdx = items.findIndex((item) => item?.kind === "manifest" && item?.path === manifestPath);
  assert.notEqual(manifestIdx, -1, "expected canonical hash API cluster manifest in composition index");

  assert.deepEqual(
    items.slice(manifestIdx, manifestIdx + 5),
    [
      { kind: "manifest", path: "ci/contracts/canonical_hash_api_ci_cluster.json" },
      { kind: "command", value: "node test/ci_canonical_hash_api_cluster_manifest_file.test.mjs" },
      { kind: "command", value: "node test/ci_canonical_hash_api_cluster_manifest.test.mjs" },
      { kind: "command", value: "node test/ci_canonical_hash_api_manifest_file.test.mjs" },
      { kind: "command", value: "node test/ci_canonical_hash_api_manifest.test.mjs" }
    ],
    "expected canonical hash API cluster manifest followed by its adjacent guard pair and legacy manifest guards"
  );
});