import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const NODE_TEST_CMD_RE = /^node test\/[A-Za-z0-9._/-]+\.test\.mjs$/;

test("test:ci composition file is well-formed and expands to unique node-test-only commands", () => {
  const repo = process.cwd();
  const indexPath = path.join(repo, "ci", "contracts", "test_ci_composition.json");
  const raw = fs.readFileSync(indexPath, "utf8");

  let index;
  assert.doesNotThrow(() => {
    index = JSON.parse(raw);
  }, "expected test:ci composition file to be valid JSON");

  assert.ok(index && typeof index === "object" && !Array.isArray(index), "expected composition object");
  assert.ok(Array.isArray(index.items), "expected composition.items array");
  assert.ok(index.items.length > 0, "expected non-empty composition.items");

  const expanded = [];
  const seenManifestPaths = new Set();

  for (const item of index.items) {
    assert.ok(item && typeof item === "object" && !Array.isArray(item), "expected item object");
    assert.ok(item.kind === "command" || item.kind === "manifest", `unexpected item.kind: ${String(item.kind)}`);

    if (item.kind === "command") {
      assert.equal(typeof item.value, "string", "expected command item value string");
      assert.notEqual(item.value.trim(), "", "expected non-empty command item value");
      assert.equal(item.value, item.value.trim(), "expected trimmed command item value");
      assert.match(item.value, NODE_TEST_CMD_RE, "expected command item value to be node test/... .test.mjs");
      expanded.push(item.value);
      continue;
    }

    assert.equal(typeof item.path, "string", "expected manifest item path string");
    assert.notEqual(item.path.trim(), "", "expected non-empty manifest item path");
    assert.equal(item.path, item.path.trim(), "expected trimmed manifest item path");
    assert.match(item.path, /^ci\/contracts\/[A-Za-z0-9._/-]+\.json$/, "expected manifest path under ci/contracts");
    assert.ok(!seenManifestPaths.has(item.path), `expected unique manifest path: ${item.path}`);
    seenManifestPaths.add(item.path);

    const manifestPath = path.join(repo, ...item.path.split("/"));
    const manifestRaw = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);

    assert.ok(manifest && typeof manifest === "object" && !Array.isArray(manifest), `expected manifest object: ${item.path}`);
    assert.ok(Array.isArray(manifest.cluster), `expected manifest.cluster array: ${item.path}`);
    assert.ok(manifest.cluster.length > 0, `expected non-empty manifest.cluster: ${item.path}`);

    for (const cmd of manifest.cluster) {
      assert.equal(typeof cmd, "string", `expected manifest command string: ${item.path}`);
      assert.notEqual(cmd.trim(), "", `expected non-empty manifest command: ${item.path}`);
      assert.equal(cmd, cmd.trim(), `expected trimmed manifest command: ${item.path}`);
      assert.match(cmd, NODE_TEST_CMD_RE, `expected node test/... .test.mjs in ${item.path}`);
      expanded.push(cmd);
    }
  }

  const seenCommands = new Set();
  for (const cmd of expanded) {
    assert.ok(!seenCommands.has(cmd), `expected unique composed command: ${cmd}`);
    seenCommands.add(cmd);
  }
});