import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

test("test:ci composition index includes pinned block handler delegation contracts cluster manifest and adjacent guard pair", () => {
  const repo = process.cwd();
  const p = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const src = readFileSync(p, "utf8");

  assert.match(
    src,
    /ci\/contracts\/block_handler_delegation_contracts_ci_cluster\.json/,
    "expected test:ci composition index to include block handler delegation contracts cluster manifest"
  );
});