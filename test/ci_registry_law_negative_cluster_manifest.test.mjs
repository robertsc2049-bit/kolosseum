import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("test:ci composition index includes pinned registry law negative cluster manifest and adjacent guard pair", () => {
  const repo = process.cwd();
  const indexPath = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  assert.ok(index && typeof index === "object" && !Array.isArray(index), "expected composition object");
  assert.ok(Array.isArray(index.items), "expected composition.items array");

  const items = index.items;
  const manifestPath = "ci/contracts/registry_law_negative_ci_cluster.json";

  const manifestIdx = items.findIndex((item) => item?.kind === "manifest" && item?.path === manifestPath);
  assert.notEqual(manifestIdx, -1, "expected registry law negative cluster manifest in composition index");

  assert.deepEqual(
    items.slice(manifestIdx, manifestIdx + 3),
    [
      { kind: "manifest", path: "ci/contracts/registry_law_negative_ci_cluster.json" },
      { kind: "command", value: "node test/ci_registry_law_negative_cluster_manifest_file.test.mjs" },
      { kind: "command", value: "node test/ci_registry_law_negative_cluster_manifest.test.mjs" }
    ],
    "expected registry law negative cluster manifest followed by its adjacent guard pair"
  );
});