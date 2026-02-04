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

test("CI: registry_law_guard hard-fails on FK break (exercise.stimulus_intent -> not in activity stimulus_intents)", () => {
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

    e.stimulus_intent = "__fk_break_nonexistent_stimulus_intent__";
    writeJsonUtf8Lf(exPath, doc);

    const r = runGuard(tempRoot);
    assert.notEqual(r.status, 0, `expected registry_law_guard to fail; status=${r.status}`);

    const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
    assert.match(combined, /registry_law_guard:\s*FAIL/i);
    assert.match(combined, /stimulus/i);
  } finally {
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
  }
});
