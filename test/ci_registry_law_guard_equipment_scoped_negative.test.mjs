import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
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
  const lf = json.replace(/\r\n/g, "\n");
  fs.writeFileSync(abs, lf, { encoding: "utf8" });
}

function runGuard() {
  return spawnSync(
    process.execPath,
    [p("ci/guards/registry_law_guard.mjs")],
    { cwd: repoRoot(), encoding: "utf8" }
  );
}

test("CI: registry_law_guard hard-fails when token is valid in some movement but invalid for this exercise.pattern", () => {
  const exPath = p("registries/exercise/exercise.registry.json");
  const originalRaw = fs.readFileSync(exPath, "utf8");
  const original = readJson(exPath);

  try {
    const keys = Object.keys(original.entries);
    assert.ok(keys.length > 0, "expected exercise entries");

    const k = keys.find((id) => original.entries[id]?.pattern === "horizontal_push");
    assert.ok(k, "expected at least one horizontal_push exercise");

    const entry = original.entries[k];
    assert.ok(Array.isArray(entry.equipment) && entry.equipment.length > 0, "expected equipment[]");

    // trap_bar is valid for hinge (by your movement seed), but should be INVALID for horizontal_push.
    entry.equipment[0] = "trap_bar";
    writeJsonUtf8Lf(exPath, original);

    const r = runGuard();
    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /equipment token 'trap_bar'[\s\S]*not in vocab/i);
    assert.match(combined, /entries\.[a-z0-9_]+:/i);
  } finally {
    fs.writeFileSync(exPath, originalRaw, { encoding: "utf8" });
  }
});