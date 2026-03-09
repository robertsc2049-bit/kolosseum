import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("package.json matches pinned phase1 docs CI manifest", () => {
  const repo = process.cwd();
  const pkgPath = path.join(repo, "package.json");
  const manifestPath = path.join(repo, "ci", "contracts", "phase1_docs_ci_cluster.json");

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  const testCi = String(pkg.scripts?.["test:ci"] ?? "");
  const testCiIntegration = String(pkg.scripts?.["test:ci:integration"] ?? "");
  const cluster = Array.isArray(manifest.cluster) ? manifest.cluster : [];

  assert.ok(cluster.length > 0, "expected non-empty phase1 docs cluster manifest");

  for (const cmd of cluster) {
    assert.ok(testCi.includes(cmd), `expected ${cmd} in test:ci`);
    assert.ok(!testCiIntegration.includes(cmd), `expected ${cmd} to stay out of test:ci:integration`);

    const count = (testCi.match(new RegExp(escapeRegExp(cmd), "g")) ?? []).length;
    assert.equal(count, 1, `expected exactly one occurrence of ${cmd} in test:ci`);
  }

  const indexes = cluster.map((cmd) => testCi.indexOf(cmd));
  for (const idx of indexes) {
    assert.notEqual(idx, -1, "expected cluster command index in test:ci");
  }

  for (let i = 1; i < indexes.length; i += 1) {
    assert.ok(
      indexes[i - 1] < indexes[i],
      `expected manifest command ${i - 1} to appear before manifest command ${i}`
    );
  }

  const tokens = testCi.split(" && ").map((s) => s.trim()).filter(Boolean);
  const clusterStart = tokens.indexOf(cluster[0]);

  assert.notEqual(clusterStart, -1, "expected first manifest command token in test:ci token list");
  assert.deepEqual(
    tokens.slice(clusterStart, clusterStart + cluster.length),
    cluster,
    "expected phase1 docs manifest cluster to be adjacent with no inserted commands"
  );
});