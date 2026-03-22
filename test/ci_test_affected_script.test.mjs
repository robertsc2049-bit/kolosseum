import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("package.json exposes single-owner affected-test scripts", () => {
  const repo = process.cwd();
  const pkgPath = path.join(repo, "package.json");
  const runnerPath = path.join(repo, "ci", "scripts", "run_test_affected_from_changed_files.mjs");
  const composePath = path.join(repo, "ci", "scripts", "compose_test_affected_from_changed_files.mjs");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  assert.equal(
    String(pkg.scripts?.["test:affected"] ?? ""),
    "node ci/scripts/run_test_affected_from_changed_files.mjs",
    "expected package.json test:affected to use the single-owner runner"
  );

  assert.equal(
    String(pkg.scripts?.["test:affected:print"] ?? ""),
    "node ci/scripts/compose_test_affected_from_changed_files.mjs",
    "expected package.json test:affected:print to use the single-owner composer"
  );

  assert.ok(fs.existsSync(runnerPath), "expected affected-test runner to exist");
  assert.ok(fs.existsSync(composePath), "expected affected-test composer to exist");
});
