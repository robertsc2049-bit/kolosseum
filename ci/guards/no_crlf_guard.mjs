// @law: Encoding Hygiene
// @severity: high
// @scope: repo

// DEV NOTE: No-CRLF guard. This script protects byte-stable repo hygiene by
// scanning tracked text-like files and failing when CRLF line endings are present.
// LF-only text keeps generated artefacts, canonical hashes, and cross-platform
// diffs stable between Windows workstations and CI.

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

// DEV NOTE: Extension allowlist limits the CRLF scan to text-like repo files where
// LF-only line endings are required. PowerShell files are intentionally not listed
// here; separate guards cover PowerShell encoding and writer policy.
const exts = new Set([".json", ".mjs", ".js", ".ts", ".md", ".yml", ".yaml", ".sql", ".txt"]);

let files = [];
try {
  files = sh("git ls-files")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  die(`\u274C no_crlf_guard: git ls-files failed (${e?.message ?? e})`);
}

const offenders = [];

// DEV NOTE: Scan exact tracked file paths only. Missing worktree files are ignored
// because git state remains the authority and clean-tree guards own missing/dirty
// worktree enforcement.
for (const f of files) {
  const dot = f.lastIndexOf(".");
  const ext = dot >= 0 ? f.slice(dot).toLowerCase() : "";
  if (!exts.has(ext)) continue;

  let s;
  try {
    s = readFileSync(f, "utf8").replace(/^\uFEFF/, "");
  } catch {
    continue;
  }

  // DEV NOTE: CRLF is detected after optional BOM stripping. The check stays
  // literal so files must be fixed at the source rather than normalised away.
  if (s.includes("\r\n")) offenders.push(f);
}

if (offenders.length) {
  die(`\u274C no_crlf_guard: CRLF detected in:\n- ${offenders.join("\n- ")}\nNormalize to LF.`);
}

// DEV NOTE: Success means tracked text-like files with covered extensions do not
// contain CRLF. It does not prove BOM absence, strict JSON shape, or generated
// artefact parity; those are covered by separate guards.
console.log("OK: no_crlf_guard");
