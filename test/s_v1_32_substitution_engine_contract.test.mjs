import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildV1SubstitutionResult,
  tryBuildV1SubstitutionResult,
  v1SubstitutionEngineContract,
  v1SubstitutionReasonCodes
} from "../src/v1SubstitutionEngineContract.mjs";

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_engine_contract/s_v1_32_substitution_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_engine_contract_negative/s_v1_32_substitution_negative.json", "utf8")
);

const reasonFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_engine_contract_reason_codes/s_v1_32_substitution_reason_codes.json", "utf8")
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let current = target;

  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }

    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

test("S-V1-32 exposes closed substitution engine contract", () => {
  assert.equal(v1SubstitutionEngineContract.surface_id, "v1_substitution_engine_contract");
  assert.equal(v1SubstitutionEngineContract.version, "1.0.0");
  assert.equal(v1SubstitutionEngineContract.failure_code, "v1_substitution_engine_contract_failure");
  assert.equal(v1SubstitutionEngineContract.contract_version, "S-V1-32");
  assert.equal(v1SubstitutionEngineContract.canonical_json, "stable_sorted_keys");
  assert.equal(v1SubstitutionEngineContract.hash_algorithm, "sha256");
  assert.deepEqual(v1SubstitutionEngineContract.reason_codes, reasonFixture.reason_codes);
});

test("S-V1-32 valid substitution is deterministic and declared-edge based", () => {
  const first = buildV1SubstitutionResult(fixture.valid_input);
  const second = buildV1SubstitutionResult(fixture.same_semantic_input_different_order);

  assert.equal(first.canonical_json, second.canonical_json);
  assert.equal(first.canonical_hash, second.canonical_hash);
  assert.match(first.canonical_hash, /^[a-f0-9]{64}$/u);

  assert.equal(first.substitution_output.substitution_status, "substitution_applied");
  assert.equal(first.substitution_output.source_exercise_id, "bench_press");
  assert.equal(first.substitution_output.target_exercise_id, "dumbbell_bench_press");
  assert.equal(first.substitution_output.substitution_edge_id, "sub_edge_bench_press_to_dumbbell_bench_press");
  assert.deepEqual(first.substitution_output.reason_codes, reasonFixture.applied_expected_reason_codes);
  assert.deepEqual(Object.keys(first.substitution_output).sort(), [...fixture.expected_output_keys].sort());
});

test("S-V1-32 no-change path is explicit when source equipment is available", () => {
  const result = buildV1SubstitutionResult(fixture.not_required_input);

  assert.equal(result.substitution_output.substitution_status, "substitution_not_required");
  assert.equal(result.substitution_output.source_exercise_id, "bench_press");
  assert.equal(result.substitution_output.target_exercise_id, "bench_press");
  assert.equal(result.substitution_output.substitution_edge_id, null);
  assert.deepEqual(result.substitution_output.reason_codes, reasonFixture.not_required_expected_reason_codes);
});

test("S-V1-32 missing declared edge refuses undeclared fallback", () => {
  const input = clone(fixture.valid_input);
  input.substitution_edges = [];

  const result = tryBuildV1SubstitutionResult(input);

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, "v1_substitution_declared_candidate_missing");
  assert.equal(result.error.substitution_status, "substitution_refused");
  assert.equal(result.error.engine_decision, false);
});

test("S-V1-32 missing registry links fail closed", () => {
  for (const testCase of negativeFixture.cases.filter((entry) => entry.case_id.includes("registry_link") || entry.case_id.includes("applicability"))) {
    const input = clone(fixture.valid_input);
    setPath(input, testCase.mutation_path, testCase.mutation_value);

    const result = tryBuildV1SubstitutionResult(input);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
    assert.equal(result.error.engine_decision, false, testCase.case_id);
  }
});

test("S-V1-32 reason codes are factual closed values only", () => {
  assert.deepEqual(v1SubstitutionReasonCodes, reasonFixture.reason_codes);

  const input = clone(fixture.valid_input);
  input.substitution_edges[0].reason_codes = ["declared_edge_matched", "recommended_action"];

  const result = tryBuildV1SubstitutionResult(input);

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, "v1_substitution_reason_code_unknown");
});

test("S-V1-32 unknown and non-factual fields fail closed", () => {
  for (const testCase of negativeFixture.cases) {
    const input = clone(fixture.valid_input);
    setPath(input, testCase.mutation_path, testCase.mutation_value);

    const result = tryBuildV1SubstitutionResult(input);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
  }
});

test("S-V1-32 documentation binds substitution contract without advisory scope", () => {
  const doc = fs.readFileSync("docs/v1/V1_SUBSTITUTION_ENGINE_CONTRACT.md", "utf8");

  assert.match(doc, /Substitution is deterministic/);
  assert.match(doc, /No undeclared fallback/);
  assert.match(doc, /Missing registry links fail closed/);
  assert.match(doc, /factual reason codes only/);
  assert.match(doc, /S-V1-32/);
});

test("S-V1-32 active source does not wire routes persistence or engine phase mutation", () => {
  const source = fs.readFileSync("src/v1SubstitutionEngineContract.mjs", "utf8");

  assert.doesNotMatch(source, /express|router|app\.|fetch|INSERT INTO|UPDATE\s+/i);
  assert.doesNotMatch(source, /\bphase5ApplySubstitutionAndAdjustment\b/);
  assert.doesNotMatch(source, /\bpickBestSubstitute\b/);
});
