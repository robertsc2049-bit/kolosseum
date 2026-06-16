// @law: Runtime Boundary
// @severity: high
// @scope: engine
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

import {
  buildV1SubstitutionResult,
  tryBuildV1SubstitutionResult,
  v1SubstitutionEngineContract,
  v1SubstitutionReasonCodes
} from "../../src/v1SubstitutionEngineContract.mjs";

const guard = "S-V1-32";
const TOKEN = "CI_V1_SUBSTITUTION_ENGINE_CONTRACT";

const requiredFiles = [
  "src/v1SubstitutionEngineContract.mjs",
  "test/s_v1_32_substitution_engine_contract.test.mjs",
  "ci/guards/s_v1_32_substitution_engine_contract_guard.mjs",
  "docs/v1/V1_SUBSTITUTION_ENGINE_CONTRACT.md",
  "ci/fixtures/v1_substitution_engine_contract/s_v1_32_substitution_cases.json",
  "ci/fixtures/v1_substitution_engine_contract_negative/s_v1_32_substitution_negative.json",
  "ci/fixtures/v1_substitution_engine_contract_reason_codes/s_v1_32_substitution_reason_codes.json"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`${TOKEN}: missing required file ${file}`);
  }
}

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_engine_contract/s_v1_32_substitution_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_engine_contract_negative/s_v1_32_substitution_negative.json", "utf8")
);

const reasonFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_engine_contract_reason_codes/s_v1_32_substitution_reason_codes.json", "utf8")
);

assert.equal(v1SubstitutionEngineContract.surface_id, "v1_substitution_engine_contract");
assert.equal(v1SubstitutionEngineContract.failure_code, "v1_substitution_engine_contract_failure");
assert.equal(v1SubstitutionEngineContract.contract_version, "S-V1-32");
assert.equal(v1SubstitutionEngineContract.hash_algorithm, "sha256");
assert.deepEqual(v1SubstitutionReasonCodes, reasonFixture.reason_codes);

const first = buildV1SubstitutionResult(fixture.valid_input);
const second = buildV1SubstitutionResult(fixture.same_semantic_input_different_order);

assert.equal(first.canonical_json, second.canonical_json);
assert.equal(first.canonical_hash, second.canonical_hash);
assert.match(first.canonical_hash, /^[a-f0-9]{64}$/u);
assert.equal(first.substitution_output.substitution_status, "substitution_applied");
assert.equal(first.substitution_output.target_exercise_id, "dumbbell_bench_press");
assert.deepEqual(first.substitution_output.reason_codes, reasonFixture.applied_expected_reason_codes);

const notRequired = buildV1SubstitutionResult(fixture.not_required_input);
assert.equal(notRequired.substitution_output.substitution_status, "substitution_not_required");
assert.deepEqual(notRequired.substitution_output.reason_codes, reasonFixture.not_required_expected_reason_codes);

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

  const result = tryBuildV1SubstitutionResult(input);
  assert.equal(result.ok, false, testCase.case_id);
  assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
  assert.equal(result.error.substitution_status, "substitution_refused", testCase.case_id);
}

const source = fs.readFileSync("src/v1SubstitutionEngineContract.mjs", "utf8");
const testSource = fs.readFileSync("test/s_v1_32_substitution_engine_contract.test.mjs", "utf8");
const doc = fs.readFileSync("docs/v1/V1_SUBSTITUTION_ENGINE_CONTRACT.md", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

for (const expected of [
  "Substitution is deterministic",
  "No undeclared fallback",
  "Missing registry links fail closed",
  "factual reason codes only",
  "S-V1-21",
  "S-V1-22",
  "S-V1-23",
  "S-V1-24",
  "S-V1-32"
]) {
  assert.match(doc, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const expected of [
  "S-V1-32 valid substitution is deterministic and declared-edge based",
  "S-V1-32 missing declared edge refuses undeclared fallback",
  "S-V1-32 reason codes are factual closed values only"
]) {
  assert.match(testSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const expected of [
  "node --test test/s_v1_32_substitution_engine_contract.test.mjs",
  "node ci/guards/s_v1_32_substitution_engine_contract_guard.mjs"
]) {
  assert.ok(packageJson.includes(expected), `package.json must include ${expected}`);
}

for (const forbiddenPattern of [
  /\bexpress\b/i,
  /\brouter\b/i,
  /\bINSERT INTO\b/i,
  /\bUPDATE\s+/i,
  /\bphase5ApplySubstitutionAndAdjustment\b/,
  /\bpickBestSubstitute\b/
]) {
  assert.doesNotMatch(source, forbiddenPattern);
}

for (const forbiddenKey of [
  "recommendation",
  "recommended_action",
  "optimisation",
  "optimization",
  "optimal",
  "safety",
  "risk",
  "risk_score",
  "rank",
  "ranking",
  "score"
]) {
  assert.ok(v1SubstitutionEngineContract.forbidden_keys.includes(forbiddenKey), `missing forbidden key ${forbiddenKey}`);
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_32_substitution_engine_contract.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  throw new Error(`${TOKEN}: S-V1-32 tests failed\n${child.stdout}\n${child.stderr}`);
}

console.log(JSON.stringify({
  ok: true,
  guard,
  token: TOKEN,
  message: "V1 substitution engine contract passed."
}));
