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
  const lf = json.replace(/\r\n/g, "\n");
  fs.writeFileSync(abs, lf, { encoding: "utf8" });
}

/**
 * Create a hermetic temp "repo root" that contains ONLY what registry_law_guard needs:
 * - registries/** (the artifacts under test)
 * - ci/schemas/** (validator schemas loaded via absFromRoot("ci/schemas/.."))
 *
 * The guard itself is executed from the real repo path, but with cwd=tempRoot,
 * so absFromRoot() resolves inside the temp root and cannot touch real registries.
 */
function stageTempRepoRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-registry-law-"));

  // Copy registries/**
  fs.cpSync(p("registries"), path.join(tmp, "registries"), { recursive: true });

  // Copy ci/schemas/**
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

test("CI: registry_law_guard hard-fails on FK break (exercise.pattern -> missing movement)", () => {
  const tempRoot = stageTempRepoRoot();

  try {
    const exPath = path.join(tempRoot, "registries", "exercise", "exercise.registry.json");
    const original = readJson(exPath);

    assert.equal(typeof original, "object");
    assert.equal(typeof original.entries, "object");

    const keys = Object.keys(original.entries);
    assert.ok(keys.length > 0, "expected exercise entries");
    const k0 = keys[0];

    assert.ok(original.entries[k0], "expected first entry object");
    assert.equal(typeof original.entries[k0].pattern, "string", "expected entry.pattern string");

    // FK break (in temp copy ONLY)
    original.entries[k0].pattern = "__fk_break_nonexistent_movement__";
    writeJsonUtf8Lf(exPath, original);

    const r = runGuard(tempRoot);

    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /FK fail pattern/i);
  } finally {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures in CI
    }
  }
});
