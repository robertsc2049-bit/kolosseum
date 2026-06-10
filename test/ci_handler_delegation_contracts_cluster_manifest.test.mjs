import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("test:ci composition index includes pinned handler delegation contracts cluster manifest and adjacent guard pair", () => {
  const repo = process.cwd();
  const indexPath = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  const manifestPath = "ci/contracts/handler_delegation_contracts_ci_cluster.json";
  const manifestIdx = index.items.findIndex(
    (item) => item && item.kind === "manifest" && item.path === manifestPath
  );

  assert.notEqual(manifestIdx, -1, "expected handler delegation contracts cluster manifest in composition index");

  assert.deepEqual(index.items.slice(manifestIdx, manifestIdx + 3), [
    {
      kind: "manifest",
      path: "ci/contracts/handler_delegation_contracts_ci_cluster.json"
    },
    {
      kind: "command",
      value: "node test/ci_handler_delegation_contracts_cluster_manifest_file.test.mjs"
    },
    {
      kind: "command",
      value: "node test/ci_handler_delegation_contracts_cluster_manifest.test.mjs"
    }
  ]);
});