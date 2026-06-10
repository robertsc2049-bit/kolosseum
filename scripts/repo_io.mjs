import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

let _repoRootAbs = null;

function getRepoRootAbsSync() {
  if (_repoRootAbs) return _repoRootAbs;

  const out = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  const root = String(out || "").trim();
  if (!root) throw new Error("repo_io: git rev-parse --show-toplevel returned empty output.");

  _repoRootAbs = path.resolve(root);
  return _repoRootAbs;
}

export function resolveRepoPathSync(p) {
  if (typeof p !== "string" || !p.trim()) throw new Error("repo_io: path must be a non-empty string.");

  const repo = getRepoRootAbsSync();
  const abs = path.isAbsolute(p) ? path.resolve(p) : path.resolve(repo, p);

  // Robust escape check across platforms.
  const rel = path.relative(repo, abs);

  // If rel starts with '..' or is absolute (different drive on Windows), it escaped.
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`repo_io: path escapes repo. repo='${repo}' path='${abs}'`);
  }

  return abs;
}

export function normalizeLf(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function writeRepoTextSync(p, text, opts = {}) {
  const { mustExist = false, createParent = false } = opts;

  const abs = resolveRepoPathSync(p);
  const parent = path.dirname(abs);

  if (mustExist && !fs.existsSync(abs)) {
    throw new Error(`repo_io: target does not exist (mustExist): ${abs}`);
  }

  if (!fs.existsSync(parent)) {
    if (createParent) fs.mkdirSync(parent, { recursive: true });
    else throw new Error(`repo_io: parent missing (refusing). parent='${parent}' path='${abs}'`);
  }

  fs.writeFileSync(abs, normalizeLf(text), { encoding: "utf8" });
  return abs;
}

export function writeRepoJsonSync(p, obj, opts = {}) {
  const space = Object.prototype.hasOwnProperty.call(opts, "space") ? opts.space : 2;
  const suffixNewline = Object.prototype.hasOwnProperty.call(opts, "suffixNewline") ? !!opts.suffixNewline : true;
  const json = JSON.stringify(obj, null, space) + (suffixNewline ? "\n" : "");
  return writeRepoTextSync(p, json, opts);
}