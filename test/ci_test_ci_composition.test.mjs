import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

test("package.json test:ci is single-owner and resolves from deterministic composition index", () => {
  const repo = process.cwd();
  const pkgPath = path.join(repo, "package.json");
  const runnerPath = path.join(repo, "ci", "scripts", "run_test_ci_from_index.mjs");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const { commands, script } = composeTestCiFromIndex(repo);

  const testCi = String(pkg.scripts?.["test:ci"] ?? "");
  const testCiIntegration = String(pkg.scripts?.["test:ci:integration"] ?? "");

  assert.notEqual(testCi, "", "expected package.json scripts.test:ci");
  assert.equal(
    testCi,
    "node ci/scripts/run_test_ci_from_index.mjs",
    "expected package.json test:ci to use the single-owner runner"
  );

  assert.ok(fs.existsSync(runnerPath), "expected single-owner test:ci runner to exist");
  assert.ok(commands.length > 0, "expected composed index to expand to at least one command");
  assert.ok(script.includes(" && "), "expected composed index to remain a multi-command deterministic chain");

  for (const cmd of commands) {
    assert.ok(!testCiIntegration.includes(cmd), `expected ${cmd} to stay out of test:ci:integration`);
  }
});