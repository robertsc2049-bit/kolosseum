#!/usr/bin/env node
/**
 * CI GUARD: no_legacy_constraints
 * Fails if any legacy constraint keys remain anywhere we care about.
 *
 * Cross-platform: Node only (no bash dependency).
 */
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();

// Keep this tight: these should never appear again.
const BANNED_PATTERNS = [
  "banned_equipment_ids",
  "available_equipment_ids"
];

// Where to scan. Keep it deterministic and cheap.
const INCLUDE_DIRS = [
  "engine/src",
  "ci/schemas",
  "test",
  "docs",
  "cli/src"
];

const IGNORE_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache"
]);

const TEXT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".txt",
  ".sh" // ok to scan if it exists
]);

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTS.has(ext);
}

function shouldIgnoreDir(dirName) {
  return IGNORE_DIR_NAMES.has(dirName);
}

function listFilesRecursively(rootDir) {
  const out = [];
  const stack = [rootDir];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;

    let stat;
    try {
      stat = fs.statSync(cur);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const base = path.basename(cur);
      if (shouldIgnoreDir(base)) continue;

      let entries = [];
      try {
        entries = fs.readdirSync(cur);
      } catch {
        continue;
      }

      for (const e of entries) {
        stack.push(path.join(cur, e));
      }
      continue;
    }

    if (stat.isFile() && isTextFile(cur)) out.push(cur);
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function readText(filePath) {
  // Read as utf8; if a file has weird encoding, treat as non-text and skip
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function findAllOccurrences(haystack, needle) {
  const hits = [];
  let idx = 0;
  while (true) {
    const next = haystack.indexOf(needle, idx);
    if (next === -1) break;
    hits.push(next);
    idx = next + needle.length;
  }
  return hits;
}

function posToLineCol(text, pos) {
  // Fast enough for our repo sizes
  const before = text.slice(0, pos);
  const lines = before.split(/\r?\n/);
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

function scanFile(filePath) {
  const text = readText(filePath);
  if (text === null) return [];

  const results = [];
  for (const pat of BANNED_PATTERNS) {
    const occ = findAllOccurrences(text, pat);
    for (const pos of occ) {
      const { line, col } = posToLineCol(text, pos);
      results.push({ pattern: pat, filePath, line, col });
    }
  }
  return results;
}

function main() {
  const startDirs = INCLUDE_DIRS
    .map((d) => path.join(REPO_ROOT, d))
    .filter((p) => fs.existsSync(p));

  if (startDirs.length === 0) {
    console.error("[no_legacy_constraints] Nothing to scan (missing target dirs).");
    process.exit(1);
  }

  const files = [];
  for (const d of startDirs) {
    files.push(...listFilesRecursively(d));
  }

  const hits = [];
  for (const f of files) {
    hits.push(...scanFile(f));
  }

  if (hits.length === 0) {
    console.log("[no_legacy_constraints] OK: no legacy constraint keys found.");
    process.exit(0);
  }

  // Stable output ordering
  hits.sort((a, b) =>
    a.filePath.localeCompare(b.filePath) ||
    a.pattern.localeCompare(b.pattern) ||
    a.line - b.line ||
    a.col - b.col
  );

  console.error("[no_legacy_constraints] FAIL: legacy constraint keys found:");
  for (const h of hits) {
    const rel = path.relative(REPO_ROOT, h.filePath);
    console.error(`- ${rel}:${h.line}:${h.col}  -> ${h.pattern}`);
  }

  console.error("");
  console.error("Fix: remove legacy keys entirely (no fallbacks). Canonical keys only:");
  console.error("- banned_equipment");
  console.error("- available_equipment");
  console.error("- avoid_joint_stress_tags");
  process.exit(1);
}

main();
