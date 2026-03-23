import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const scriptsDir = path.join(repoRoot, "scripts");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (entry.isFile() && full.endsWith(".ps1")) {
      out.push(full);
    }
  }
  return out;
}

test("repo-owned PowerShell workflow files ban raw gh pr checks row parsing for promotion flow", () => {
  const files = walk(scriptsDir);
  const offenders = [];

  for (const file of files) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = fs.readFileSync(file, "utf8");

    const hasDirectChecks = /gh pr checks\b/.test(source);
    const hasRowParsing =
      /All checks were successful/.test(source) ||
      /Some checks failed/.test(source) ||
      /Some checks are still pending/.test(source) ||
      /-match\s+"\\bX\\b"/.test(source) ||
      /-match\s+"All checks were successful"/.test(source);

    if (hasDirectChecks || hasRowParsing) {
      offenders.push(rel);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Raw gh pr checks row polling is forbidden in repo-owned PowerShell workflow files. Offenders: ${offenders.join(", ")}`
  );
});
