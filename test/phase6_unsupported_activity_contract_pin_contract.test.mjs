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

test("phase6 unsupported-activity contract pin source contract: script exposes write mode, pin path, semantic failure assertion, and built pipeline candidates", () => {
  const jsSrc = fs.readFileSync(scriptPath, "utf8");

  assert.equal(fs.existsSync(scriptPath), true, "expected unsupported-activity pin script to exist");
  assert.equal(fs.existsSync(fixturePath), true, "expected unsupported-activity fixture to exist");

  assert.match(jsSrc, /const DEFAULT_PIN_PATH = "ci\/golden\/phase1_to_phase6_unsupported_activity_contract\.json";/, "expected default pin path");
  assert.match(jsSrc, /process\.argv\.includes\("--write"\)/, "expected write mode");
  assert.match(jsSrc, /expected ok=false, got ok=/, "expected semantic failure assertion");
  assert.match(jsSrc, /failure result must include non-empty failure_token/, "expected explicit failure_token assertion");
  assert.doesNotMatch(jsSrc, /returned_failure_marker/, "did not expect legacy generic failure marker logic");
});

test("phase6 unsupported-activity contract pin file is present and pinned to an explicit failure output", () => {
  const pin = JSON.parse(fs.readFileSync(pinPath, "utf8"));

  assert.equal(pin.schema_version, "kolosseum.phase6.unsupported-activity-contract-pin.v1");
  assert.equal(pin.fixture_path, "test/fixtures/phase1_to_phase6.invalid.unsupported-activity.json");
  assert.equal(typeof pin.module_path, "string");
  assert.ok(pin.module_path.endsWith("run_pipeline.js"), "expected pinned module path to end with run_pipeline.js");
  assert.equal(pin.output !== null && typeof pin.output === "object" && !Array.isArray(pin.output), true, "expected pinned output object");
  assert.equal(pin.output.ok, false, "expected pinned unsupported-activity output to fail explicitly");
  assert.equal(typeof pin.output.failure_token, "string", "expected pinned failure_token string");
  assert.ok(pin.output.failure_token.length > 0, "expected non-empty pinned failure_token");
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
