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
      // Skip heavy/noisy dirs if they exist
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git") continue;
      walk(p, out);
    } else if (ent.isFile()) {
      if (exts.has(path.extname(ent.name).toLowerCase())) out.push(p);
    }
  }
  return out;
}

// Ban: Set-Content with -Encoding UTF8 (case-insensitive), anywhere in ps files under scripts/ or ci/
const re = /\bSet-Content\b[\s\S]{0,400}?\b-Encoding\b[\s\S]{0,50}?\bUTF8\b/i;

const offenders = [];

for (const root of roots) {
  for (const file of walk(root)) {
    const txt = lf(fs.readFileSync(file, "utf8"));
    if (re.test(txt)) offenders.push(path.relative(repo, file));
  }
}

if (offenders.length) {
  die(
    [
      "❌ ban_set_content_utf8_guard: forbidden usage detected.",
      "",
      "Reason: `Set-Content -Encoding UTF8` is a BOM/encoding footgun and causes repo churn.",
      "Use scripts/Write-Utf8NoBomLf.ps1 for repo text writes, or the node-e/Invoke-NodeE flow.",
      "",
      "Offending file(s):",
      ...offenders.map(f => `  - ${f}`),
      "",
    ].join("\n")
  );
}

console.log("OK: ban_set_content_utf8_guard");
