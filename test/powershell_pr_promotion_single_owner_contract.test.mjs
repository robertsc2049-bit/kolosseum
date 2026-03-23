import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "scripts", "kolosseum_pr_helpers.ps1");

test("powershell PR promotion helper source pins single-owner JSON-only checks path", () => {
  const source = fs.readFileSync(helperPath, "utf8");

  assert.match(source, /function Get-KolosseumPrChecksJson/);
  assert.match(source, /scripts\/gh_pr_checks_status\.mjs/);
  assert.match(source, /--json/);
  assert.match(source, /ConvertFrom-Json/);
  assert.match(source, /function Wait-KolosseumPrGreen/);
  assert.match(source, /function Merge-KolosseumPr/);
  assert.match(source, /Wait-KolosseumPrGreen -PrNumber \$PrNumber -Repo \$Repo/);
  assert.match(source, /gh pr merge \$PrNumber --repo \$Repo --squash --delete-branch --admin/);

  assert.doesNotMatch(source, /gh pr checks \$PrNumber --repo \$Repo/);
  assert.doesNotMatch(source, /All checks were successful/);
  assert.doesNotMatch(source, /Some checks failed/);
  assert.doesNotMatch(source, /Some checks are still pending/);
  assert.doesNotMatch(source, /\\bX\\b/);
});
