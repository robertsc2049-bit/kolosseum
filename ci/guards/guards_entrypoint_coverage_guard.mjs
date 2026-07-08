// @law: CI Integrity
// @severity: high
// @scope: repo

// DEV NOTE: Guard entrypoint coverage guard. This script protects CI integrity by
// proving every tracked ci/guards/*.mjs file is reachable from at least one declared
// package or workflow entrypoint. A guard that is committed but never referenced is
// dormant protection, so this check fails closed until the entrypoint map is updated.

import fs from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Messages are trimmed so multi-line reports remain readable in CI and PowerShell
 * output without trailing whitespace noise.
 */
function die(msg) {
  console.error(String(msg).trimEnd());
  process.exit(1);
}

/**
 * DEV NOTE: Read tracked files from git using NUL separation. This avoids hidden
 * filesystem discovery and ensures the guard only evaluates committed repo
 * surfaces that CI and review can see.
 */
function gitLsFilesZ() {
  const r = spawnSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  if (r.status !== 0) {
    const err = Buffer.isBuffer(r.stderr) ? r.stderr.toString("utf8") : String(r.stderr ?? "");
    die(`[ERR] guards_entrypoint_coverage_guard: git ls-files failed\n${err}`.trim());
  }
  const out = r.stdout;
  const files = [];
  let start = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === 0) {
      const s = out.slice(start, i).toString("utf8");
      if (s) files.push(s);
      start = i + 1;
    }
  }
  return files;
}

/**
 * DEV NOTE: Identify guard files by the tracked repo path, not by arbitrary disk
 * search. Only ci/guards/*.mjs is in scope for this coverage contract.
 */
function isGuard(p) {
  const lower = p.toLowerCase();
  return lower.startsWith("ci/guards/") && lower.endsWith(".mjs");
}

/**
 * DEV NOTE: Read required UTF-8 files and fail on any read problem.
 * Required files define the coverage contract, so missing or unreadable content
 * must not be treated as an empty input.
 */
function readUtf8OrDie(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    die(`[ERR] guards_entrypoint_coverage_guard: failed reading ${p}\n${String(e?.message ?? e)}`.trim());
  }
}

/**
 * DEV NOTE: Read optional declared workflow files while tolerating ENOENT only.
 * Missing tracked workflow paths are reported separately; other read errors remain
 * hard failures because the entrypoint source cannot be trusted.
 */
function readUtf8OrEmpty(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/ENOENT/.test(msg)) return "";
    die(`[ERR] guards_entrypoint_coverage_guard: failed reading ${p}\n${msg}`.trim());
  }
}

/**
 * DEV NOTE: Parse strict JSON contract files with a guard-owned error.
 * _entrypoints.json and package.json must stay machine-readable for coverage
 * proof; JSONC, comments, and malformed JSON are not accepted.
 */
function parseJsonOrDie(path, raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    die(`[ERR] guards_entrypoint_coverage_guard: ${path} is invalid JSON\n${String(e?.message ?? e)}`.trim());
  }
}

/**
 * DEV NOTE: Main coverage proof. The guard intentionally reads only:
 * 1. tracked ci/guards/*.mjs files;
 * 2. declared package.json scripts from _entrypoints.json; and
 * 3. declared workflow files from _entrypoints.json.
 * Do not replace this with broad workflow/package scanning because the declared
 * entrypoint map is the reviewed source of coverage authority.
 */
