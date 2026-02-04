import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// helper is at: test/_helpers/*.mjs  => repo root is two levels up
export function repoRoot() {
  return path.resolve(__dirname, "..", "..");
}

export function p(...parts) {
  return path.resolve(repoRoot(), ...parts);
}

export function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

export function writeJsonUtf8Lf(abs, obj) {
  const json = JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(abs, json.replace(/\r\n/g, "\n"), { encoding: "utf8" });
}

/**
 * Create a hermetic temp "repo root" that contains ONLY what registry_law_guard needs:
 * - registries/** (the artifacts under test)
 * - ci/schemas/** (validator schemas loaded via absFromRoot("ci/schemas/.."))
 *
 * The guard is executed from the real repo path, but with cwd=tempRoot,
 * so absFromRoot() resolves inside the temp root and cannot touch real registries.
 */
export function stageTempRepoRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-registry-law-"));

  // Copy registries/**
  fs.cpSync(p("registries"), path.join(tmp, "registries"), { recursive: true });

  // Copy ci/schemas/**
  fs.mkdirSync(path.join(tmp, "ci"), { recursive: true });
  fs.cpSync(p("ci", "schemas"), path.join(tmp, "ci", "schemas"), { recursive: true });

  return tmp;
}

export function runRegistryLawGuard(tempRootAbs) {
  return spawnSync(process.execPath, [p("ci/guards/registry_law_guard.mjs")], {
    cwd: tempRootAbs,
    encoding: "utf8"
  });
}

export function rmrf(absPath) {
  try {
    fs.rmSync(absPath, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures (CI environments can be weird)
  }
}
