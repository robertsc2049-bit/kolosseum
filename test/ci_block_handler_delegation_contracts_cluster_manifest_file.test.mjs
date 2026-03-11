import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const NODE_TEST_CMD_RE = /^node test\/[A-Za-z0-9._/-]+\.test\.mjs$/;

test("block handler delegation contracts cluster manifest file is well-formed, non-empty, unique, and node-test-only", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "block_handler_delegation_contracts_ci_cluster.json");
  const raw = fs.readFileSync(manifestPath, "utf8");

  let manifest;
  assert.doesNotThrow(() => {
    manifest = JSON.parse(raw);
  });

  assert.equal(manifest.label, "block handler delegation contracts ci cluster");
  assert.ok(Array.isArray(manifest.cluster));
  assert.equal(manifest.cluster.length, 3);

  const seen = new Set();
  for (const cmd of manifest.cluster) {
    assert.equal(typeof cmd, "string");
    assert.equal(cmd, cmd.trim());
    assert.match(cmd, NODE_TEST_CMD_RE);
    assert.ok(!seen.has(cmd), `expected unique command: ${cmd}`);
    seen.add(cmd);
  }
});