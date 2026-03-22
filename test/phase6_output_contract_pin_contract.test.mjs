import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const scriptPath = path.join(repo, "scripts", "pin_phase1_to_phase6_output_contract.mjs");
const pinPath = path.join(repo, "ci", "golden", "phase1_to_phase6_output_contract.json");
const fixturePath = path.join(repo, "test", "fixtures", "phase1_to_phase6.valid.general_strength.individual.json");

function hasBuiltPipeline() {
  const candidates = [
    path.join(repo, "dist", "src", "run_pipeline.js"),
    path.join(repo, "dist", "engine", "src", "run_pipeline.js"),
    path.join(repo, "dist", "run_pipeline.js")
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

test("phase6 output contract pin source contract: script exposes write mode, pin path, exact schema assertion, and built pipeline candidates", () => {
  const jsSrc = fs.readFileSync(scriptPath, "utf8");

  assert.equal(fs.existsSync(scriptPath), true, "expected phase6 pin script to exist");
  assert.equal(fs.existsSync(fixturePath), true, "expected positive executable fixture to exist");

  assert.match(jsSrc, /const DEFAULT_PIN_PATH = "ci\/golden\/phase1_to_phase6_output_contract\.json";/, "expected default pin path");
  assert.match(jsSrc, /process\.argv\.includes\("--write"\)/, "expected write mode");
  assert.match(jsSrc, /expected ok=true, got ok=/, "expected semantic success assertion");
  assert.match(jsSrc, /success result must have exact top-level keys ok,result/, "expected exact success shape assertion");
  assert.match(jsSrc, /same positive fixture produced different normalized outputs/, "expected determinism failure guard");
});

test("phase6 output contract pin file is present and pinned to exact ok/result public output schema", () => {
  const pin = JSON.parse(fs.readFileSync(pinPath, "utf8"));

  assert.equal(pin.schema_version, "kolosseum.phase6.output-contract-pin.v2");
  assert.equal(pin.fixture_path, "test/fixtures/phase1_to_phase6.valid.general_strength.individual.json");
  assert.equal(typeof pin.module_path, "string");
  assert.ok(pin.module_path.endsWith("run_pipeline.js"), "expected pinned module path to end with run_pipeline.js");
  assert.equal(pin.output !== null && typeof pin.output === "object" && !Array.isArray(pin.output), true, "expected pinned output object");
  assert.deepEqual(Object.keys(pin.output).sort(), ["ok", "result"], "expected exact top-level output schema");
  assert.equal(pin.output.ok, true, "expected pinned successful output");
  assert.equal(typeof pin.output.failure_token, "undefined", "did not expect failure_token on pinned success output");
  assert.equal(pin.output.result !== null && typeof pin.output.result === "object" && !Array.isArray(pin.output.result), true, "expected pinned result object");
});

test(
  "phase6 output contract pin executable contract: check mode matches the committed pin against built pipeline output",
  { skip: !hasBuiltPipeline() },
  () => {
    const run = spawnSync(process.execPath, [scriptPath], {
      cwd: repo,
      encoding: "utf8"
    });

    assert.equal(run.status, 0, `expected zero exit code, got ${run.status}\nSTDERR:\n${run.stderr}`);
    assert.match(
      run.stdout,
      /^PHASE6_PIN_OK::sha256=[a-f0-9]{64}::pin=ci\/golden\/phase1_to_phase6_output_contract\.json\r?\n?$/,
      "expected successful phase6 pin check line"
    );
    assert.equal(run.stderr, "", "expected no stderr in successful pin check");
  }
);
