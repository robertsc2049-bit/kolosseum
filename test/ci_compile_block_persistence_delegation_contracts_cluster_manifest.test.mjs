import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

test("test:ci composition index includes pinned compile block persistence delegation contracts cluster manifest", () => {
  const repo = process.cwd();
  const p = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const src = readFileSync(p, "utf8");

  assert.match(
    src,
    /ci\/contracts\/compile_block_persistence_delegation_contracts_ci_cluster\.json/,
    "expected test:ci composition index to include compile block persistence delegation contracts cluster manifest"
  );
});