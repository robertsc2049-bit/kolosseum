import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("block handler delegation contracts cluster manifest file is well-formed, non-empty, unique, and node-test-only", () => {
  const repo = process.cwd();
  const file = path.join(repo, "ci", "contracts", "block_handler_delegation_contracts_ci_cluster.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));

  assert.equal(manifest.label, "block handler delegation contracts ci cluster");
  assert.ok(Array.isArray(manifest.cluster), "expected cluster to be an array");
  assert.equal(manifest.cluster.length, 6);

  const unique = new Set(manifest.cluster);
  assert.equal(unique.size, manifest.cluster.length, "expected cluster commands to be unique");

  for (const cmd of manifest.cluster) {
    assert.equal(typeof cmd, "string", "expected each cluster entry to be a string");
    assert.match(cmd, /^node test\/.+\.test\.mjs$/, `expected node-test-only command, got: ${cmd}`);
  }
});