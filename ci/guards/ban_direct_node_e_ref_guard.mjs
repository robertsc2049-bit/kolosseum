// @law: Repo Governance
// @severity: medium
// @scope: repo

// DEV NOTE: Direct Node-from-PowerShell guard. This script protects repo patching
// discipline by forcing ad-hoc Node execution through scripts/Invoke-NodeE.ps1.
// The goal is one reviewable wrapper for Node patch behaviour, not scattered
// node -e snippets or direct calls into implementation scripts.

import fs from "node:fs";
import path from "node:path";

/**
 * DEV NOTE: Terminate with a stable message and non-zero exit code.
 * This guard reports policy breaches directly instead of throwing stack traces,
 * because failures should be readable in CI and local PowerShell output.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Normalise CRLF to LF before regex checks.
 * The policy scans content semantics, not line-ending style; separate guards can
 * own LF-only formatting where required.
 */
function lf(s){ return String(s).replace(/\r\n/g, "\n"); }

const repo = process.cwd();

// DEV NOTE: Scope is limited to scripts/ and ci/ because those are the surfaces
// where PowerShell automation and guard execution live. This avoids unrelated app
// files being pulled into a PowerShell Node invocation policy.
const roots = [
  path.join(repo, "scripts"),
  path.join(repo, "ci"),
];

const exts = new Set([".ps1", ".psm1"]);

/**
 * DEV NOTE: Recursively collect PowerShell files from the guarded roots.
 * Generated/vendor folders are skipped so the policy checks repo-owned scripts
 * rather than build output or dependency content.
 */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git") continue;
      walk(p, out);
    } else if (ent.isFile()) {
      if (exts.has(path.extname(ent.name).toLowerCase())) out.push(p);
    }
  }
  return out;
}

/**
 * DEV NOTE: Convert absolute paths to repo-relative POSIX paths for stable output.
 * CI logs and guard allowlists should not depend on Windows path separators.
 */
function relPosix(absPath){
  return path.relative(repo, absPath).replace(/\\/g, "/");
}

// Policy: Invoke-NodeE is the ONLY allowed interface for ad-hoc Node from PowerShell.
// Ban everywhere except the two allowed files:
//  - references to internal runner scripts (legacy names + new path + filename)
//  - node -e
//  - node --input-type=module -
//  - ANY mention of "\b_impl\b" (prevents "I'll just call the impl folder") outside the allowlist
//
// Allowed:
//  - scripts/Invoke-NodeE.ps1 (blessed interface)
//  - scripts/_impl/node_runner.ps1 (internal implementation; must never be called directly by other scripts)
const allowRel = new Set([
  "scripts/Invoke-NodeE.ps1",
  "scripts/_impl/node_runner.ps1",
]);

// DEV NOTE: The allowlist is intentionally tiny. The public contract is the
// Invoke-NodeE wrapper; node_runner.ps1 remains implementation-only so future
// scripts cannot couple directly to its private path, parameters, or behaviour.

// Any mention of these runner filenames/paths in other scripts is a policy breach.
// Keep legacy names so old references get caught.
const reInternalRunnerRef =
  /\b(?:node-e|_node-e|_internal_node_runner)\.ps1\b|scripts\/_impl\/node_runner\.ps1\b/i;

// Critical: block *any* mention of node_runner.ps1 outside allowlist.
// This catches dynamic path construction and pwsh/powershell -File patterns.
const reNodeRunnerFilename = /\bnode_runner\.ps1\b/i;

// node -e (option can appear after other flags)
const reNodeDashE = /\bnode(?:\.exe)?\b[\s\S]{0,120}?\s-e\b/i;

// node --input-type=module -  (stdin ESM)
const reNodeStdinEsm =
  /\bnode(?:\.exe)?\b[\s\S]{0,200}?\b--input-type\s*=\s*module\b[\s\S]{0,200}?\s-\b/i;

// Block "impl folder" references anywhere else (discourages bypass patterns)
const reImplFolderRef = /\b_impl\b/i;

// Extra: explicitly catch PowerShell invoking a file runner by name
const rePwshFileNodeRunner =
  /\b(?:pwsh|powershell)(?:\.exe)?\b[\s\S]{0,200}?\b-File\b[\s\S]{0,200}?\bnode_runner\.ps1\b/i;

const offenders = [];

// DEV NOTE: Each regex protects a different bypass path: legacy runner names,
// direct internal runner filename references, pwsh -File execution, node -e,
// stdin ESM, and _impl folder references. Keep these checks separate so failure
// output tells the developer which policy boundary was crossed.
for (const root of roots) {
  for (const file of walk(root)) {
    const rel = relPosix(file);
    if (allowRel.has(rel)) continue;

    const txt = lf(fs.readFileSync(file, "utf8"));

    const hits = [];
    if (reInternalRunnerRef.test(txt)) hits.push("direct internal runner reference");
    if (reNodeRunnerFilename.test(txt)) hits.push("node_runner filename reference");
    if (rePwshFileNodeRunner.test(txt)) hits.push("pwsh/powershell -File node_runner.ps1");
    if (reNodeDashE.test(txt)) hits.push("node -e");
    if (reNodeStdinEsm.test(txt)) hits.push("node --input-type=module -");
    if (reImplFolderRef.test(txt)) hits.push("impl folder reference");

    if (hits.length) offenders.push({ rel, hits });
  }
}

// DEV NOTE: Offender output groups all hits per file to reduce noisy CI logs.
// The message states the approved interface so a future developer knows the fix
// is to use scripts/Invoke-NodeE.ps1 rather than weaken the guard.
if (offenders.length) {
  const lines = [];
  lines.push("\u274C ban_direct_node_e_ref_guard: forbidden Node invocation detected in PowerShell.");
  lines.push("");
  lines.push("Policy: Use scripts/Invoke-NodeE.ps1 for any Node patching.");
  lines.push("Internal runner is implementation-only and must not be referenced directly.");
  lines.push("Direct `node -e` and `node --input-type=module -` are blocked.");
  lines.push("Impl-folder references are blocked outside the allowlist.");
  lines.push("Any `node_runner.ps1` reference is blocked outside the allowlist.");
  lines.push("");
  lines.push("Offending file(s):");
  for (const o of offenders) lines.push(`  - ${o.rel}  [${o.hits.join(", ")}]`);
  lines.push("");
  die(lines.join("\n"));
}

console.log("OK: ban_direct_node_e_ref_guard");
