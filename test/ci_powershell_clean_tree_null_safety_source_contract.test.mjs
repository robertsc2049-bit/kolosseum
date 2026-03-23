import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "scripts", "assert_clean_tree.ps1");

function walkPowerShellFiles(rootRelative) {
  const root = path.join(repoRoot, ...rootRelative.split("/"));
  const out = [];

  if (!fs.existsSync(root)) {
    return out;
  }

  function visit(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }

      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
        continue;
      }

      if (entry.isFile() && /\.(ps1|psm1)$/i.test(entry.name)) {
        out.push(abs);
      }
    }
  }

  visit(root);
  return out.sort((a, b) => a.localeCompare(b));
}

function toRepoRelative(absPath) {
  return path.relative(repoRoot, absPath).replace(/\\/g, "/");
}

test("powershell clean-tree helper source pins canonical null-safe git status pattern", () => {
  const source = fs.readFileSync(helperPath, "utf8");

  assert.match(source, /function Get-GitStatusShortLines/);
  assert.match(source, /function Assert-CleanGitTree/);
  assert.match(source, /\$statusLines\s*=\s*Get-GitStatusShortLines/);
  assert.match(source, /return\s*@\(git status --short\)/);
  assert.match(source, /\$statusLines\.Count\s*-ne\s*0/);

  assert.doesNotMatch(source, /\(\s*git status --short\s*\)\s*\.Trim\s*\(/);
  assert.doesNotMatch(source, /git status --short[\s\S]{0,120}\.Trim\s*\(\s*\)\s*\.Length/);
});

test("repo-owned powershell workflow files ban brittle trim-based raw git status short checks", () => {
  const targets = [
    ...walkPowerShellFiles("ci"),
    ...walkPowerShellFiles("scripts")
  ];

  assert.ok(targets.length > 0, "expected at least one repo-owned PowerShell workflow file");

  const bannedPatterns = [
    /\(\s*git status --short\s*\)\s*\.Trim\s*\(/,
    /git status --short[\s\S]{0,120}\.Trim\s*\(\s*\)\s*\.Length/,
    /String\s*\(\s*git status --short\s*\)\s*\.Trim\s*\(/
  ];

  const offenders = [];

  for (const file of targets) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of bannedPatterns) {
      if (pattern.test(source)) {
        offenders.push(toRepoRelative(file));
        break;
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("test ci composition includes the powershell clean-tree null-safety source contract", () => {
  const compositionPath = path.join(repoRoot, "ci", "contracts", "test_ci_composition.json");
  const composition = JSON.parse(fs.readFileSync(compositionPath, "utf8"));

  assert.ok(Array.isArray(composition.items), "expected test_ci_composition.json items array");
  assert.ok(
    composition.items.some(
      (item) =>
        item &&
        item.kind === "command" &&
        item.value === "node test/ci_powershell_clean_tree_null_safety_source_contract.test.mjs"
    ),
    "expected test_ci_composition.json to include the powershell clean-tree null-safety source contract"
  );
});
