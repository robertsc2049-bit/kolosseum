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

function isWorkflow(p) {
  const lower = p.toLowerCase();
  return lower.startsWith(".github/workflows/") && (lower.endsWith(".yml") || lower.endsWith(".yaml"));
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

function main() {
  const tracked = gitLsFilesZ();

  const guards = tracked.filter(isGuard);
  if (!guards.length) die("[ERR] guards_entrypoint_coverage_guard: no tracked ci/guards/*.mjs files found.");

  const pkgRaw = readUtf8OrEmpty("package.json");
  if (!pkgRaw) die("[ERR] guards_entrypoint_coverage_guard: missing package.json.");

  let pkg;
  try {
    pkg = JSON.parse(pkgRaw);
  } catch (e) {
    die(`[ERR] guards_entrypoint_coverage_guard: package.json is invalid JSON\n${String(e?.message ?? e)}`.trim());
  }

  const scriptVals = [];
  const scripts = pkg?.scripts ?? {};
  for (const k of Object.keys(scripts)) {
    const v = scripts[k];
    if (typeof v === "string") scriptVals.push(v);
  }
  const scriptBlob = scriptVals.join("\n");

  const workflowFiles = tracked.filter(isWorkflow);
  let workflowBlob = "";
  for (const p of workflowFiles) workflowBlob += "\n" + readUtf8OrEmpty(p);

  const referenced = new Set();
  for (const p of guards) {
    const base = p.split("/").pop();
    const needle = `ci/guards/${base}`;
    if (scriptBlob.includes(needle) || workflowBlob.includes(needle)) referenced.add(p);
  }

  const missing = guards.filter((p) => !referenced.has(p));

  if (missing.length) {
    console.error("[ERR] Unreferenced guard(s) detected. Every ci/guards/*.mjs must be referenced by an entrypoint (package.json scripts or workflow YAML). Missing:");
    for (const p of missing) console.error(`- ${p}`);
    die("[ERR] guards_entrypoint_coverage_guard failed.");
  }

  console.log("OK: guards_entrypoint_coverage_guard");
}

main();
