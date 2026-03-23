import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const pollerScript = path.join(repoRoot, "scripts", "gh_pr_checks_poll_until_green.mjs");

function makeHelper(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kol-gh-poller-"));
  const stateFile = path.join(dir, "state.json");
  fs.writeFileSync(stateFile, JSON.stringify({ count: 0 }), "utf8");

  const helperFile = path.join(dir, "status-helper.mjs");
  const helperSource = `
import fs from "node:fs";

const stateFile = ${JSON.stringify(stateFile)};
const mode = ${JSON.stringify(mode)};
const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
state.count += 1;
fs.writeFileSync(stateFile, JSON.stringify(state), "utf8");

function emit(value) {
  process.stdout.write(JSON.stringify(value) + "\\n");
}

if (mode === "pending-then-green") {
  if (state.count < 3) {
    emit({
      ok: true,
      isGreen: false,
      hasPending: true,
      hasFailing: false,
      successfulCount: state.count,
      pendingCount: 1,
      failingCount: 0,
      cancelledCount: 0,
      skippedCount: 0,
      source: "fixture"
    });
    process.exit(1);
  }

  emit({
    ok: true,
    isGreen: true,
    hasPending: false,
    hasFailing: false,
    successfulCount: 10,
    pendingCount: 0,
    failingCount: 0,
    cancelledCount: 0,
    skippedCount: 0,
    source: "fixture"
  });
  process.exit(0);
}

emit({
  ok: true,
  isGreen: false,
  hasPending: true,
  hasFailing: false,
  successfulCount: 0,
  pendingCount: 1,
  failingCount: 0,
  cancelledCount: 0,
  skippedCount: 0,
  source: "fixture"
});
process.exit(1);
`;
  fs.writeFileSync(helperFile, helperSource, "utf8");
  return helperFile;
}

test("gh_pr_checks_poll_until_green executable contract: helper path emits canonical JSON history until green", () => {
  const helper = makeHelper("pending-then-green");
  const stdout = execFileSync(
    process.execPath,
    [
      pollerScript,
      "--repo", "robertsc2049-bit/kolosseum",
      "--pr", "388",
      "--attempts", "5",
      "--delay-seconds", "0",
      "--json"
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        KOLOSSEUM_GH_PR_CHECKS_STATUS_SCRIPT: helper
      }
    }
  );

  const parsed = JSON.parse(stdout);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.reason, "green");
  assert.equal(parsed.attemptsUsed, 3);
  assert.equal(parsed.repo, "robertsc2049-bit/kolosseum");
  assert.equal(parsed.pr, "388");
  assert.equal(parsed.final.isGreen, true);
  assert.equal(parsed.history.length, 3);
  assert.equal(parsed.history[0].parsed.hasPending, true);
  assert.equal(parsed.history[1].parsed.hasPending, true);
  assert.equal(parsed.history[2].parsed.isGreen, true);
});

test("gh_pr_checks_poll_until_green executable contract: timeout/non-green path still emits canonical JSON", () => {
  const helper = makeHelper("always-pending");
  const result = spawnSync(
    process.execPath,
    [
      pollerScript,
      "--repo", "robertsc2049-bit/kolosseum",
      "--pr", "388",
      "--attempts", "3",
      "--delay-seconds", "0",
      "--json"
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        KOLOSSEUM_GH_PR_CHECKS_STATUS_SCRIPT: helper
      }
    }
  );

  assert.equal(result.status, 1);

  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.reason, "timeout");
  assert.equal(parsed.attemptsUsed, 3);
  assert.equal(parsed.final.hasPending, true);
  assert.equal(parsed.history.length, 3);
  assert.ok(parsed.history.every((entry) => entry.parsed.hasPending === true));
});

test("gh_pr_checks_poll_until_green source contract: defaultRunStatus forces checked-in status helper json path", () => {
  const source = fs.readFileSync(pollerScript, "utf8");

  assert.match(source, /export function resolveStatusHelperScript\(\)/);
  assert.match(source, /process\.env\.KOLOSSEUM_GH_PR_CHECKS_STATUS_SCRIPT/);
  assert.match(source, /return path\.join\("scripts", "gh_pr_checks_status\.mjs"\);/);
  assert.match(source, /\[statusScript, "--repo", String\(repo\), "--pr", String\(pr\), "--json"\]/);
  assert.match(source, /JSON\.parse\(stdout\)/);
  assert.doesNotMatch(source, /gh pr checks --watch/);
});
