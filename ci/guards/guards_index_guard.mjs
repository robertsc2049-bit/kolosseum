// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function lf(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normRel(p) {
  return String(p).replace(/\\/g, "/");
}

// Locale-independent ASCII comparator.
function asciiCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

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

const exts = new Set([".mjs", ".ps1", ".sh"]);

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

function renderGeneratedIndex() {
  const r = spawnSync(process.execPath, [genScript], {
    cwd: repo,
    encoding: "utf8"
  });

  if (r.error) die(`FAIL: spawn guard_index_gen: ${String(r.error?.message || r.error)}`);
  if (r.status !== 0) die(`FAIL: guard_index_gen exited ${r.status}\n${String(r.stderr || "").trim()}`);

  return lf(String(r.stdout || ""));
}

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

  console.log("OK: guards_index_guard");
}

main();
