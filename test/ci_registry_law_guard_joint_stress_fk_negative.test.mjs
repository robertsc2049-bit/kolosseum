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

test("CI: registry_law_guard hard-fails on FK break (exercise.joint_stress_tags -> not in movement-scoped joint_stress_tags)", () => {
  const exPath = p("registries/exercise/exercise.registry.json");
  const originalRaw = fs.readFileSync(exPath, "utf8");
  const original = readJson(exPath);

  try {
    const keys = Object.keys(original.entries);
    assert.ok(keys.length > 0, "expected exercise entries");
    const k0 = keys[0];

    const entry = original.entries[k0];
    assert.ok(entry && typeof entry === "object");
    assert.equal(typeof entry.pattern, "string");
    assert.ok(Array.isArray(entry.joint_stress_tags) && entry.joint_stress_tags.length > 0);

    entry.joint_stress_tags[0] = "__fk_break_bad_joint_stress__";
    writeJsonUtf8Lf(exPath, original);

    const r = runGuard();
    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /joint_stress_tags token[\s\S]*not in vocab/i);
    assert.match(combined, /entries\.[a-z0-9_]+:\s*joint_stress_tags token/i);
  } finally {
    fs.writeFileSync(exPath, originalRaw, { encoding: "utf8" });
  }
});