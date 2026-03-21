import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const scriptPath = path.join(repo, "scripts", "run_phase1_to_phase6_spine.mjs");
const positiveFixturePath = path.join(repo, "test", "fixtures", "phase1_to_phase6.valid.general_strength.individual.json");
const negativeFixturePath = path.join(repo, "test", "fixtures", "phase1_to_phase6.invalid.unsupported-activity.json");

test("phase1 to phase6 executable spine source contract: script and fixtures exist and are wired to built pipeline candidates", () => {
  const jsSrc = fs.readFileSync(scriptPath, "utf8");

  assert.equal(fs.existsSync(scriptPath), true, "expected executable spine script to exist");
  assert.equal(fs.existsSync(positiveFixturePath), true, "expected positive executable spine fixture");
  assert.equal(fs.existsSync(negativeFixturePath), true, "expected negative executable spine fixture");

  assert.match(
    jsSrc,
    /const DEFAULT_INPUT_PATH = "test\/fixtures\/phase1_to_phase6\.valid\.general_strength\.individual\.json";/,
    "expected default positive fixture path"
  );

  assert.match(
    jsSrc,
    /process\.env\.PHASE1_TO_PHASE6_INPUT_PATH/,
    "expected env override for fixture path"
  );

  assert.match(
    jsSrc,
    /process\.env\.PHASE1_TO_PHASE6_EXPECT/,
    "expected env override for expected semantic mode"
  );

  assert.match(
    jsSrc,
    /dist\/src\/run_pipeline\.js/,
    "expected built pipeline candidate"
  );

  assert.match(
    jsSrc,
    /dist\/engine\/src\/run_pipeline\.js/,
    "expected engine build pipeline candidate"
  );

  assert.match(
    jsSrc,
    /dist\/run_pipeline\.js/,
    "expected flat build pipeline candidate"
  );
});

test("phase1 to phase6 executable spine contract: positive fixture executes deterministically through built pipeline", () => {
  const run1 = spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8"
  });

  assert.equal(run1.status, 0, `expected zero exit code, got ${run1.status}\nSTDERR:\n${run1.stderr}`);
  assert.match(
    run1.stdout,
    /^SPINE_OK::phase1_to_phase6_success::module=.*run_pipeline\.js::sha256=[a-f0-9]{64}\r?\n?$/,
    "expected success spine line"
  );
  assert.equal(run1.stderr, "", "expected no stderr for successful positive spine run");

  const run2 = spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8"
  });

  assert.equal(run2.status, 0, `expected zero exit code, got ${run2.status}\nSTDERR:\n${run2.stderr}`);
  assert.equal(run2.stdout, run1.stdout, "expected deterministic positive spine stdout");
  assert.equal(run2.stderr, "", "expected no stderr for deterministic positive spine rerun");
});

test("phase1 to phase6 executable spine contract: negative fixture executes deterministically and returns ok=false with failure_token", () => {
  const env = {
    ...process.env,
    PHASE1_TO_PHASE6_INPUT_PATH: negativeFixturePath,
    PHASE1_TO_PHASE6_EXPECT: "failure"
  };

  const run1 = spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env
  });

  assert.equal(run1.status, 0, `expected zero exit code, got ${run1.status}\nSTDERR:\n${run1.stderr}`);
  assert.match(
    run1.stdout,
    /^SPINE_OK::phase1_to_phase6_failure::module=.*run_pipeline\.js::failure_token=[a-z0-9_:-]+::sha256=[a-f0-9]{64}\r?\n?$/,
    "expected semantic failure spine line with explicit failure token"
  );
  assert.equal(run1.stderr, "", "expected no stderr for semantic failure spine run");

  const run2 = spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env
  });

  assert.equal(run2.status, 0, `expected zero exit code, got ${run2.status}\nSTDERR:\n${run2.stderr}`);
  assert.equal(run2.stdout, run1.stdout, "expected deterministic negative spine stdout");
  assert.equal(run2.stderr, "", "expected no stderr for deterministic negative spine rerun");
});
