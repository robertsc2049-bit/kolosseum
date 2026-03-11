import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const NODE_TEST_CMD_RE = /^node test\/[A-Za-z0-9._/-]+\.test\.mjs$/;

test("compile block persistence delegation contracts cluster manifest file is well-formed, non-empty, unique, and node-test-only", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "compile_block_persistence_delegation_contracts_ci_cluster.json");
  const raw = fs.readFileSync(manifestPath, "utf8");

  let manifest;
  assert.doesNotThrow(() => {
    manifest = JSON.parse(raw);
  }, "expected compile block persistence delegation contracts cluster manifest to be valid JSON");

  assert.ok(manifest && typeof manifest === "object" && !Array.isArray(manifest), "expected manifest object");
  assert.equal(manifest.label, "compile block persistence delegation contracts ci cluster");
  assert.ok(Array.isArray(manifest.cluster), "expected manifest.cluster array");
  assert.equal(manifest.cluster.length, 9, "expected exactly 9 compile block persistence delegation contract commands");

  const seen = new Set();
  for (const cmd of manifest.cluster) {
    assert.equal(typeof cmd, "string", "expected command string");
    assert.notEqual(cmd.trim(), "", "expected non-empty command");
    assert.equal(cmd, cmd.trim(), "expected trimmed command");
    assert.match(cmd, NODE_TEST_CMD_RE, "expected node test/... .test.mjs command");
    assert.ok(!seen.has(cmd), `expected unique command: ${cmd}`);
    seen.add(cmd);
  }
});