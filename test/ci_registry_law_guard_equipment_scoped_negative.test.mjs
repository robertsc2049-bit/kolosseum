import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function repoRoot() {
  return path.resolve(__dirname, "..");
}
function p(...parts) {
  return path.resolve(repoRoot(), ...parts);
}
function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}
function writeJsonUtf8Lf(abs, obj) {
  const json = JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(abs, json.replace(/\r\n/g, "\n"), { encoding: "utf8" });
}
function stageTempRepoRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-registry-law-"));
  fs.cpSync(p("registries"), path.join(tmp, "registries"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "ci"), { recursive: true });
  fs.cpSync(p("ci", "schemas"), path.join(tmp, "ci", "schemas"), { recursive: true });
  return tmp;
}
function runGuard(tempRootAbs) {
  return spawnSync(process.execPath, [p("ci/guards/registry_law_guard.mjs")], {
    cwd: tempRootAbs,
    encoding: "utf8"
  });
}

/**
 * Ensure a movement entry has an equipment token list field we can mutate.
 * We intentionally support a couple of plausible field names.
 * registry_law_guard ultimately enforces "movement-scoped equipment vocab", so adding a token to ONE movement
 * and then using it under a DIFFERENT movement pattern should fail.
 */
function ensureMovementEquipmentArray(movementEntry) {
  if (!movementEntry || typeof movementEntry !== "object") return { key: "equipment_tokens", arr: [] };

  // Prefer the field name used by the guard in code/comments: equipment_tokens
  if (Array.isArray(movementEntry.equipment_tokens)) {
    return { key: "equipment_tokens", arr: movementEntry.equipment_tokens };
  }
  if (Array.isArray(movementEntry.equipment)) {
    return { key: "equipment", arr: movementEntry.equipment };
  }

  // Default: create equipment_tokens
  movementEntry.equipment_tokens = [];
  return { key: "equipment_tokens", arr: movementEntry.equipment_tokens };
}

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

    // Create a globally-valid token by inserting it into ONE movement's allowed list.
    // Then make an exercise claim it under a DIFFERENT movement pattern.
    const token = "__scoped_only_token__";

    // Ensure token appears ONLY in the "good" movement list.
    const g = ensureMovementEquipmentArray(good);
    if (!g.arr.includes(token)) g.arr.push(token);

    const b = ensureMovementEquipmentArray(bad);
    // Remove if present (defensive)
    while (b.arr.includes(token)) b.arr.splice(b.arr.indexOf(token), 1);

    writeJsonUtf8Lf(movPath, mov);

    const eKeys = Object.keys(ex.entries || {});
    assert.ok(eKeys.length > 0, "expected exercise entries");

    const e0 = ex.entries[eKeys[0]];
    assert.ok(e0 && typeof e0 === "object", "expected exercise entry object");

    // Scoped FK break: token exists in registry vocab (because movement 'good' allows it),
    // but does NOT exist for movement 'bad', and we set pattern='bad'.
    e0.pattern = badMovementId;
    e0.equipment = [token];

    writeJsonUtf8Lf(exPath, ex);

    const r = runGuard(tempRoot);
    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
assert.match(combined, /equipment/i);
assert.match(combined, /__scoped_only_token__|pattern|entries\./i);
  } finally {
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
  }
});
