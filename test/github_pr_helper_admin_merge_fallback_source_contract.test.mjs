import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "scripts", "kolosseum_pr_helpers.ps1");

test("Merge-KolosseumPr source contract: review-required blocked PRs surface clearly and auto-fallback to admin merge", () => {
  const source = fs.readFileSync(helperPath, "utf8");

  assert.match(
    source,
    /\$prInfo\.mergeable -eq "MERGEABLE"[\s\S]*?\$prInfo\.mergeStateStatus -eq "BLOCKED"[\s\S]*?\$prInfo\.reviewDecision -eq "REVIEW_REQUIRED"/,
    "helper must recognize the approved admin-merge review-required blocked state"
  );

  assert.match(
    source,
    /checks are green but branch protection still requires review/i,
    "helper must surface the review-required block clearly"
  );

  assert.match(
    source,
    /auto-falling back to admin merge/i,
    "helper must surface explicit admin fallback messaging"
  );

  assert.match(
    source,
    /gh pr merge \$PrNumber --squash --delete-branch --admin/,
    "helper must perform admin merge in the approved fallback path"
  );

  assert.doesNotMatch(
    source,
    /PR #\$PrNumber is not mergeable\./,
    "helper must not mislabel the approved admin-review path as unmergeable"
  );
});
