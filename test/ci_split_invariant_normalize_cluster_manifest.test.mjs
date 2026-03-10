import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("test:ci composition index includes pinned split invariant normalize cluster manifest and adjacent guard pair", () => {
  const repo = process.cwd();
  const indexPath = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const items = index.items;

  assert.ok(Array.isArray(items), "expected composition items array");

  const manifestPath = "ci/contracts/split_invariant_normalize_ci_cluster.json";
  const manifestIdx = items.findIndex(
    (item) => item?.kind === "manifest" && item.path === manifestPath
  );

  assert.notEqual(
    manifestIdx,
    -1,
    "expected split invariant normalize cluster manifest in composition index"
  );

  assert.deepEqual(
    items.slice(manifestIdx, manifestIdx + 5),
    [
      { kind: "manifest", path: "ci/contracts/split_invariant_normalize_ci_cluster.json" },
      { kind: "command", value: "node test/ci_split_invariant_normalize_cluster_manifest_file.test.mjs" },
      { kind: "command", value: "node test/ci_split_invariant_normalize_cluster_manifest.test.mjs" },
      { kind: "command", value: "node test/ci_split_invariant_normalize_manifest_file.test.mjs" },
      { kind: "command", value: "node test/ci_split_invariant_normalize_manifest.test.mjs" }
    ],
    "expected split invariant normalize cluster manifest followed by its adjacent guard pair and legacy manifest guards"
  );
});