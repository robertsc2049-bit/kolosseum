import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function lf(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

const repo = process.cwd();
const guardsDir = path.join(repo, "ci", "guards");
if (!exists(guardsDir)) die(`Missing: ${path.relative(repo, guardsDir)}`);

// Guards that are generated / installer-bound.
// DO NOT auto-inject headers into these (installer payloads expect exact content).
const SKIP_BASENAMES = new Set([
  "green_ci_parity_guard.mjs",
  "readme_validation_contract_guard.mjs",
]);

const exts = new Set([".mjs", ".ps1", ".sh"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) continue;
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!exts.has(ext)) continue;
    if (SKIP_BASENAMES.has(path.basename(p))) continue;
    out.push(p);
  }
  return out;
}

function inferMeta(rel) {
  const name = rel.replace(/\\/g, "/").split("/").pop() || rel;

  let law = "Repo Governance";
  let severity = "medium";
  let scope = "repo";

  const n = name.toLowerCase();

  if (n.includes("clean_tree")) { law = "Repo Hygiene"; severity = "high"; }
  if (n.includes("no_bom") || n.includes("no_crlf") || n.includes("mojibake") || n.includes("diff_line_endings") || n.includes("ban_set_content_utf8")) {
    law = "Encoding Hygiene";
    severity = "high";
  }
  if (n.includes("node_version") || n.includes("tag_version")) { law = "Build Integrity"; severity = "high"; }
  if (n.includes("green_") || n.includes("installer_sync") || n.includes("entrypoint")) { law = "CI Integrity"; severity = "high"; }
  if (n.includes("engine_contract") || n.includes("engine_exports") || n.includes("ban_engine_src_imports") || n.includes("ban_engine_status")) {
    law = "Runtime Boundary";
    severity = "high";
    scope = "engine";
  }
  if (n.includes("registry_")) { law = "Registry Law"; severity = "high"; scope = "registry"; }
  if (n.includes("schema_guard") || n.includes("sha256_guard") || n.includes("spine_guard") || n.includes("repo_contract")) {
    law = "Contracts";
    severity = "high";
  }
  if (n.includes("golden_")) { law = "Determinism"; severity = "high"; }
  if (n.includes("lockfile_note")) { law = "Repo Hygiene"; severity = "high"; }

  return { law, severity, scope };
}

function hasMetaHeader(lines, style) {
  const tag = style === "ps1" || style === "sh" ? /^#\s*@law\s*:/i : /^\/\/\s*@law\s*:/i;
  return lines.slice(0, 30).some((l) => tag.test(l));
}

function makeHeader(style, meta) {
  const pfx = style === "ps1" || style === "sh" ? "# " : "// ";
  return [
    `${pfx}@law: ${meta.law}`,
    `${pfx}@severity: ${meta.severity}`,
    `${pfx}@scope: ${meta.scope}`,
    ""
  ].join("\n");
}

function detectStyle(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".ps1") return "ps1";
  if (ext === ".sh") return "sh";
  return "mjs";
}

const files = walk(guardsDir).sort((a, b) => a.localeCompare(b));
let changed = 0;

for (const file of files) {
  const rel = path.relative(repo, file);
  const style = detectStyle(file);
  const raw = lf(fs.readFileSync(file, "utf8"));
  const lines = raw.split("\n");

  if (hasMetaHeader(lines, style)) continue;

  const meta = inferMeta(rel);
  const hdr = makeHeader(style, meta);

  const next = hdr + raw;
  if (next !== raw) {
    fs.writeFileSync(file, next, "utf8");
    changed++;
  }
}

console.log(`OK: guard_meta_apply (${changed} file(s) updated)`);