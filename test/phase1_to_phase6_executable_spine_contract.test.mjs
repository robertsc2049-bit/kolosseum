import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const scriptPath = path.join(repo, "scripts", "run_phase1_to_phase6_spine.mjs");
const positiveFixture = path.join(repo, "test", "fixtures", "phase1_to_phase6.valid.general_strength.individual.json");
const negativeFixture = path.join(repo, "test", "fixtures", "phase1_to_phase6.invalid.unsupported-activity.json");

function hasBuiltPipeline() {
  const candidates = [
    path.join(repo, "dist", "src", "run_pipeline.js"),
    path.join(repo, "dist", "engine", "src", "run_pipeline.js"),
    path.join(repo, "dist", "run_pipeline.js")
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

test("phase1 to phase6 executable spine source contract: script asserts semantic success, semantic failure, and normalized determinism", () => {
  const jsSrc = fs.readFileSync(scriptPath, "utf8");

  assert.equal(fs.existsSync(scriptPath), true, "expected executable spine runner to exist");
  assert.equal(fs.existsSync(positiveFixture), true, "expected positive spine fixture to exist");
  assert.equal(fs.existsSync(negativeFixture), true, "expected negative spine fixture to exist");

  assert.match(jsSrc, /function normalize\(value\)/, "expected normalized-key determinism helper");
  assert.match(jsSrc, /expected ok=true, got ok=/, "expected semantic success assertion");
  assert.match(jsSrc, /expected ok=false, got ok=/, "expected semantic failure assertion");
  assert.match(jsSrc, /failure result must include non-empty failure_token/, "expected explicit failure_token assertion");
  assert.doesNotMatch(jsSrc, /hasFailureMarker\(/, "did not expect regex-based failure detection");
});

test(
  "phase1 to phase6 executable spine contract: positive fixture executes deterministically and returns ok=true",
  { skip: !hasBuiltPipeline() },
  () => {
    const run = spawnSync(process.execPath, [scriptPath], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        PHASE1_TO_PHASE6_INPUT_PATH: positiveFixture,
        PHASE1_TO_PHASE6_EXPECT: "success"
      }
    });

    assert.equal(run.status, 0, `expected zero exit code, got ${run.status}\nSTDERR:\n${run.stderr}`);
    assert.match(
      run.stdout,
      /^SPINE_OK::phase1_to_phase6_success::module=.*run_pipeline\.js::sha256=[a-f0-9]{64}\r?\n?$/,
      "expected deterministic semantic success line"
    );
    assert.equal(run.stderr, "", "expected no stderr for positive executable slice");
  }
);

test(
  "phase1 to phase6 executable spine contract: negative fixture executes deterministically and returns ok=false with failure_token",
  { skip: !hasBuiltPipeline() },
  () => {
    const run = spawnSync(process.execPath, [scriptPath], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        PHASE1_TO_PHASE6_INPUT_PATH: negativeFixture,
        PHASE1_TO_PHASE6_EXPECT: "failure"
      }
    });

    assert.equal(run.status, 0, `expected zero exit code, got ${run.status}\nSTDERR:\n${run.stderr}`);
    assert.match(
      run.stdout,
      /^SPINE_OK::phase1_to_phase6_failure::module=.*run_pipeline\.js::failure_token=[^:\r\n]+::sha256=[a-f0-9]{64}\r?\n?$/,
      "expected deterministic semantic failure line"
    );
    assert.equal(run.stderr, "", "expected no stderr for negative executable slice");
  }
);
