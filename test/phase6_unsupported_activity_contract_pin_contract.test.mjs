import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const scriptPath = path.join(repo, "scripts", "pin_phase1_to_phase6_unsupported_activity_contract.mjs");
const pinPath = path.join(repo, "ci", "golden", "phase1_to_phase6_unsupported_activity_contract.json");
const fixturePath = path.join(repo, "test", "fixtures", "phase1_to_phase6.invalid.unsupported-activity.json");

function hasBuiltPipeline() {
  const candidates = [
    path.join(repo, "dist", "src", "run_pipeline.js"),
    path.join(repo, "dist", "engine", "src", "run_pipeline.js"),
    path.join(repo, "dist", "run_pipeline.js")
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

test("phase6 unsupported-activity contract pin source contract: script exposes write mode, pin path, and built pipeline candidates", () => {
  const jsSrc = fs.readFileSync(scriptPath, "utf8");

  assert.equal(fs.existsSync(scriptPath), true, "expected unsupported-activity pin script to exist");
  assert.equal(fs.existsSync(fixturePath), true, "expected unsupported-activity fixture to exist");

  assert.match(jsSrc, /const DEFAULT_PIN_PATH = "ci\/golden\/phase1_to_phase6_unsupported_activity_contract\.json";/, "expected default pin path");
  assert.match(jsSrc, /process\.argv\.includes\("--write"\)/, "expected write mode");
  assert.match(jsSrc, /dist", "src", "run_pipeline\.js"/, "expected dist\/src candidate");
  assert.match(jsSrc, /dist", "engine", "src", "run_pipeline\.js"/, "expected dist\/engine\/src candidate");
  assert.match(jsSrc, /same unsupported-activity fixture produced different normalized outputs/, "expected determinism guard");
});

test("phase6 unsupported-activity contract pin file is present and pinned to the unsupported-activity fixture", () => {
  const pin = JSON.parse(fs.readFileSync(pinPath, "utf8"));

  assert.equal(pin.schema_version, "kolosseum.phase6.unsupported-activity-contract-pin.v1");
  assert.equal(pin.fixture_path, "test/fixtures/phase1_to_phase6.invalid.unsupported-activity.json");
  assert.equal(typeof pin.module_path, "string");
  assert.ok(pin.module_path.endsWith("run_pipeline.js"), "expected pinned module path to end with run_pipeline.js");
  assert.equal(pin.output !== null && typeof pin.output === "object" && !Array.isArray(pin.output), true, "expected pinned output object");
});

test(
  "phase6 unsupported-activity contract pin executable contract: check mode matches the committed pin against built pipeline output",
  { skip: !hasBuiltPipeline() },
  () => {
    const run = spawnSync(process.execPath, [scriptPath], {
      cwd: repo,
      encoding: "utf8"
    });

    assert.equal(run.status, 0, `expected zero exit code, got ${run.status}\nSTDERR:\n${run.stderr}`);
    assert.match(
      run.stdout,
      /^PHASE6_UNSUPPORTED_PIN_OK::sha256=[a-f0-9]{64}::pin=ci\/golden\/phase1_to_phase6_unsupported_activity_contract\.json\r?\n?$/,
      "expected successful unsupported-activity pin check line"
    );
    assert.equal(run.stderr, "", "expected no stderr in successful unsupported-activity pin check");
  }
);
