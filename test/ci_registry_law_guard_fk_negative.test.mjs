
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { stageTempRepoRoot, runRegistryLawGuard, readJson, writeJsonUtf8Lf, cleanupTempRepoRoot } from "../test_support/registry_law_guard_harness.mjs";

test("CI: registry_law_guard hard-fails on FK break (exercise .movement_pattern_id -> missing movement)", () => {
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
    assert.equal(typeof doc.entries[k0].movement_pattern_id, "string", "expected entry.movement_pattern_id string");

    // FK break (in temp copy ONLY)
    doc.entries[k0].movement_pattern_id = "__fk_break_nonexistent_movement__";
    writeJsonUtf8Lf(exPath, doc);

    const r = runRegistryLawGuard(tempRoot);

    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /FK fail movement_pattern_id/i);
  } finally {
    cleanupTempRepoRoot(tempRoot);
  }
});

test("CI: registry_law_guard rejects legacy joint aliases instead of canonicalizing them", () => {
  const tempRoot = stageTempRepoRoot();

  try {
    const exPath = path.join(tempRoot, "registries", "exercise", "exercise.registry.json");
    const doc = readJson(exPath);

    assert.equal(typeof doc, "object");
    assert.equal(typeof doc.entries, "object");
    assert.ok(doc.entries.bench_press, "expected bench_press canonical exercise fixture");
    assert.deepEqual(doc.entries.bench_press.joint_stress_tags, ["shoulder"], "expected canonical shoulder token before mutation");

    // Legacy alias injection (in temp copy ONLY). REG-FULL-01 requires exact canonical vocabulary.
    doc.entries.bench_press.joint_stress_tags = ["shoulder_low"];
    writeJsonUtf8Lf(exPath, doc);

    const r = runRegistryLawGuard(tempRoot);

    assert.notEqual(r.status, 0, `expected registry_law_guard to reject legacy alias; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /joint_stress_tags token 'shoulder_low' is not in canonical vocab/i);
  } finally {
    cleanupTempRepoRoot(tempRoot);
  }
});
