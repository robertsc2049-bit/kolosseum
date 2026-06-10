import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  stageTempRepoRoot,
  cleanupTempRepoRoot,
  readJson,
  writeJsonUtf8Lf,
  runRegistryLawGuard
} from "../test_support/registry_law_guard_harness.mjs";

import { ensureMovementEquipmentArray } from "../test_support/registry_mutators.mjs";

test("CI: registry_law_guard hard-fails when token is valid in some movement but invalid for this exercise.pattern", () => {
  const tempRoot = stageTempRepoRoot();

  try {
    const regRoot = path.join(tempRoot, "registries");
    const movPath = path.join(regRoot, "movement", "movement.registry.json");
    const exPath = path.join(regRoot, "exercise", "exercise.registry.json");

    const mov = readJson(movPath);
    const ex = readJson(exPath);

    assert.equal(typeof mov?.entries, "object");
    assert.equal(typeof ex?.entries, "object");

    const mKeys = Object.keys(mov.entries || {});
    assert.ok(mKeys.length >= 2, "expected >=2 movements");

    const goodMovementId = String(mKeys[0]);
    const badMovementId = String(mKeys[1]);

    const good = mov.entries[goodMovementId];
    const bad = mov.entries[badMovementId];

    assert.ok(good && typeof good === "object", "expected good movement entry object");
    assert.ok(bad && typeof bad === "object", "expected bad movement entry object");

    // Create a movement-scoped token by inserting it into ONE movement's allowed list only.
    const token = "__scoped_only_token__";

    const g = ensureMovementEquipmentArray(good);
    if (!g.arr.includes(token)) g.arr.push(token);

    const b = ensureMovementEquipmentArray(bad);
    while (b.arr.includes(token)) b.arr.splice(b.arr.indexOf(token), 1);

    writeJsonUtf8Lf(movPath, mov);

    const eKeys = Object.keys(ex.entries || {});
    assert.ok(eKeys.length > 0, "expected exercise entries");
    const e0 = ex.entries[eKeys[0]];
    assert.ok(e0 && typeof e0 === "object", "expected exercise entry object");

    // Scoped FK break:
    // - token exists in movement 'good'
    // - exercise claims movement 'bad'
    // - exercise equipment includes token => should fail
    e0.pattern = badMovementId;
    e0.equipment = [token];

    writeJsonUtf8Lf(exPath, ex);

    const r = runRegistryLawGuard(tempRoot);
    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /equipment/i);
  } finally {
    cleanupTempRepoRoot(tempRoot);
  }
});
