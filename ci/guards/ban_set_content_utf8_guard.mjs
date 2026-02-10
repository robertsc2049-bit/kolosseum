import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function lf(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

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
      continue;
    }

    if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (exts.has(ext)) out.push(p);
    }
  }

  return out;
}

/**
 * Ban PowerShell repo-footguns:
 * - Set-Content -Encoding utf8 / utf-8 / utf8BOM
 * - Add-Content -Encoding utf8 / utf-8 / utf8BOM
 * - Out-File    -Encoding utf8 / utf-8 / utf8BOM
 *
 * Intentionally does NOT flag utf8NoBOM (still prefer Write-Utf8NoBomLf.ps1 for repo writes).
 *
 * IMPORTANT:
 * - Do NOT use \b around Out-File (hyphen makes \b brittle).
 * - Do NOT use \b before -Encoding (space -> '-' is nonword->nonword; \b will never match).
 */
const re =
  /(?<![A-Za-z0-9_])(?:Set-Content|Add-Content|Out-File)(?![A-Za-z0-9_])[\s\S]{0,800}?(?<![A-Za-z0-9_])-Encoding(?![A-Za-z0-9_])[\s\S]{0,80}?(?:"|')?(?:utf-?8|utf8bom)(?:(?:"|')|\b)/i;

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
      "Reason: `Set/Add-Content -Encoding UTF8` and `Out-File -Encoding UTF8` are BOM/encoding footguns and cause repo churn.",
      "Policy: use scripts/Write-Utf8NoBomLf.ps1 for repo text writes (LF + UTF-8 no BOM), or the node-e/Invoke-NodeE flow.",
      "",
      "Offending file(s):",
      ...offenders.map((f) => `  - ${f}`),
      "",
    ].join("\n")
  );
}

console.log("OK: ban_set_content_utf8_guard");