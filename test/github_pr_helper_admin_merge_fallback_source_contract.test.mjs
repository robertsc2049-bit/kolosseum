import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "scripts", "kolosseum_pr_helpers.ps1");

test("Merge-KolosseumPr source contract: approved review-required admin path is surfaced clearly and not treated as unmergeable", () => {
  const source = fs.readFileSync(helperPath, "utf8");

  assert.match(
    source,
    /\$isAdminReviewBlock\s*=\s*\r?\n\s*\$prInfo\.state -eq "OPEN" -and\r?\n\s*\$prInfo\.mergeable -eq "MERGEABLE" -and\r?\n\s*\$prInfo\.mergeStateStatus -eq "BLOCKED" -and\r?\n\s*\$prInfo\.reviewDecision -eq "REVIEW_REQUIRED"/,
    "helper must recognize the approved admin-review blocked state"
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
    "helper must keep admin merge enabled"
  );

  assert.match(
    source,
    /\$prInfo\.mergeStateStatus -ne "CLEAN" -and \$prInfo\.mergeStateStatus -ne "HAS_HOOKS"/,
    "helper must no longer reject all BLOCKED states blindly"
  );

  assert.match(
    source,
    /PR #\$PrNumber cannot be merged yet\./,
    "helper must use the precise cannot-be-merged-yet contract for real blockers"
  );

  assert.doesNotMatch(
    source,
    /PR #\$PrNumber is not mergeable\./,
    "helper must not mislabel the approved admin-review path as unmergeable"
  );
});
