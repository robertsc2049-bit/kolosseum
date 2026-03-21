import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const scriptPath = path.join(repo, "scripts", "ci-enforce-phase1.mjs");

function runFixture(name) {
  const fixturePath = path.join(repo, "test", "fixtures", name);

  assert.equal(fs.existsSync(scriptPath), true, "expected scripts/ci-enforce-phase1.mjs to exist");
  assert.equal(fs.existsSync(fixturePath), true, `expected fixture ${name} to exist`);

  return spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PHASE1_INPUT_PATH: fixturePath
    }
  });
}

test("phase1 enforcer contract: valid v0 fixture succeeds with deterministic success line", () => {
  const run = runFixture("phase1.valid.json");

  assert.equal(run.status, 0, `expected zero exit code, got ${run.status}\nSTDERR:\n${run.stderr}`);
  assert.match(run.stdout, /^CI_OK::phase1_valid::sha256=[a-f0-9]{64}\r?\n?$/, "expected canonical success line with sha256");
  assert.equal(run.stderr, "", "expected no stderr for valid fixture");
});

test("phase1 enforcer contract: unknown top-level field hard-fails", () => {
  const run = runFixture("phase1.invalid-unknown-top-level.json");

  assert.equal(run.status, 1, "expected non-zero exit code");
  assert.match(run.stderr, /^CI_FAIL::unknown_field::forbidden_extra_field\r?\n?$/, "expected unknown_field failure");
});

test("phase1 enforcer contract: unsupported actor hard-fails", () => {
  const run = runFixture("phase1.invalid-actor.json");

  assert.equal(run.status, 1, "expected non-zero exit code");
  assert.match(run.stderr, /^CI_FAIL::invalid_actor_type::actor_type=org_admin\r?\n?$/, "expected invalid_actor_type failure");
});

test("phase1 enforcer contract: unsupported scope hard-fails", () => {
  const run = runFixture("phase1.invalid-scope.json");

  assert.equal(run.status, 1, "expected non-zero exit code");
  assert.match(run.stderr, /^CI_FAIL::invalid_execution_scope::execution_scope=org_managed\r?\n?$/, "expected invalid_execution_scope failure");
});

test("phase1 enforcer contract: unsupported activity hard-fails", () => {
  const run = runFixture("phase1.invalid-activity.json");

  assert.equal(run.status, 1, "expected non-zero exit code");
  assert.match(run.stderr, /^CI_FAIL::invalid_activity_id::activity_id=football_soccer\r?\n?$/, "expected invalid_activity_id failure");
});

test("phase1 enforcer contract: coach-managed scope requires governing authority id", () => {
  const run = runFixture("phase1.invalid-coach-managed-missing-authority.json");

  assert.equal(run.status, 1, "expected non-zero exit code");
  assert.match(run.stderr, /^CI_FAIL::missing_governing_authority::governing_authority_id required for coach_managed scope\r?\n?$/, "expected missing_governing_authority failure");
});

test("phase1 enforcer contract: baseline metric activity must match root activity", () => {
  const run = runFixture("phase1.invalid-metric-activity-mismatch.json");

  assert.equal(run.status, 1, "expected non-zero exit code");
  assert.match(
    run.stderr,
    /^CI_FAIL::metric_activity_mismatch::baseline_metrics\[0\]\.activity_id=rugby_union root=general_strength\r?\n?$/,
    "expected metric_activity_mismatch failure"
  );
});
