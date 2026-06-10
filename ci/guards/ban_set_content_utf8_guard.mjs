// @law: Encoding Hygiene
// @severity: high
// @scope: repo

// DEV NOTE: PowerShell encoding footgun guard. This script blocks repo-owned
// PowerShell from using UTF-8 spellings that can create BOM or line-ending churn.
// Repo text writes should use the approved UTF-8 no BOM and LF path so diffs stay
// deterministic across Windows, CI, and future developer machines.

import fs from "node:fs";
import path from "node:path";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Encoding failures are expected policy failures, so CI should show a readable
 * explanation rather than an unhandled JavaScript stack trace.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Normalise line endings before scanning so the regex policy is about
 * forbidden command usage, not the current newline shape of the file being read.
 */
function lf(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

const repo = process.cwd();

// DEV NOTE: Scope is limited to scripts/ and ci/ because these are the repo-owned
// automation surfaces where PowerShell writes are most likely to cause encoding
// churn. App/source files are outside this specific PowerShell write policy.
const roots = [
  path.join(repo, "scripts"),
  path.join(repo, "ci"),
];

const exts = new Set([".ps1", ".psm1"]);

/**
 * DEV NOTE: Recursively collect PowerShell files from guarded roots only.
 * Generated/vendor folders are skipped so the policy checks owned automation,
 * not dependencies or build output.
 */
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
 * DEV NOTE: Ban PowerShell repo write footguns:
 * - Set-Content with UTF8, utf-8, or utf8BOM encoding forms
 * - Add-Content with UTF8, utf-8, or utf8BOM encoding forms
 * - Out-File with UTF8, utf-8, or utf8BOM encoding forms
 *
 * Intentionally does NOT flag utf8NoBOM. Even then, prefer
 * scripts/Write-Utf8NoBomLf.ps1 for repo writes because it also standardises LF.
 *
 * Regex details:
 * - Do NOT use a word boundary around Out-File because hyphen makes that brittle.
 * - Do NOT use a word boundary before -Encoding because space to hyphen is
 *   nonword to nonword and will not match as intended.
 */
const re =
  /(?<![A-Za-z0-9_])(?:Set-Content|Add-Content|Out-File)(?![A-Za-z0-9_])[\s\S]{0,800}?(?<![A-Za-z0-9_])-Encoding(?![A-Za-z0-9_])[\s\S]{0,80}?(?:"|')?(?:utf-?8|utf8bom)(?:(?:"|')|\b)/i;

const offenders = [];

// DEV NOTE: Each matching PowerShell file is reported once. This keeps CI output
// focused on the files to fix rather than every matching line in a large script.
for (const root of roots) {
  for (const file of walk(root)) {
    const txt = lf(fs.readFileSync(file, "utf8"));
    if (re.test(txt)) offenders.push(path.relative(repo, file));
  }
}

// DEV NOTE: Failure output states both the reason and the approved replacement
// path. Do not fix this by weakening the regex; fix repo writes to use
// scripts/Write-Utf8NoBomLf.ps1 or the approved Invoke-NodeE/node-e flow.
if (offenders.length) {
  die(
    [
      "\u274C ban_set_content_utf8_guard: forbidden usage detected.",
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
