// @law: Repo Governance
// @severity: medium
// @scope: repo

// DEV NOTE: Legacy constraint key guard. This script protects the canonical
// constraint contract by blocking deprecated equipment/exercise constraint keys
// outside the explicit negative fixture that proves those keys are refused. Real
// inputs, contracts, and implementation files must use the current constraint
// surface rather than preserving old aliases.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// DEV NOTE: Legacy keys are allowed only in explicit negative test fixtures.
// Keep this list tiny so old contract names cannot re-enter real product or engine
// surfaces through broad fixture exceptions.
const ALLOWLIST = new Set([
  "test/fixtures/golden/inputs/neg_phase1_constraints_legacy_ids_refused.json",
]);

// DEV NOTE: These keys are deprecated legacy constraint names.
// Add to this list only when a legacy key has been formally retired and must be
// blocked everywhere except approved negative fixtures.
const LEGACY_KEYS = [
  "banned_equipment_ids",
  "available_equipment_ids",
  "required_equipment_ids",
  "banned_exercise_ids",
  "allowed_exercise_ids",
];

// DEV NOTE: Scope the scan to text/code/contract file types where JSON-ish
// constraint keys can appear. Do not scan generated binary artefacts or unrelated
// file types here.
const FILE_EXTS = new Set([
  ".json",
  ".js",
  ".mjs",
  ".ts",
  ".tsx",
]);

// DEV NOTE: Skip generated, dependency, build, and VCS directories.
// This guard should validate repo-authored source/contract surfaces, not external
// packages or generated output directories.
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

/**
 * DEV NOTE: Convert paths to stable forward-slash repo form.
 * The allowlist and failure reports should be consistent across Windows and CI.
 */
function toPosix(p) {
  return p.split(path.sep).join("/");
}

/**
 * DEV NOTE: Directory skip check by basename.
 * Keeping this centralised prevents accidental traversal into generated or
 * dependency directories during recursive scans.
 */
function isSkippableDir(absPath) {
  const base = path.basename(absPath);
  return SKIP_DIRS.has(base);
}

/**
 * DEV NOTE: Recursively collect candidate files from the repo root.
 * The scan is intentionally local and deterministic: it does not use git history,
 * remote state, or package/tool discovery.
 */
function walk(absDir, out) {
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) {
      if (isSkippableDir(abs)) continue;
      walk(abs, out);
      continue;
    }
    if (!e.isFile()) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!FILE_EXTS.has(ext)) continue;
    out.push(abs);
  }
}

/**
 * DEV NOTE: Scan one file for deprecated JSON-ish key declarations.
 * The match is deliberately `"key":` so comments or prose mentioning the legacy
 * name do not fail unless they recreate the old contract key shape.
 */
function scanFile(absFile) {
  const rel = toPosix(path.relative(ROOT, absFile));
  if (ALLOWLIST.has(rel)) return [];

  let text;
  try {
    text = fs.readFileSync(absFile, "utf8");
  } catch {
    return [];
  }

  const hits = [];
  for (const k of LEGACY_KEYS) {
    // Match JSON-ish key usage: "key":
    const re = new RegExp(`"${k}"\\s*:`, "g");
    if (re.test(text)) hits.push(k);
  }

  return hits.map((k) => ({ key: k, rel }));
}

/**
 * DEV NOTE: Main legacy-constraint proof.
 * Any offender means a retired constraint key has leaked into a real repo surface.
 * Fix by migrating to the canonical constraint contract or by adding only a tightly
 * scoped negative fixture to the allowlist when it exists solely to prove refusal.
 */
function main() {
  const files = [];
  walk(ROOT, files);

  const offenders = [];
  for (const f of files) {
    offenders.push(...scanFile(f));
  }

  if (offenders.length) {
    console.error("\n\u274C Legacy constraint keys detected:\n");
    for (const o of offenders) {
      console.error(`- ${o.key} \u2192 ${o.rel}`);
    }
    console.error("\nCanonical constraint contract violated. Build blocked.\n");
    process.exit(1);
  }

  // DEV NOTE: Success means no deprecated legacy constraint key shape was found in
  // scanned real repo surfaces. It does not validate the full current constraint
  // schema; dedicated schema/contract guards own that proof.
  process.exit(0);
}

main();
