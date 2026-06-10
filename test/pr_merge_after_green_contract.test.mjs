import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("pr merge helper source contract uses single-owner checked-in poller and admin squash merge", async () => {
  const source = await fs.readFile("scripts/pr-merge-after-green.ps1", "utf8");

  assert.match(source, /node scripts\/gh_pr_checks_poll_until_green\.mjs/);
  assert.match(source, /--repo/);
  assert.match(source, /--pr/);
  assert.match(source, /--attempts/);
  assert.match(source, /--delay-seconds/);

  assert.match(source, /gh @args/);
  assert.match(source, /"pr", "merge", \$PrNumber/);
  assert.match(source, /"--squash"/);
  assert.match(source, /"--admin"/);
  assert.match(source, /"--delete-branch"/);

  assert.match(source, /git fetch --all --prune/);
  assert.match(source, /git switch main/);
  assert.match(source, /git reset --hard origin\/main/);
  assert.match(source, /git pull --ff-only/);

  assert.doesNotMatch(source, /gh pr checks --watch/);
  assert.doesNotMatch(source, /Start-Sleep -Seconds 15/);
});

test("package.json exposes checked-in pr:merge:admin helper through ps-runner", async () => {
  const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));

  assert.equal(
    packageJson.scripts["pr:merge:admin"],
    "node scripts/ps-runner.mjs --file scripts/pr-merge-after-green.ps1"
  );
});
