import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

test("package.json test:ci matches deterministic composition index exactly", () => {
  const repo = process.cwd();
  const pkgPath = path.join(repo, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const { commands, script } = composeTestCiFromIndex(repo);

  const testCi = String(pkg.scripts?.["test:ci"] ?? "");
  const testCiIntegration = String(pkg.scripts?.["test:ci:integration"] ?? "");

  assert.notEqual(testCi, "", "expected package.json scripts.test:ci");
  assert.equal(testCi, script, "expected package.json test:ci to match composed index exactly");

  const tokens = testCi.split(" && ").map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(tokens, commands, "expected exact composed command token order");

  for (const cmd of commands) {
    assert.ok(!testCiIntegration.includes(cmd), `expected ${cmd} to stay out of test:ci:integration`);
  }
});