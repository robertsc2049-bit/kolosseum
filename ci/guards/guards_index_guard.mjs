// @law: Repo Governance
// @severity: medium
// @scope: repo

// DEV NOTE: Guards index guard. This script protects guard documentation and
// discoverability by requiring every guard file to carry explicit metadata and by
// proving docs/GUARDS_INDEX.md matches the deterministic generator output. Future
// developers should be able to inspect the guard index and understand active guard
// coverage without relying on memory or hidden discovery.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Guard-index failures should be readable in CI and PowerShell output rather than
 * surfacing as unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Normalise text to LF for deterministic comparison.
 * The index comparison should not vary between Windows and CI checkout line
 * endings; separate line-ending guards own repository hygiene enforcement.
 */
function lf(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * DEV NOTE: Convert relative paths to forward-slash repo form.
 * Guard reports and generated docs should use stable repo paths across Windows and
 * Unix-like environments.
 */
function normRel(p) {
  return String(p).replace(/\\/g, "/");
}

/**
 * DEV NOTE: Locale-independent ASCII comparator.
 * Sorting must not depend on OS locale or user settings because the generated
 * guard index is a deterministic repo artefact.
 */
function asciiCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * DEV NOTE: Existence helper for required guard-index surfaces.
 * Missing guard directory, generator, or index file is a hard governance failure.
 */
function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

const repo = process.cwd();
const guardsDir = path.join(repo, "ci", "guards");
const indexPath = path.join(repo, "docs", "GUARDS_INDEX.md");
const genScript = path.join(repo, "scripts", "guard_index_gen.mjs");

if (!exists(guardsDir)) die(`Missing: ${normRel(path.relative(repo, guardsDir))}`);
if (!exists(genScript)) die(`Missing: ${normRel(path.relative(repo, genScript))}`);
if (!exists(indexPath)) die(`Missing: ${normRel(path.relative(repo, indexPath))} (run: npm run guard:index)`);

// DEV NOTE: Only executable guard file formats are indexed here. Strict JSON
// contracts and docs have their own validation paths and must not be pulled into
// this guard metadata contract by broad extension scanning.
const exts = new Set([".mjs", ".ps1", ".sh"]);

/**
 * DEV NOTE: List guard files directly under ci/guards in deterministic order.
 * This intentionally avoids recursion so nested/generated material cannot alter
 * the guard index without an explicit contract change.
 */
function listGuardsRel() {
  const out = [];
  for (const ent of fs.readdirSync(guardsDir, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!exts.has(ext)) continue;
    const abs = path.join(guardsDir, ent.name);
    out.push(normRel(path.relative(repo, abs)));
  }
  out.sort(asciiCompare);
  return out;
}

/**
 * DEV NOTE: Require explicit @law, @severity, and @scope tags near the top of each
 * guard. JavaScript uses // tags while PowerShell/shell guards use # tags. The
 * first 160 lines are scanned so metadata can sit below shebangs or short headers
 * without allowing hidden metadata far inside implementation code.
 */
function requireMeta(rel, txt, ext) {
  const lines = lf(txt).split("\n").slice(0, 160);
  const isHash = ext === ".ps1" || ext === ".sh";

  const reLaw = isHash ? /^#\s*@law\s*:\s*(.+)\s*$/i : /^\/\/\s*@law\s*:\s*(.+)\s*$/i;
  const reSeverity = isHash ? /^#\s*@severity\s*:\s*(.+)\s*$/i : /^\/\/\s*@severity\s*:\s*(.+)\s*$/i;
  const reScope = isHash ? /^#\s*@scope\s*:\s*(.+)\s*$/i : /^\/\/\s*@scope\s*:\s*(.+)\s*$/i;

  let law = "";
  let severity = "";
  let scope = "";

  for (const l of lines) {
    let m = l.match(reLaw); if (m) { law = (m[1] || "").trim(); continue; }
    m = l.match(reSeverity); if (m) { severity = (m[1] || "").trim(); continue; }
    m = l.match(reScope); if (m) { scope = (m[1] || "").trim(); continue; }
  }

  const missing = [];
  if (!law) missing.push("@law");
  if (!severity) missing.push("@severity");
  if (!scope) missing.push("@scope");

  if (missing.length) {
    die(
      [
        `FAIL: guard metadata missing in ${rel}`,
        `Missing: ${missing.join(", ")}`,
        `Fix: add the tags near the top (or run: npm run guard:index to auto-apply defaults).`
      ].join("\n")
    );
  }
}

/**
 * DEV NOTE: Generate the expected guard index through the canonical generator.
 * The guard compares against stdout only, so guard_index_gen.mjs remains the single
 * implementation for index rendering and this file only enforces parity.
 */
function renderGeneratedIndex() {
  const r = spawnSync(process.execPath, [genScript], {
    cwd: repo,
    encoding: "utf8"
  });

  if (r.error) die(`FAIL: spawn guard_index_gen: ${String(r.error?.message || r.error)}`);
  if (r.status !== 0) die(`FAIL: guard_index_gen exited ${r.status}\n${String(r.stderr || "").trim()}`);

  return lf(String(r.stdout || ""));
}

/**
 * DEV NOTE: Main guard-index proof.
 * Step 1 proves every executable guard has explicit metadata.
 * Step 2 proves docs/GUARDS_INDEX.md exactly matches deterministic generator
 * output. Do not hand-edit the index to satisfy review; regenerate through
 * npm run guard:index when guard surfaces change.
 */
function main() {
  // 1) Enforce explicit metadata in every guard file (no heuristic dependency).
  const relFiles = listGuardsRel();
  for (const rel of relFiles) {
    const abs = path.join(repo, rel);
    const ext = path.extname(abs).toLowerCase();
    const txt = fs.readFileSync(abs, "utf8");
    requireMeta(rel, txt, ext);
  }

  // 2) Enforce GUARDS_INDEX.md matches deterministic generator output.
  const onDisk = lf(fs.readFileSync(indexPath, "utf8"));
  const generated = renderGeneratedIndex();

  if (onDisk !== generated) {
    const hint = "Run: npm run guard:index (this must be clean + deterministic).";
    die(`FAIL: docs/GUARDS_INDEX.md is out of date.\n${hint}`);
  }

  // DEV NOTE: Success means guard metadata is present and the rendered index is
  // current. It does not prove the semantics of each individual guard.
  console.log("OK: guards_index_guard");
}

main();
