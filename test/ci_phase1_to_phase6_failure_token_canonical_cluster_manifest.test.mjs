import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("test:ci composition index includes the phase1 to phase6 failure token canonical cluster manifest", () => {
  const repo = process.cwd();
  const indexPath = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  const manifestPaths = index.items
    .filter((item) => item.kind === "manifest")
    .map((item) => item.path);

  assert.ok(
    manifestPaths.includes("ci/contracts/phase1_to_phase6_failure_token_canonical_ci_cluster.json"),
    "expected phase1 to phase6 failure token canonical manifest to be included in test:ci composition"
  );
});
