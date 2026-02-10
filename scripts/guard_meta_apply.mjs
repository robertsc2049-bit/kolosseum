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

// Locale-independent ASCII comparator.
function asciiCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function normRel(p) {
  return String(p).replace(/\\/g, "/");
}

// Deterministic heuristic (must match guard_index_gen).
function inferMetaFromBasename(basename) {
  let law = "Repo Governance";
  let severity = "medium";
  let scope = "repo";

  const n = String(basename).toLowerCase();

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
  if (n.includes("schema_guard") || n.includes("sha256_guard") || n.includes("spine_guard") || n.includes("repo_contract") || n.includes("readme_validation_contract")) {
    law = "Contracts";
    severity = "high";
  }
  if (n.includes("golden_")) { law = "Determinism"; severity = "high"; }
  if (n.includes("lockfile_note")) { law = "Repo Hygiene"; severity = "high"; }

  return { law, severity, scope };
}

const repo = process.cwd();
const guardsDir = path.join(repo, "ci", "guards");
if (!exists(guardsDir)) die(`Missing: ${normRel(path.relative(repo, guardsDir))}`);

const exts = new Set([".mjs", ".ps1", ".sh"]);

function listGuardsAbs() {
  const out = [];
  for (const ent of fs.readdirSync(guardsDir, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!exts.has(ext)) continue;
    out.push(path.join(guardsDir, ent.name));
  }
  out.sort((a, b) => asciiCompare(normRel(a), normRel(b)));
  return out;
}

function detectHeader(txt, ext) {
  const t = lf(txt);
  const lines = t.split("\n").slice(0, 200);
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

  return { law, severity, scope };
}

function buildHeader(ext, basename, have) {
  const isHash = ext === ".ps1" || ext === ".sh";
  const c = isHash ? "# " : "// ";

  const inf = inferMetaFromBasename(basename);

  const law = have.law || inf.law;
  const severity = have.severity || inf.severity;
  const scope = have.scope || inf.scope;

  // Always emit all three in a deterministic order.
  const lines = [
    `${c}@law: ${law}`,
    `${c}@severity: ${severity}`,
    `${c}@scope: ${scope}`
  ];

  return lines.join("\n") + "\n";
}

function applyOne(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const basename = path.basename(absPath);
  const rel = normRel(path.relative(repo, absPath));

  const raw = fs.readFileSync(absPath, "utf8");
  const t = lf(raw);

  const have = detectHeader(t, ext);
  const missing = (!have.law || !have.severity || !have.scope);
  if (!missing) return { updated: false, rel };

  const hdr = buildHeader(ext, basename, have);

  // Insert point:
  // - .sh: preserve shebang as very first line if present
  // - others: insert at top
  let out = t;
  if (ext === ".sh" && out.startsWith("#!")) {
    const nl = out.indexOf("\n");
    if (nl === -1) {
      out = out + "\n" + hdr;
    } else {
      const first = out.slice(0, nl + 1);
      const rest = out.slice(nl + 1);
      out = first + hdr + rest;
    }
  } else {
    out = hdr + out;
  }

  // Ensure trailing newline.
  if (!out.endsWith("\n")) out += "\n";

  fs.writeFileSync(absPath, out, "utf8");
  return { updated: true, rel };
}

function main() {
  const files = listGuardsAbs();
  let updated = 0;

  for (const f of files) {
    const r = applyOne(f);
    if (r.updated) updated++;
  }

  console.log(`OK: guard_meta_apply (${updated} file(s) updated)`);
}

main();