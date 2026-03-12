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

test("repo-tracked PR helper uses structured deterministic output helpers", () => {
  const text = readHelper();

  assert.match(text, /function\s+Format-KolosseumTextForConsole\b/);
  assert.match(text, /function\s+Show-KolosseumCheckSummary\b/);
  assert.match(text, /function\s+Show-KolosseumRecentRuns\b/);
  assert.match(text, /gh\s+pr\s+checks\s+\$PrNumber\s+--json\s+name,state,workflow,bucket,link/);
  assert.match(text, /gh\s+run\s+list\s+--limit\s+\$Limit\s+--json\s+status,conclusion,workflowName,headBranch,event,displayTitle,createdAt/);
  assert.match(text, /Replace\("ÔÇª", "\.\.\."\)/);
  assert.match(text, /Replace\(\[string\]\[char\]0x2026, "\.\.\."\)/);
});

test("repo-tracked PR helper realigns main only after successful merge call site", () => {
  const text = readHelper();

  assert.match(text, /function\s+Merge-KolosseumPr\b/);
  assert.match(text, /gh\s+pr\s+checks\s+\$PrNumber\s+--watch\s+\|\s+Out-Null/);
  assert.match(text, /Show-KolosseumCheckSummary\s+-PrNumber\s+\$PrNumber/);
  assert.match(text, /gh\s+pr\s+merge\s+\$PrNumber\s+--squash\s+--delete-branch\s+--admin/);
  assert.match(text, /Sync-KolosseumMainAfterMerge/);
  assert.match(text, /Show-KolosseumRecentRuns\s+-Limit\s+10/);

  const mergeFnStart = text.search(/function\s+Merge-KolosseumPr\b/);
  const mergeCallIndex = text.indexOf("gh pr merge $PrNumber --squash --delete-branch --admin", mergeFnStart);
  const syncCallIndex = text.indexOf("Sync-KolosseumMainAfterMerge", mergeCallIndex);
  const runsCallIndex = text.indexOf("Show-KolosseumRecentRuns -Limit 10", syncCallIndex);

  assert.notEqual(mergeFnStart, -1, "missing Merge-KolosseumPr function");
  assert.notEqual(mergeCallIndex, -1, "missing merge call");
  assert.notEqual(syncCallIndex, -1, "missing sync call after merge");
  assert.notEqual(runsCallIndex, -1, "missing recent runs summary after sync");
  assert.ok(syncCallIndex > mergeCallIndex, "main realignment must happen after successful gh pr merge");
  assert.ok(runsCallIndex > syncCallIndex, "recent runs summary must happen after main realignment");
});