import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { stageTempRepoRoot, runRegistryLawGuard, readJson, writeJsonUtf8Lf, cleanupTempRepoRoot } from "../test_support/registry_law_guard_harness.mjs";

test("CI: registry_law_guard hard-fails on FK break (exercise.pattern -> missing movement)", () => {
  const tempRoot = stageTempRepoRoot();

  try {
    const exPath = path.join(tempRoot, "registries", "exercise", "exercise.registry.json");
    const doc = readJson(exPath);

    assert.equal(typeof doc, "object");
    assert.equal(typeof doc.entries, "object");

    const keys = Object.keys(doc.entries);
    assert.ok(keys.length > 0, "expected exercise entries");
    const k0 = keys[0];

    assert.ok(doc.entries[k0], "expected first entry object");
    assert.equal(typeof doc.entries[k0].pattern, "string", "expected entry.pattern string");

    // FK break (in temp copy ONLY)
    doc.entries[k0].pattern = "__fk_break_nonexistent_movement__";
    writeJsonUtf8Lf(exPath, doc);

    const r = runRegistryLawGuard(tempRoot);

    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /FK fail pattern/i);
  } finally {
    cleanupTempRepoRoot(tempRoot);
  }
});
