import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "scripts", "gh_json_helpers.ps1");

function walkPowerShellFiles(rootRelative) {
  const root = path.join(repoRoot, ...rootRelative.split("/"));
  const out = [];

  if (!fs.existsSync(root)) {
    return out;
  }

  function visit(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") {
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

test("github powershell helper source pins canonical gh json to ConvertFrom-Json contract", () => {
  const source = fs.readFileSync(helperPath, "utf8");

  assert.match(source, /function Invoke-GhJson/);
  assert.match(source, /function Get-GhPullRequestSummary/);
  assert.match(source, /function Get-GhPullRequestNumberFromBranch/);
  assert.match(source, /function Format-GhPullRequestSummary/);

  assert.match(source, /ConvertFrom-Json/);
  assert.match(source, /"pr", "view", "\$PrNumber"/);
  assert.match(source, /"pr", "view", \$Branch/);
  assert.match(source, /"--repo", \$Repo/);
  assert.match(source, /"--json", "number,state,title,url"/);
  assert.match(source, /"--json", "number"/);

  assert.doesNotMatch(source, /--jq/);
  assert.doesNotMatch(source, /(^|[\s"'`])-(q)(?=$|[\s"'`])/m);
});

test("repo-owned powershell workflow files ban brittle gh jq-style formatting", () => {
  const targets = [
    ...walkPowerShellFiles("scripts"),
    ...walkPowerShellFiles("ci")
  ];

  assert.ok(targets.length > 0, "expected repo-owned PowerShell files to exist");

  const offenders = [];
  const bannedPatterns = [
    /gh[\s\S]{0,240}--jq/,
    /gh[\s\S]{0,240}(^|[\s"'`])-(q)(?=$|[\s"'`])/m
  ];

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

test("test ci composition includes github powershell json contract test", () => {
  const compositionPath = path.join(repoRoot, "ci", "contracts", "test_ci_composition.json");
  const composition = JSON.parse(fs.readFileSync(compositionPath, "utf8"));

  assert.ok(Array.isArray(composition.items), "expected composition items array");
  assert.ok(
    composition.items.some(
      (item) =>
        item &&
        item.kind === "command" &&
        item.value === "node test/ci_gh_powershell_json_contract.test.mjs"
    ),
    "expected test_ci_composition.json to include node test/ci_gh_powershell_json_contract.test.mjs"
  );
});
