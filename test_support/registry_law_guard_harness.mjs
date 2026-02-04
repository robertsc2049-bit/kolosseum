import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Walk up from a starting directory until we find a marker file.
 * This makes the harness robust if the test directory moves deeper later.
 */
function findUpForFile(startDirAbs, fileName) {
  let cur = startDirAbs;
  for (;;) {
    const candidate = path.join(cur, fileName);
    if (fs.existsSync(candidate)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error(`registry_law_guard_harness: could not find ${fileName} above ${startDirAbs}`);
}

/**
 * Repo root is discovered by walking upward until we find package.json.
 * DO NOT replace with brittle path.resolve(__dirname, "..", "..") etc.
 */
export function repoRootAbs() {
  return findUpForFile(__dirname, "package.json");
}

export function p(...parts) {
  return path.resolve(repoRootAbs(), ...parts);
}

export function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

export function writeJsonUtf8Lf(absPath, obj) {
  const json = JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(absPath, json.replace(/\r\n/g, "\n"), { encoding: "utf8" });
}

/**
 * Create a hermetic temp "repo root" that contains ONLY what registry_law_guard needs:
 * - registries/** (artifacts under test)
 * - ci/schemas/** (validator schemas loaded via absFromRoot("ci/schemas/.."))
 *
 * The guard itself is executed from the real repo path, but with cwd=tempRoot,
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

export function cleanupTempRepoRoot(tempRootAbs) {
  try {
    fs.rmSync(tempRootAbs, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures in CI
  }
}

export function runRegistryLawGuard(tempRootAbs) {
  return spawnSync(process.execPath, [p("ci/guards/registry_law_guard.mjs")], {
    cwd: tempRootAbs,
    encoding: "utf8"
  });
}
