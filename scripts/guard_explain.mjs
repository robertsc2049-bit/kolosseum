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

const q = (process.argv.slice(2).join(" ") || "").trim();
if (!q) {
  die(
    [
      "Usage:",
      "  node scripts/guard_explain.mjs <name-or-path>",
      "",
      "Examples:",
      "  node scripts/guard_explain.mjs clean_tree_guard",
      "  node scripts/guard_explain.mjs ci/guards/no_crlf_guard.mjs",
      ""
    ].join("\n")
  );
}

const exts = new Set([".mjs", ".ps1", ".sh"]);

function listGuards() {
  const out = [];
  for (const ent of fs.readdirSync(guardsDir, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!exts.has(ext)) continue;
    out.push(path.join(guardsDir, ent.name));
  }
  return out;
}

function norm(s) {
  return String(s).toLowerCase().replace(/\\/g, "/");
}

function resolveTarget(query) {
  const nq = norm(query);

  // exact path
  const direct = path.isAbsolute(query) ? query : path.join(repo, query);
  if (exists(direct)) return direct;

  const files = listGuards();

  // exact filename
  for (const f of files) {
    if (norm(path.basename(f)) === nq) return f;
  }

  // substring match
  const hits = files.filter((f) => norm(f).includes(nq) || norm(path.basename(f)).includes(nq));
  if (hits.length === 1) return hits[0];

  if (hits.length === 0) {
    die(`No guard matched: ${query}`);
  }

  die(
    [
      `Ambiguous guard query: ${query}`,
      "",
      "Matches:",
      ...hits.map((h) => `  - ${path.relative(repo, h).replace(/\\/g, "/")}`)
    ].join("\n")
  );
}

function parseMeta(txt, ext) {
  const lines = lf(txt).split("\n");
  const isHash = ext === ".ps1" || ext === ".sh";

  const reLaw = isHash ? /^#\s*@law\s*:\s*(.+)\s*$/i : /^\/\/\s*@law\s*:\s*(.+)\s*$/i;
  const reSeverity = isHash ? /^#\s*@severity\s*:\s*(.+)\s*$/i : /^\/\/\s*@severity\s*:\s*(.+)\s*$/i;
  const reScope = isHash ? /^#\s*@scope\s*:\s*(.+)\s*$/i : /^\/\/\s*@scope\s*:\s*(.+)\s*$/i;

  let law = "";
  let severity = "";
  let scope = "";

  for (const l of lines.slice(0, 120)) {
    let m = l.match(reLaw); if (m) { law = (m[1] || "").trim(); continue; }
    m = l.match(reSeverity); if (m) { severity = (m[1] || "").trim(); continue; }
    m = l.match(reScope); if (m) { scope = (m[1] || "").trim(); continue; }
  }

  // Extract a short rationale/policy excerpt: first ~12 comment lines excluding meta + banners.
  const commentRe = isHash ? /^#\s*(.*)$/ : /^\/\/\s*(.*)$/;
  const excerpt = [];
  for (const l of lines.slice(0, 200)) {
    if (reLaw.test(l) || reSeverity.test(l) || reScope.test(l)) continue;
    const m = l.match(commentRe);
    if (!m) {
      if (excerpt.length) break; // stop after first block
      continue;
    }
    const s = (m[1] || "").trimEnd();
    if (!s) {
      if (excerpt.length) break;
      continue;
    }
    if (/^ci\/guards\//i.test(s)) continue;
    excerpt.push(s);
    if (excerpt.length >= 12) break;
  }

  return { law, severity, scope, excerpt };
}

const file = resolveTarget(q);
const rel = path.relative(repo, file).replace(/\\/g, "/");
const ext = path.extname(file).toLowerCase();
const txt = fs.readFileSync(file, "utf8");
const meta = parseMeta(txt, ext);

const runHint = ext === ".mjs"
  ? `node ${rel}`
  : ext === ".ps1"
    ? `pwsh -NoProfile -ExecutionPolicy Bypass -File ${rel}`
    : `sh ${rel}`;

const out = [
  `== Guard ==`,
  `Path:     ${rel}`,
  `Run:      ${runHint}`,
  ``,
  `== Metadata ==`,
  `@law:      ${meta.law || "(missing)"}`,
  `@severity: ${meta.severity || "(missing)"}`,
  `@scope:    ${meta.scope || "(missing)"}`,
  ``,
  `== Excerpt ==`,
  ...(meta.excerpt.length ? meta.excerpt.map((l) => `- ${l}`) : ["(no comment excerpt found)"]),
  ``
].join("\n");

process.stdout.write(out);