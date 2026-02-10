// @law: CI Integrity
// @severity: high
// @scope: repo
import fs from "node:fs";
import { spawnSync } from "node:child_process";

function die(msg) {
  console.error(String(msg).trimEnd());
  process.exit(1);
}

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

function isGuard(p) {
  const lower = p.toLowerCase();
  return lower.startsWith("ci/guards/") && lower.endsWith(".mjs");
}

function readUtf8OrDie(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    die(`[ERR] guards_entrypoint_coverage_guard: failed reading ${p}\n${String(e?.message ?? e)}`.trim());
  }
}

function readUtf8OrEmpty(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/ENOENT/.test(msg)) return "";
    die(`[ERR] guards_entrypoint_coverage_guard: failed reading ${p}\n${msg}`.trim());
  }
}

function parseJsonOrDie(path, raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    die(`[ERR] guards_entrypoint_coverage_guard: ${path} is invalid JSON\n${String(e?.message ?? e)}`.trim());
  }
}

function main() {
  const tracked = gitLsFilesZ();

  const guards = tracked.filter(isGuard);
  if (!guards.length) die("[ERR] guards_entrypoint_coverage_guard: no tracked ci/guards/*.mjs files found.");

  const entrypointsPath = "ci/guards/_entrypoints.json";
  const entryRaw = readUtf8OrDie(entrypointsPath);
  const entry = parseJsonOrDie(entrypointsPath, entryRaw);

  const scriptNames = Array.isArray(entry?.package_json_scripts) ? entry.package_json_scripts : null;
  const workflowFiles = Array.isArray(entry?.workflow_files) ? entry.workflow_files : null;

  if (!scriptNames || !scriptNames.length) {
    die("[ERR] guards_entrypoint_coverage_guard: _entrypoints.json must define non-empty package_json_scripts array.");
  }
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

  // --- load package.json and collect ONLY declared scripts ---
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

  // --- load ONLY declared workflow files (must exist + be tracked) ---
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

  // --- referenced if guard path appears in ANY declared entrypoint source ---
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

  console.log("OK: guards_entrypoint_coverage_guard");
}

main();
