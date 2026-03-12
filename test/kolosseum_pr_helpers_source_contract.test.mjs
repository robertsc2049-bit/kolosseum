import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "scripts", "kolosseum_pr_helpers.ps1");

function readHelper() {
  assert.ok(fs.existsSync(helperPath), `missing helper file: ${helperPath}`);
  return fs.readFileSync(helperPath, "utf8");
}

test("repo-tracked PR helper defines deterministic post-merge main sync", () => {
  const text = readHelper();

  assert.match(text, /function\s+Sync-KolosseumMainAfterMerge\b/);
  assert.match(text, /git\s+fetch\s+origin\s+--prune/);
  assert.match(text, /git\s+switch\s+main/);
  assert.match(text, /git\s+rev-list\s+--left-right\s+--count\s+main\.\.\.origin\/main/);
  assert.match(text, /git\s+pull\s+--ff-only/);
  assert.match(text, /git\s+reset\s+--hard\s+origin\/main/);
});

test("repo-tracked PR helper only realigns main after successful gh pr merge", () => {
  const text = readHelper();

  assert.match(text, /function\s+Merge-KolosseumPr\b/);
  assert.match(text, /gh\s+pr\s+checks\s+\$PrNumber\s+--watch/);
  assert.match(text, /gh\s+pr\s+merge\s+\$PrNumber\s+--squash\s+--delete-branch\s+--admin/);
  assert.match(text, /Sync-KolosseumMainAfterMerge/);
  assert.match(text, /gh\s+run\s+list\s+--limit\s+10/);

  const mergeIndex = text.search(/gh\s+pr\s+merge\s+\$PrNumber\s+--squash\s+--delete-branch\s+--admin/);
  const syncIndex = text.search(/Sync-KolosseumMainAfterMerge/);

  assert.notEqual(mergeIndex, -1, "missing merge call");
  assert.notEqual(syncIndex, -1, "missing post-merge sync call");
  assert.ok(syncIndex > mergeIndex, "main realignment must happen after successful gh pr merge");
});