function main() {
  const tracked = gitLsFilesZ();

  const guards = tracked.filter(isGuard);
  if (!guards.length) die("[ERR] guards_entrypoint_coverage_guard: no tracked ci/guards/*.mjs files found.");

  const entrypointsPath = "ci/guards/_entrypoints.json";
  const entryRaw = readUtf8OrDie(entrypointsPath);
  const entry = parseJsonOrDie(entrypointsPath, entryRaw);

  const scriptNames = Array.isArray(entry?.package_json_scripts) ? entry.package_json_scripts : null;
  const workflowFiles = Array.isArray(entry?.workflow_files) ? entry.workflow_files : null;

  // DEV NOTE: package_json_scripts is mandatory and must be non-empty because at
  // least one package entrypoint must own guard coverage in local validation.
  if (!scriptNames || !scriptNames.length) {
    die("[ERR] guards_entrypoint_coverage_guard: _entrypoints.json must define non-empty package_json_scripts array.");
  }

  // DEV NOTE: workflow_files must be present even when empty. This makes the
  // absence of workflow coverage explicit rather than silently inferred.
  if (!workflowFiles) {
    die("[ERR] guards_entrypoint_coverage_guard: _entrypoints.json must define workflow_files array (may be empty).");
  }

  for (const s of scriptNames) {
    if (typeof s !== "string" || !s.trim()) {
      die("[ERR] guards_entrypoint_coverage_guard: package_json_scripts contains a non-string/empty entry.");
    }
  }
  for (const w of workflowFiles) {
    if (typeof w !== "string" || !w.trim()) {
      die("[ERR] guards_entrypoint_coverage_guard: workflow_files contains a non-string/empty entry.");
    }
  }

  // DEV NOTE: Load package.json and collect only the declared scripts. This keeps
  // coverage bound to the reviewed entrypoint list rather than every incidental
  // script in the package file.
  const pkgRaw = readUtf8OrDie("package.json");
  const pkg = parseJsonOrDie("package.json", pkgRaw);

  const scripts = pkg?.scripts ?? {};
  const scriptVals = [];
  const missingScripts = [];
  for (const name of scriptNames) {
    const v = scripts[name];
    if (typeof v !== "string") missingScripts.push(name);
    else scriptVals.push(v);
  }
  if (missingScripts.length) {
    console.error("[ERR] guards_entrypoint_coverage_guard: _entrypoints.json references missing package.json script(s):");
    for (const s of missingScripts) console.error(`- ${s}`);
    die("[ERR] guards_entrypoint_coverage_guard failed.");
  }

  const scriptBlob = scriptVals.join("\n");

  // DEV NOTE: Load only declared workflow files and require them to be tracked.
  // This prevents untracked local workflow files from satisfying guard coverage.
  const trackedSet = new Set(tracked);
  const missingWorkflows = [];
  let workflowBlob = "";
  for (const wf of workflowFiles) {
    if (!trackedSet.has(wf)) missingWorkflows.push(wf);
    else workflowBlob += "\n" + readUtf8OrEmpty(wf);
  }
  if (missingWorkflows.length) {
    console.error("[ERR] guards_entrypoint_coverage_guard: _entrypoints.json references workflow file(s) that are not tracked by git:");
    for (const w of missingWorkflows) console.error(`- ${w}`);
    die("[ERR] guards_entrypoint_coverage_guard failed.");
  }

  // DEV NOTE: A guard is covered when its concrete ci/guards/<file>.mjs path appears
  // in at least one declared entrypoint source. Matching by concrete path avoids
  // accidental coverage from partial names, aliases, or broad directory references.
  const referenced = new Set();
  const blobs = [scriptBlob, workflowBlob];

  for (const p of guards) {
    const base = p.split("/").pop();
    const needle = `ci/guards/${base}`;
    let ok = false;
    for (const b of blobs) {
      if (b.includes(needle)) { ok = true; break; }
    }
    if (ok) referenced.add(p);
  }

  // DEV NOTE: Missing coverage means a guard exists but is not called by any
  // declared validation entrypoint. Fix by wiring the guard into an approved
  // package/workflow entrypoint and updating _entrypoints.json when required.
  const missing = guards.filter((p) => !referenced.has(p));
  if (missing.length) {
    console.error("[ERR] Unreferenced guard(s) detected. Every ci/guards/*.mjs must be referenced by at least one DECLARED entrypoint:");
    console.error(`- package.json scripts: ${scriptNames.join(", ")}`);
    console.error(`- workflow files: ${workflowFiles.join(", ") || "(none)"}`);
    console.error("");
    console.error("Missing:");
    for (const p of missing) console.error(`- ${p}`);
    die("[ERR] guards_entrypoint_coverage_guard failed.");
  }

  // DEV NOTE: Success means every tracked guard file is covered by a declared
  // entrypoint source. It does not prove the individual guard semantics; those are
  // owned by each guard's own checks and tests.
  console.log("OK: guards_entrypoint_coverage_guard");
}

main();
