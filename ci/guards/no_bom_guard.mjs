// @law: Encoding Hygiene
// @severity: high
// @scope: repo

// DEV NOTE: No-BOM guard. This script protects byte-stable repo hygiene by
// scanning tracked text-like files and failing when any file starts with a UTF-8
// BOM. BOM bytes can break canonical hashes, generated artefact parity, and
// cross-platform diffs, especially when files are edited on Windows.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Encoding failures should be readable in CI and PowerShell output rather than
 * surfacing as unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Run a read-only shell command and return UTF-8 stdout.
 * This guard uses git ls-files as the tracked-file source of truth so untracked
 * local files cannot create noisy failures.
 */
function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

// DEV NOTE: Extension allowlist limits the BOM scan to text-like repo files where
// a UTF-8 BOM is never expected. Additions should be deliberate because this guard
// reads raw bytes from every tracked file with a matching extension.
const exts = new Set([".json", ".mjs", ".js", ".ts", ".md", ".yml", ".yaml", ".sql", ".txt", ".ps1"]);

let files = [];
try {
  files = sh("git ls-files")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  die(`\u274C no_bom_guard: git ls-files failed (${e?.message ?? e})`);
}

const offenders = [];

// DEV NOTE: Scan exact tracked file paths only. Missing worktree files are ignored
// because git state remains the authority and other guards handle clean-tree
// enforcement.
for (const f of files) {
  const dot = f.lastIndexOf(".");
  const ext = dot >= 0 ? f.slice(dot).toLowerCase() : "";
  if (!exts.has(ext)) continue;

  let buf;
  try {
    buf = readFileSync(f);
  } catch {
    continue; // ignore missing in worktree
  }

  // DEV NOTE: UTF-8 BOM is exactly EF BB BF at byte 0. Any matching tracked file is
  // rejected so encoding drift is fixed at the source rather than normalised away.
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    offenders.push(f);
  }
}

if (offenders.length) {
  die(`\u274C no_bom_guard: UTF-8 BOM detected in:\n- ${offenders.join("\n- ")}\nFix by rewriting as UTF-8 without BOM.`);
}

// DEV NOTE: Success means tracked text-like files with covered extensions do not
// start with a UTF-8 BOM. It does not prove line-ending, JSON shape, or generated
// artefact parity; those are covered by separate guards.
console.log("OK: no_bom_guard");
