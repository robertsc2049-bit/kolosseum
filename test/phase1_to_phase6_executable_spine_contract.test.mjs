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

test("phase1 to phase6 executable spine source contract: script and fixtures exist and are wired to built pipeline candidates", () => {
  const jsSrc = fs.readFileSync(scriptPath, "utf8");

  assert.equal(fs.existsSync(scriptPath), true, "expected executable spine runner to exist");
  assert.equal(fs.existsSync(positiveFixture), true, "expected positive spine fixture to exist");
  assert.equal(fs.existsSync(negativeFixture), true, "expected negative spine fixture to exist");

  assert.match(jsSrc, /dist", "src", "run_pipeline\.js"/, "expected dist/src candidate");
  assert.match(jsSrc, /dist", "engine", "src", "run_pipeline\.js"/, "expected dist/engine/src candidate");
  assert.match(jsSrc, /PHASE1_TO_PHASE6_EXPECT/, "expected expectation env support");
  assert.match(jsSrc, /same Phase1 input produced different serialized outputs/, "expected determinism guard");
});

test(
  "phase1 to phase6 executable spine contract: positive fixture executes deterministically through built pipeline",
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
      "expected deterministic executable success line"
    );
    assert.equal(run.stderr, "", "expected no stderr for positive executable slice");
  }
);

test(
  "phase1 to phase6 executable spine contract: negative fixture is rejected by built pipeline",
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
      /^SPINE_OK::phase1_to_phase6_failure::module=.*run_pipeline\.js::mode=(threw|returned_failure_marker)\r?\n?$/,
      "expected executable failure observation line"
    );
    assert.equal(run.stderr, "", "expected no stderr when failure is correctly observed");
  }
);
