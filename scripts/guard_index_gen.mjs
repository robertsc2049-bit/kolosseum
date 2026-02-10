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
// NOTE: we normalize to forward slashes before comparing.
function asciiCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function normRel(p) {
  return String(p).replace(/\\/g, "/");
}

const repo = process.cwd();
const guardsDir = path.join(repo, "ci", "guards");
const outPath = path.join(repo, "docs", "GUARDS_INDEX.md");

const args = process.argv.slice(2);
const shouldWrite = args.includes("--write");

if (!exists(guardsDir)) die(`Missing: ${path.relative(repo, guardsDir)}`);

const exts = new Set([".mjs", ".ps1", ".sh"]);

function listGuardsRel() {
  const out = [];
  for (const ent of fs.readdirSync(guardsDir, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!exts.has(ext)) continue;

    const abs = path.join(guardsDir, ent.name);
    const rel = normRel(path.relative(repo, abs));
    out.push(rel);
  }
  out.sort(asciiCompare);
  return out;
}

// Deterministic heuristic (matches guard_meta_apply).
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

function parseMeta(txt, ext, basename) {
  const lines = lf(txt).split("\n").slice(0, 160);
  const isHash = ext === ".ps1" || ext === ".sh";

  const reLaw = isHash ? /^#\s*@law\s*:\s*(.+)\s*$/i : /^\/\/\s*@law\s*:\s*(.+)\s*$/i;
  const reSeverity = isHash ? /^#\s*@severity\s*:\s*(.+)\s*$/i : /^\/\/\s*@severity\s*:\s*(.+)\s*$/i;
  const reScope = isHash ? /^#\s*@scope\s*:\s*(.+)\s*$/i : /^\/\/\s*@scope\s*:\s*(.+)\s*$/i;
  const reDesc = isHash ? /^#\s*@desc\s*:\s*(.+)\s*$/i : /^\/\/\s*@desc\s*:\s*(.+)\s*$/i;

  let law = "";
  let severity = "";
  let scope = "";
  let desc = "";

  for (const l of lines) {
    let m = l.match(reLaw); if (m) { law = (m[1] || "").trim(); continue; }
    m = l.match(reSeverity); if (m) { severity = (m[1] || "").trim(); continue; }
    m = l.match(reScope); if (m) { scope = (m[1] || "").trim(); continue; }
    m = l.match(reDesc); if (m) { desc = (m[1] || "").trim(); continue; }
  }

  // description fallback: first non-empty non-meta comment line near top (legacy support)
  if (!desc) {
    const commentRe = isHash ? /^#\s*(.+)$/ : /^\/\/\s*(.+)$/;
    for (const l of lines) {
      if (reLaw.test(l) || reSeverity.test(l) || reScope.test(l) || reDesc.test(l)) continue;
      const m = l.match(commentRe);
      if (!m) continue;
      const s = (m[1] || "").trim();
      if (!s) continue;
      if (/^ci\/guards\//i.test(s)) continue;
      desc = s;
      break;
    }
  }

  // If headerless, still show meaningful metadata.
  if (!law || !severity || !scope) {
    const inf = inferMetaFromBasename(basename);
    law = law || inf.law;
    severity = severity || inf.severity;
    scope = scope || inf.scope;
  }

  return { law, severity, scope, desc };
}

function mdEscape(s) {
  return String(s).replace(/\|/g, "\\|");
}

function build() {
  const relFiles = listGuardsRel();
  const rows = [];

  for (const rel of relFiles) {
    const abs = path.join(repo, rel);
    const ext = path.extname(abs).toLowerCase();
    const basename = path.basename(abs);
    const txt = fs.readFileSync(abs, "utf8");
    const meta = parseMeta(txt, ext, basename);

    rows.push({
      guard: rel,
      law: meta.law || "(missing)",
      severity: meta.severity || "(missing)",
      scope: meta.scope || "(missing)",
      desc: meta.desc || ""
    });
  }

  const head = [
    "# Guards Index",
    "",
    "This file is **auto-generated** from `ci/guards/`.",
    "",
    "## Legend",
    "- **@law**: what rule family the guard enforces",
    "- **@severity**: low | medium | high",
    "- **@scope**: repo | engine | registry | docs | ci | ... (free-form but consistent)",
    "- **@desc**: (optional) short human description; if missing, the generator may fall back to the first top comment",
    "",
    "## Guards",
    "",
    "| Guard | @law | @severity | @scope | Description |",
    "|---|---|---|---|---|"
  ].join("\n");

  const body = rows.map((r) => {
    const link = `\`${mdEscape(r.guard)}\``;
    return `| ${link} | ${mdEscape(r.law)} | ${mdEscape(r.severity)} | ${mdEscape(r.scope)} | ${mdEscape(r.desc)} |`;
  }).join("\n");

  return head + "\n" + body + "\n";
}

const md = build();

if (shouldWrite) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md, "utf8");
  console.log(`OK: guard_index_gen --write (${normRel(path.relative(repo, outPath))})`);
} else {
  process.stdout.write(md);
}