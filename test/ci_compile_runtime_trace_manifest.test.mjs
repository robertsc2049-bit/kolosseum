import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { composeTestCiFromIndex } from "../ci/scripts/compose_test_ci_from_index.mjs";

test("compile runtime trace manifest remains present in composed test:ci command set", () => {
  const repo = process.cwd();
  const manifestPath = path.join(repo, "ci", "contracts", "compile_runtime_trace_ci_cluster.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const { commands } = composeTestCiFromIndex(repo);

  assert.ok(manifest && typeof manifest === "object" && !Array.isArray(manifest), "expected manifest object");
  assert.ok(Array.isArray(manifest.cluster), "expected manifest.cluster array");
  assert.ok(manifest.cluster.length > 0, "expected non-empty compile runtime trace cluster manifest");

  const seen = new Set();
  for (const cmd of manifest.cluster) {
    assert.equal(typeof cmd, "string", "expected manifest command string");
    assert.notEqual(cmd.trim(), "", "expected non-empty manifest command");
    assert.equal(cmd, cmd.trim(), "expected trimmed manifest command");
    assert.ok(!seen.has(cmd), `expected unique manifest command: ${cmd}`);
    seen.add(cmd);
    assert.ok(commands.includes(cmd), `expected ${cmd} in composed test:ci command set`);
  }
});