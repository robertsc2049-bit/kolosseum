import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("package.json keeps compile runtime trace regression before wiring guard in test:ci", () => {
  const repo = process.cwd();
  const pkgPath = path.join(repo, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const testCi = String(pkg.scripts?.["test:ci"] ?? "");
  const compileCmd = "node test/api.blocks_compile_runtime_trace_contract.regression.test.mjs";
  const wiringCmd = "node test/ci_compile_runtime_trace_wiring.test.mjs";

  assert.ok(testCi.includes(compileCmd), "expected compile runtime trace regression in test:ci");
  assert.ok(testCi.includes(wiringCmd), "expected ci wiring guard in test:ci");

  const compileIndex = testCi.indexOf(compileCmd);
  const wiringIndex = testCi.indexOf(wiringCmd);

  assert.notEqual(compileIndex, -1, "expected compile runtime trace regression index");
  assert.notEqual(wiringIndex, -1, "expected ci wiring guard index");
  assert.ok(
    compileIndex < wiringIndex,
    "expected compile runtime trace regression to run before the ci wiring guard"
  );

  const compileCount = (testCi.match(/api\.blocks_compile_runtime_trace_contract\.regression\.test\.mjs/g) ?? []).length;
  const wiringCount = (testCi.match(/ci_compile_runtime_trace_wiring\.test\.mjs/g) ?? []).length;

  assert.equal(compileCount, 1, "expected exactly one compile runtime trace regression entry in test:ci");
  assert.equal(wiringCount, 1, "expected exactly one ci wiring guard entry in test:ci");
});