import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("phase1 CI enforcer smoke contract: valid fixture exits zero and emits deterministic success envelope", () => {
  const repo = process.cwd();

  const scriptPath = path.join(repo, "scripts", "ci-enforce-phase1.mjs");
  const fixturePath = path.join(repo, "test", "fixtures", "phase1.json");

  assert.equal(fs.existsSync(scriptPath), true, "expected scripts/ci-enforce-phase1.mjs to exist");
  assert.equal(fs.existsSync(fixturePath), true, "expected test fixture to exist");

  const run = spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8"
  });

  assert.equal(run.status, 0, `expected zero exit code, got ${run.status}\nSTDERR:\n${run.stderr}`);
  assert.match(run.stdout, /^CI_OK::phase1_valid::sha256=[a-f0-9]{64}\r?\n?$/, "expected canonical success line with sha256");
  assert.equal(run.stderr, "", "expected no stderr for valid fixture");
});

test("phase1 CI enforcer smoke contract: fixture remains explicit and minimal", () => {
  const repo = process.cwd();
  const fixturePath = path.join(repo, "test", "fixtures", "phase1.json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  assert.equal(fixture.consent_granted, true, "expected explicit consent");
  assert.equal(fixture.age_declaration, "adult", "expected explicit age declaration");
  assert.equal(fixture.jurisdiction_acknowledged, true, "expected explicit jurisdiction acknowledgement");
  assert.equal(fixture.activity_id, "general_strength", "expected v0-supported activity fixture");
  assert.ok(Array.isArray(fixture.baseline_metrics), "expected baseline_metrics array");
  assert.equal(fixture.baseline_metrics.length, 1, "expected a single baseline metric fixture");
});
