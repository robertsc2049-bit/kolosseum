import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function lf(s){ return String(s).replace(/\r\n/g, "\n"); }

const repo = process.cwd();

const roots = [
  path.join(repo, "scripts"),
  path.join(repo, "ci"),
];

const exts = new Set([".ps1", ".psm1"]);

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

function relPosix(absPath){
  return path.relative(repo, absPath).replace(/\\/g, "/");
}

// Policy: Invoke-NodeE is the ONLY allowed interface for ad-hoc Node from PowerShell.
// Ban everywhere except the two allowed files:
//  - references to internal runner scripts (legacy names + new path)
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

// Any mention of these runner filenames/paths in other scripts is a policy breach.
// Keep legacy names so old references get caught.
const reInternalRunnerRef = /\b(?:node-e|_node-e|_internal_node_runner)\.ps1\b|scripts\/_impl\/node_runner\.ps1\b/i;

// node -e (option can appear after other flags)
const reNodeDashE = /\bnode(?:\.exe)?\b[\s\S]{0,120}?\s-e\b/i;

// node --input-type=module -  (stdin ESM)
const reNodeStdinEsm =
  /\bnode(?:\.exe)?\b[\s\S]{0,200}?\b--input-type\s*=\s*module\b[\s\S]{0,200}?\s-\b/i;

// Block "impl folder" references anywhere else (discourages bypass patterns)
const reImplFolderRef = /\b_impl\b/i;

const offenders = [];

for (const root of roots) {
  for (const file of walk(root)) {
    const rel = relPosix(file);
    if (allowRel.has(rel)) continue;

    const txt = lf(fs.readFileSync(file, "utf8"));

    const hits = [];
    if (reInternalRunnerRef.test(txt)) hits.push("direct internal runner reference");
    if (reNodeDashE.test(txt)) hits.push("node -e");
    if (reNodeStdinEsm.test(txt)) hits.push("node --input-type=module -");
    if (reImplFolderRef.test(txt)) hits.push("impl folder reference");

    if (hits.length) offenders.push({ rel, hits });
  }
}

if (offenders.length) {
  const lines = [];
  lines.push("❌ ban_direct_node_e_ref_guard: forbidden Node invocation detected in PowerShell.");
  lines.push("");
  lines.push("Policy: Use scripts/Invoke-NodeE.ps1 for any Node patching.");
  lines.push("Internal runner is implementation-only and must not be referenced directly.");
  lines.push("Direct `node -e` and `node --input-type=module -` are blocked.");
  lines.push("Impl-folder references are blocked outside the allowlist.");
  lines.push("");
  lines.push("Offending file(s):");
  for (const o of offenders) lines.push(`  - ${o.rel}  [${o.hits.join(", ")}]`);
  lines.push("");
  die(lines.join("\\n"));
}

console.log("OK: ban_direct_node_e_ref_guard");
