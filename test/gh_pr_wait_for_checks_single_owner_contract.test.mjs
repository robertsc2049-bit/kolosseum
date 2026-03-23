import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const waitScriptPath = path.join(repoRoot, "scripts", "gh-pr-wait-for-checks.ps1");

test("gh-pr-wait-for-checks source contract routes through repo-owned helper only", () => {
  const source = fs.readFileSync(waitScriptPath, "utf8");

  assert.match(source, /kolosseum_pr_helpers\.ps1/);
  assert.match(source, /Wait-KolosseumPrGreen -PrNumber \$PrNumber -Repo \$Repo -MaxAttempts \$MaxAttempts -SleepSeconds \$SleepSeconds/);

  assert.doesNotMatch(source, /gh pr checks\b/);
  assert.doesNotMatch(source, /All checks were successful/);
  assert.doesNotMatch(source, /Some checks failed/);
  assert.doesNotMatch(source, /Some checks are still pending/);
  assert.doesNotMatch(source, /Start-Sleep -Seconds 10/);
});
