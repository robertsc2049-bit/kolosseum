import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const scriptPath = path.join(repo, "scripts", "ci-enforce-phase1.mjs");
const truthPath = path.join(repo, "ci", "contracts", "phase1_v0_truth_surface.json");

function runFixture(name, extraEnv = {}) {
  const fixturePath = path.join(repo, "test", "fixtures", name);

  assert.equal(fs.existsSync(scriptPath), true, "expected scripts/ci-enforce-phase1.mjs to exist");
  assert.equal(fs.existsSync(truthPath), true, "expected repo truth surface to exist");
  assert.equal(fs.existsSync(fixturePath), true, `expected fixture ${name} to exist`);

  return spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PHASE1_INPUT_PATH: fixturePath,
      ...extraEnv
    }
  });
}

test("phase1 enforcer contract: source reads repo truth surface instead of embedded private truth", () => {
  const jsSrc = fs.readFileSync(scriptPath, "utf8");

  assert.match(jsSrc, /const TRUTH_SURFACE_PATH = "ci\/contracts\/phase1_v0_truth_surface\.json";/, "expected fixed repo truth surface path");
  assert.match(jsSrc, /readTruthSurface\(\)/, "expected repo truth surface loader");
  assert.doesNotMatch(jsSrc, /const ALLOWED_ACTOR_TYPES = new Set\(/, "did not expect embedded actor allowlist");
  assert.doesNotMatch(jsSrc, /const ALLOWED_EXECUTION_SCOPES = new Set\(/, "did not expect embedded execution scope allowlist");
  assert.doesNotMatch(jsSrc, /const ALLOWED_ACTIVITIES = new Set\(/, "did not expect embedded activity allowlist");
});

test("phase1 enforcer contract: repo truth surface is well-formed and includes current v0 domain", () => {
  const truth = JSON.parse(fs.readFileSync(truthPath, "utf8"));

  assert.equal(truth.schema_version, "kolosseum.phase1.v0.truth-surface.v1");
  assert.deepEqual(truth.allowed_actor_types, ["individual_user", "coach"]);
  assert.deepEqual(truth.allowed_execution_scopes, ["individual", "coach_managed"]);
  assert.deepEqual(truth.allowed_activities, ["powerlifting", "rugby_union", "general_strength"]);
});

test("phase1 enforcer contract: valid v0 fixture succeeds with deterministic success line and truth echo", () => {
  const run = runFixture("phase1.valid.json");

  assert.equal(run.status, 0, `expected zero exit code, got ${run.status}\nSTDERR:\n${run.stderr}`);
  assert.match(
    run.stdout,
    /^CI_OK::phase1_valid::sha256=[a-f0-9]{64}::truth=ci\/contracts\/phase1_v0_truth_surface\.json\r?\n?$/,
    "expected canonical success line with sha256 and truth echo"
  );
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
