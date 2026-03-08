import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("package.json keeps compile runtime trace regression in test:ci and out of test:ci:integration", () => {
  const repo = process.cwd();
  const pkgPath = path.join(repo, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const testCi = String(pkg.scripts?.["test:ci"] ?? "");
  const testCiIntegration = String(pkg.scripts?.["test:ci:integration"] ?? "");
  const target = "node test/api.blocks_compile_runtime_trace_contract.regression.test.mjs";

  assert.match(
    testCi,
    /node test\/api\.blocks_compile_runtime_trace_contract\.regression\.test\.mjs/,
    "expected compile runtime trace regression to be wired into test:ci"
  );

  assert.doesNotMatch(
    testCiIntegration,
    /node test\/api\.blocks_compile_runtime_trace_contract\.regression\.test\.mjs/,
    "expected compile runtime trace regression to stay out of test:ci:integration"
  );

  const ciCount = (testCi.match(/api\.blocks_compile_runtime_trace_contract\.regression\.test\.mjs/g) ?? []).length;
  const integrationCount = (testCiIntegration.match(/api\.blocks_compile_runtime_trace_contract\.regression\.test\.mjs/g) ?? []).length;

  assert.equal(ciCount, 1, "expected exactly one compile runtime trace regression entry in test:ci");
  assert.equal(integrationCount, 0, "expected zero compile runtime trace regression entries in test:ci:integration");
  assert.ok(testCi.includes(target), "expected exact test command in test:ci");
});