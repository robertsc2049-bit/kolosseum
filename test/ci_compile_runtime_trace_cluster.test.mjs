import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("package.json keeps compile runtime trace cluster adjacent, ordered, unique, and out of integration", () => {
  const repo = process.cwd();
  const pkgPath = path.join(repo, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const testCi = String(pkg.scripts?.["test:ci"] ?? "");
  const testCiIntegration = String(pkg.scripts?.["test:ci:integration"] ?? "");

  const compileCmd = "node test/api.blocks_compile_runtime_trace_contract.regression.test.mjs";
  const wiringCmd = "node test/ci_compile_runtime_trace_wiring.test.mjs";
  const orderingCmd = "node test/ci_compile_runtime_trace_ordering.test.mjs";

  const cluster = [compileCmd, wiringCmd, orderingCmd];

  for (const cmd of cluster) {
    assert.ok(testCi.includes(cmd), `expected ${cmd} in test:ci`);
    assert.ok(!testCiIntegration.includes(cmd), `expected ${cmd} to stay out of test:ci:integration`);
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (testCi.match(new RegExp(escaped, "g")) ?? []).length;
    assert.equal(count, 1, `expected exactly one occurrence of ${cmd} in test:ci`);
  }

  const indexes = cluster.map((cmd) => testCi.indexOf(cmd));
  for (const idx of indexes) {
    assert.notEqual(idx, -1, "expected cluster command index in test:ci");
  }

  assert.ok(indexes[0] < indexes[1], "expected compile regression before wiring guard");
  assert.ok(indexes[1] < indexes[2], "expected wiring guard before ordering guard");

  const tokens = testCi.split(" && ").map((s) => s.trim()).filter(Boolean);
  const clusterStart = tokens.indexOf(compileCmd);

  assert.notEqual(clusterStart, -1, "expected compile regression token in test:ci token list");
  assert.deepEqual(
    tokens.slice(clusterStart, clusterStart + cluster.length),
    cluster,
    "expected compile runtime trace cluster to be adjacent with no inserted commands"
  );
});