import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { normalizeLf } from "../scripts/repo_io.mjs";

// Harness for registry_law_guard tests.
// Key rule: staging uses a TEMP repo copy, so writers MUST allow out-of-repo paths.
// Repo-safe writers (writeRepoTextSync) are *not* appropriate here.

function getRepoRootAbsSync() {
  const out = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  const root = String(out || "").trim();
  if (!root) throw new Error("registry_law_guard_harness: git rev-parse --show-toplevel returned empty output.");
  return path.resolve(root);
}

function copyRepoToTempRootSync(srcRoot, dstRoot) {
  // Copy the minimum surfaces the guard/test needs.
  // Exclude huge/irrelevant dirs; node_modules is junctioned separately.
  const exclude = new Set([
    ".git",
    "dist",
    "coverage",
    ".next",
    ".turbo",
    ".cache",
    "tmp",
    "temp",
    "artifacts",
    "node_modules"
  ]);

  fs.mkdirSync(dstRoot, { recursive: true });

  for (const ent of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    const name = ent.name;
    if (exclude.has(name)) continue;

    const src = path.join(srcRoot, name);
    const dst = path.join(dstRoot, name);

    if (ent.isDirectory()) {
      fs.cpSync(src, dst, { recursive: true });
    } else if (ent.isFile()) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
}

function junctionNodeModulesSync(srcRoot, dstRoot) {
  const srcNm = path.join(srcRoot, "node_modules");
  const dstNm = path.join(dstRoot, "node_modules");

  if (!fs.existsSync(srcNm)) {
    throw new Error(`registry_law_guard_harness: node_modules missing at repo root: ${srcNm}`);
  }

  if (fs.existsSync(dstNm)) {
    fs.rmSync(dstNm, { recursive: true, force: true });
  }

  // On Windows, "junction" avoids admin requirements and works like a directory link.
  fs.symlinkSync(srcNm, dstNm, "junction");
}

export function stageTempRepoRoot() {
  const srcRoot = getRepoRootAbsSync();
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-registry-law-"));
  const dstRoot = path.resolve(tmpBase);

  copyRepoToTempRootSync(srcRoot, dstRoot);
  junctionNodeModulesSync(srcRoot, dstRoot);

  return dstRoot;
}

export function cleanupTempRepoRoot(tempRepoRootAbs) {
  if (!tempRepoRootAbs) return;
  const abs = path.resolve(String(tempRepoRootAbs));
  if (fs.existsSync(abs)) {
    fs.rmSync(abs, { recursive: true, force: true });
  }
}

export function readJson(absPath) {
  const p = path.resolve(String(absPath));
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

export function writeJsonUtf8Lf(absPath, obj, opts = {}) {
  const space = Object.prototype.hasOwnProperty.call(opts, "space") ? opts.space : 2;
  const suffixNewline = Object.prototype.hasOwnProperty.call(opts, "suffixNewline") ? !!opts.suffixNewline : true;

  if (typeof absPath !== "string" || !absPath.trim()) {
    throw new Error("writeJsonUtf8Lf: absPath must be a non-empty string.");
  }

  const outPath = path.resolve(absPath);
  const parent = path.dirname(outPath);
  fs.mkdirSync(parent, { recursive: true });

  const json = JSON.stringify(obj, null, space) + (suffixNewline ? "\n" : "");
  fs.writeFileSync(outPath, normalizeLf(json), { encoding: "utf8" });

  return outPath;
}

// IMPORTANT: tests expect a { status, stdout, stderr } shape (like spawnSync).
export function runRegistryLawGuard(repoRootAbs) {
  const cwd = path.resolve(String(repoRootAbs));
  const node = process.execPath;

  const r = spawnSync(node, ["ci/guards/registry_law_guard.mjs"], {
    cwd,
    encoding: "utf8",
    stdio: "pipe"
  });

  return {
    status: typeof r.status === "number" ? r.status : 1,
    stdout: String(r.stdout || ""),
    stderr: String(r.stderr || "")
  };
}