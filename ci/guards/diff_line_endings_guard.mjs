// @law: Encoding Hygiene
// @severity: high
// @scope: repo

// DEV NOTE: Diff line-ending guard. This script checks changed text files between
// BASE_SHA and HEAD_SHA for UTF-8 BOM and CRLF drift. It is intentionally diff
// scoped so historical files are not re-litigated unless they are touched.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

/**
 * DEV NOTE: Run a command without shell expansion and return trimmed stdout.
 * Git output is the source of truth for the changed-file set and binary detection,
 * so command failures must be handled by the caller as guard failures or skips.
 */
function sh(args, opts = {}) {
  return execFileSync(args[0], args.slice(1), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  }).trim();
}

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Encoding failures should be readable in CI output rather than surfacing as
 * unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

const base = (process.env.BASE_SHA || "").trim();
const head = (process.env.HEAD_SHA || "").trim();

// DEV NOTE: BASE_SHA and HEAD_SHA are required because this guard is deliberately
// diff scoped. Without both SHAs, it cannot know which changed files to check, so
// local ad-hoc runs skip instead of scanning the whole repo.
if (!base || !head) {
  console.log("diff_line_endings_guard: SKIP (BASE_SHA/HEAD_SHA not set).");
  process.exit(0);
}

let names = "";
try {
  // DEV NOTE: ACMRT limits the scan to added, copied, modified, renamed, and type
  // changed files. Deleted files are ignored because there is no working-tree file
  // to inspect for current line-ending or BOM state.
  names = sh(["git", "diff", "--name-only", "--diff-filter=ACMRT", base, head]);
} catch {
  die(`diff_line_endings_guard: FAILED to compute git diff (${base}..${head}).`);
}

const files = names
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

if (files.length === 0) {
  console.log("diff_line_endings_guard: OK (no changed files).");
  process.exit(0);
}

/**
 * DEV NOTE: Use git diff --numstat to avoid scanning binary files as text.
 * A leading dash in numstat is Git's binary marker, which keeps this guard focused
 * on text encoding hygiene rather than image/archive bytes.
 */
function isBinaryByNumstat(file) {
  try {
    const out = sh(["git", "diff", "--numstat", base, head, "--", file]);
    if (!out) return false;
    const first = out.split("\n")[0].split("\t")[0];
    return first === "-";
  } catch {
    return false;
  }
}

const offenders = [];

// DEV NOTE: Inspect the current working-tree bytes for each changed text file.
// Missing files are skipped defensively because rename/type-change edge cases can
// leave diff entries without a file to read at this point.
for (const f of files) {
  if (!existsSync(f)) continue;
  if (isBinaryByNumstat(f)) continue;

  const buf = readFileSync(f);

  const hasBom =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;

  let crlfCount = 0;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) crlfCount++;
  }

  if (hasBom || crlfCount > 0) {
    offenders.push({ file: f, bom: hasBom, crlf: crlfCount });
  }
}

// DEV NOTE: Report each offending file with the specific byte-level problem.
// Do not fix this by weakening the guard; fix the changed files to UTF-8 no BOM
// and LF-only line endings.
if (offenders.length) {
  console.error("\u274C diff_line_endings_guard failed. New violations detected:");
  for (const o of offenders) {
    const parts = [];
    if (o.bom) parts.push("UTF-8 BOM");
    if (o.crlf) parts.push(`CRLF x${o.crlf}`);
    console.error(`- ${o.file}: ${parts.join(", ")}`);
  }
  console.error("");
  console.error("Fix: ensure UTF-8 (no BOM) and LF-only line endings.");
  process.exit(1);
}

console.log(`diff_line_endings_guard: OK (${files.length} changed files checked).`);
process.exit(0);
