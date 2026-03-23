import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const statusScript = path.join(repoRoot, "scripts", "gh_pr_checks_status.mjs");

function writeTempText(name, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kol-gh-status-"));
  const file = path.join(dir, name);
  fs.writeFileSync(file, text, "utf8");
  return file;
}

function runStatusJsonFromFile(file) {
  const result = spawnSync(
    process.execPath,
    [statusScript, "--file", file, "--json"],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const stdout = String(result.stdout ?? "").trim();
  assert.notEqual(stdout, "", "expected JSON stdout from gh_pr_checks_status");

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Expected JSON stdout, got: ${stdout}`);
  }

  return {
    status: result.status,
    stdout,
    stderr: String(result.stderr ?? ""),
    parsed
  };
}

test("gh_pr_checks_status executable contract: pending summary text normalizes to canonical JSON and exits non-zero", () => {
  const fixture = [
    "Some checks are still pending",
    "0 cancelled, 0 failing, 9 successful, 0 skipped, and 1 pending checks",
    "",
    "   NAME                                            DESCRIPTION  ELAPSED  URL",
    "*  green/integration (pull_request)                                      https://example.invalid/run/1",
    "✓  green/unit (pull_request)                                    33s      https://example.invalid/run/2"
  ].join("\n");

  const file = writeTempText("pending.txt", fixture);
  const result = runStatusJsonFromFile(file);

  assert.equal(result.status, 1);
  assert.deepEqual(result.parsed, {
    ok: true,
    isGreen: false,
    hasPending: true,
    hasFailing: false,
    successfulCount: 9,
    pendingCount: 1,
    failingCount: 0,
    cancelledCount: 0,
    skippedCount: 0,
    source: "summary"
  });
});

test("gh_pr_checks_status executable contract: failing summary text normalizes to canonical JSON and exits non-zero", () => {
  const fixture = [
    "Some checks failed",
    "0 cancelled, 2 failing, 7 successful, 0 skipped, and 0 pending checks",
    "",
    "   NAME                                            DESCRIPTION  ELAPSED  URL",
    "X  green/integration (pull_request)                             2m53s    https://example.invalid/run/1"
  ].join("\n");

  const file = writeTempText("failing.txt", fixture);
  const result = runStatusJsonFromFile(file);

  assert.equal(result.status, 1);
  assert.deepEqual(result.parsed, {
    ok: true,
    isGreen: false,
    hasPending: false,
    hasFailing: true,
    successfulCount: 7,
    pendingCount: 0,
    failingCount: 2,
    cancelledCount: 0,
    skippedCount: 0,
    source: "summary"
  });
});

test("gh_pr_checks_status executable contract: green summary text normalizes to canonical JSON and exits zero", () => {
  const fixture = [
    "All checks were successful",
    "0 cancelled, 0 failing, 10 successful, 0 skipped, and 0 pending checks",
    "",
    "   NAME                                            DESCRIPTION  ELAPSED  URL",
    "✓  green/integration (pull_request)                             2m53s    https://example.invalid/run/1"
  ].join("\n");

  const file = writeTempText("green.txt", fixture);
  const result = runStatusJsonFromFile(file);

  assert.equal(result.status, 0);
  assert.deepEqual(result.parsed, {
    ok: true,
    isGreen: true,
    hasPending: false,
    hasFailing: false,
    successfulCount: 10,
    pendingCount: 0,
    failingCount: 0,
    cancelledCount: 0,
    skippedCount: 0,
    source: "summary"
  });
});

test("gh_pr_checks_status source contract: repo/pr path shells to gh pr checks and json mode emits JSON only", () => {
  const source = fs.readFileSync(statusScript, "utf8");

  assert.match(source, /spawnSync\(\s*"gh"/);
  assert.match(source, /\["pr", "checks", String\(args\.pr\), "--repo", String\(args\.repo\)\]/);
  assert.match(source, /if \(args\.json\) \{\s*process\.stdout\.write\(`\$\{JSON\.stringify\(parsed\)\}\\n`\);/s);
  assert.doesNotMatch(source, /gh pr checks --watch/);
});
