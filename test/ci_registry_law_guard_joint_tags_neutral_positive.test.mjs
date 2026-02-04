import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { stageTempRepoRoot, runRegistryLawGuard, readJson, writeJsonUtf8Lf, rmrf } from "../test_support/registry_law_guard_harness.mjs";

test("CI: registry_law_guard passes when exercise uses joint_stress_tags=['neutral']", () => {
  const tempRoot = stageTempRepoRoot();

  try {
    const exPath = path.join(tempRoot, "registries", "exercise", "exercise.registry.json");
    const doc = readJson(exPath);

    assert.equal(typeof doc, "object");
    assert.equal(typeof doc.entries, "object");

    const keys = Object.keys(doc.entries);
    assert.ok(keys.length > 0, "expected exercise entries");
    const k0 = keys[0];
    const e = doc.entries[k0];

    assert.ok(e && typeof e === "object", "expected entry object");

    e.joint_stress_tags = ["neutral"];
    writeJsonUtf8Lf(exPath, doc);

    const r = runRegistryLawGuard(tempRoot);
    assert.equal(r.status, 0, `expected registry_law_guard to pass; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*OK/i);
  } finally {
    rmrf(tempRoot);
  }
});
