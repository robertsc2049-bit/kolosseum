// @law: Repo Governance
// @severity: medium
// @scope: repo
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

import {
  buildV1CompileOutput,
  tryBuildV1CompileOutput,
  v1CompileOutputContract
} from "../../src/v1CompileOutputContract.mjs";

const guard = "S-V1-31";
const TOKEN = "CI_V1_COMPILE_OUTPUT_CONTRACT";

const requiredFiles = [
  "src/v1CompileOutputContract.mjs",
  "test/s_v1_31_compile_output_contract.test.mjs",
  "ci/guards/s_v1_31_compile_output_contract_guard.mjs",
  "docs/v1/V1_COMPILE_OUTPUT_CONTRACT.md",
  "ci/fixtures/v1_compile_output_contract/s_v1_31_compile_output_cases.json",
  "ci/fixtures/v1_compile_output_contract_negative/s_v1_31_forbidden_output_negative.json",
  "ci/fixtures/v1_compile_output_contract_golden/s_v1_31_compile_output_golden.json"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`${TOKEN}: missing required file ${file}`);
  }
}

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_output_contract/s_v1_31_compile_output_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_output_contract_negative/s_v1_31_forbidden_output_negative.json", "utf8")
);

const goldenFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_output_contract_golden/s_v1_31_compile_output_golden.json", "utf8")
);

assert.equal(v1CompileOutputContract.surface_id, "v1_compile_output_contract");
assert.equal(v1CompileOutputContract.failure_code, "v1_compile_output_contract_failure");
assert.equal(v1CompileOutputContract.compile_output_version, "S-V1-31");
assert.equal(v1CompileOutputContract.compile_output_status, "canonical_v1_compile_output");
assert.equal(v1CompileOutputContract.hash_algorithm, "sha256");

const first = buildV1CompileOutput(fixture.valid_input);
const second = buildV1CompileOutput(fixture.same_semantic_input_different_order);

assert.equal(first.canonical_json, second.canonical_json);
assert.equal(first.canonical_hash, second.canonical_hash);
assert.match(first.canonical_hash, /^[a-f0-9]{64}$/u);
assert.deepEqual(Object.keys(first.canonical_output).sort(), [...fixture.expected_canonical_output_keys].sort());

assert.equal(first.canonical_output.execution_ui_contract.work_items.length, 2);
assert.equal(first.canonical_output.history_projection.planned_item_count, 2);
assert.match(first.canonical_output.history_projection.compile_output_hash, /^[a-f0-9]{64}$/u);

const golden = goldenFixture.expected;
assert.equal(first.surface_id, golden.surface_id);
assert.equal(first.compile_output_status, golden.compile_output_status);
assert.deepEqual(first.hash_metadata, golden.hash_metadata);
assert.equal(first.canonical_output.execution_ui_contract.planned_item_count, golden.canonical_output.execution_ui_contract.planned_item_count);
assert.equal(first.canonical_output.history_projection.planned_item_count, golden.canonical_output.history_projection.planned_item_count);
assert.deepEqual(first.canonical_output.runtime_trace, golden.canonical_output.runtime_trace);

for (const testCase of negativeFixture.cases) {
  const input = JSON.parse(JSON.stringify(fixture.valid_input));
  const parts = testCase.mutation_path.split(".");
  let current = input;

  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }

    current = current[part];
  }

  current[parts[parts.length - 1]] = testCase.mutation_value;

  const result = tryBuildV1CompileOutput(input);
  assert.equal(result.ok, false, testCase.case_id);
  assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
  assert.equal(result.error.engine_decision, false, testCase.case_id);
}

const source = fs.readFileSync("src/v1CompileOutputContract.mjs", "utf8");
const testSource = fs.readFileSync("test/s_v1_31_compile_output_contract.test.mjs", "utf8");
const doc = fs.readFileSync("docs/v1/V1_COMPILE_OUTPUT_CONTRACT.md", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

for (const expected of [
  "Output is deterministic",
  "only permitted factual fields",
  "execution UI",
  "history",
  "No UI implementation",
  "S-V1-30",
  "S-V1-31"
]) {
  assert.match(doc, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const expected of [
  "S-V1-31 compile output is deterministic for equivalent input orderings",
  "S-V1-31 canonical output contains only permitted factual fields",
  "S-V1-31 golden output check pins stable public shape"
]) {
  assert.match(testSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const forbidden of [
  "recommendation",
  "recommended_action",
  "risk_score",
  "readiness_score",
  "fatigue_score",
  "coach_notes",
  "billing",
  "payment",
  "programme_worked",
  "programme_failed"
]) {
  assert.ok(v1CompileOutputContract.forbidden_output_keys.includes(forbidden));
}

for (const forbiddenPattern of [
  /\bexpress\b/i,
  /\brouter\b/i,
  /\bINSERT INTO\b/i,
  /\bUPDATE\s+/i
]) {
  assert.doesNotMatch(source, forbiddenPattern);
}

for (const expected of [
  "node --test test/s_v1_31_compile_output_contract.test.mjs",
  "node ci/guards/s_v1_31_compile_output_contract_guard.mjs"
]) {
  assert.ok(packageJson.includes(expected), `package.json must include ${expected}`);
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_31_compile_output_contract.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  throw new Error(`${TOKEN}: S-V1-31 tests failed\n${child.stdout}\n${child.stderr}`);
}

console.log(JSON.stringify({
  ok: true,
  guard,
  token: TOKEN,
  message: "V1 compile output contract passed."
}));
