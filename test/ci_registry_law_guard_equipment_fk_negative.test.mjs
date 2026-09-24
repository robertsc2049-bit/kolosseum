
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { stageTempRepoRoot, runRegistryLawGuard, readJson, writeJsonUtf8Lf, cleanupTempRepoRoot } from "../test_support/registry_law_guard_harness.mjs";

test("CI: registry_law_guard hard-fails on FK break (exercise.equipment_requirements token -> not in movement-scoped equipment_tokens)", () => {
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

    // Ensure equipment exists and is array-ish, then inject an invalid token.
    if (!Array.isArray(e.equipment_requirements)) e.equipment_requirements = [];
    e.equipment_requirements = [...e.equipment_requirements, "__fk_break_nonexistent_equipment_token__"];

    writeJsonUtf8Lf(exPath, doc);

    const r = runRegistryLawGuard(tempRoot);
    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /equipment/i);
  } finally {
    cleanupTempRepoRoot(tempRoot);
  }
});
