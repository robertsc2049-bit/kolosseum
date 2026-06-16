import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildV1CompileOutput,
  tryBuildV1CompileOutput,
  v1CompileOutputContract
} from "../src/v1CompileOutputContract.mjs";

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_output_contract/s_v1_31_compile_output_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_output_contract_negative/s_v1_31_forbidden_output_negative.json", "utf8")
);

const goldenFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_output_contract_golden/s_v1_31_compile_output_golden.json", "utf8")
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

test("S-V1-31 exposes closed compile output contract", () => {
  assert.equal(v1CompileOutputContract.surface_id, "v1_compile_output_contract");
  assert.equal(v1CompileOutputContract.version, "1.0.0");
  assert.equal(v1CompileOutputContract.failure_code, "v1_compile_output_contract_failure");
  assert.equal(v1CompileOutputContract.compile_output_version, "S-V1-31");
  assert.equal(v1CompileOutputContract.compile_output_status, "canonical_v1_compile_output");
  assert.equal(v1CompileOutputContract.canonical_json, "stable_sorted_keys");
  assert.equal(v1CompileOutputContract.hash_algorithm, "sha256");
  assert.deepEqual(
    [...v1CompileOutputContract.required_canonical_output_keys].sort(),
    [...fixture.expected_canonical_output_keys].sort()
  );
});

test("S-V1-31 compile output is deterministic for equivalent input orderings", () => {
  const first = buildV1CompileOutput(fixture.valid_input);
  const second = buildV1CompileOutput(fixture.same_semantic_input_different_order);

  assert.equal(first.canonical_json, second.canonical_json);
  assert.equal(first.canonical_hash, second.canonical_hash);
  assert.match(first.canonical_hash, /^[a-f0-9]{64}$/u);
  assert.equal(first.hash_metadata.algorithm, "sha256");
  assert.equal(first.hash_metadata.canonical_json, "stable_sorted_keys");
  assert.equal(first.hash_metadata.hash_field, "canonical_hash");
});

test("S-V1-31 canonical output contains only permitted factual fields", () => {
  const result = buildV1CompileOutput(fixture.valid_input);
  const output = result.canonical_output;

  assert.deepEqual(Object.keys(output).sort(), [...fixture.expected_canonical_output_keys].sort());
  assert.equal(output.factual_only, true);
  assert.equal(output.activity_id, "powerlifting");
  assert.equal(output.compile_input_version, "S-V1-30");
  assert.equal(output.compile_output_version, "S-V1-31");
  assert.equal(output.compile_output_status, "canonical_v1_compile_output");
  assert.equal(output.execution_ui_contract.session_id, "session_001");
  assert.equal(output.execution_ui_contract.work_items.length, 2);
  assert.equal(output.execution_ui_contract.work_items[0].status, "not_started");
  assert.equal(output.history_projection.planned_item_count, 2);
  assert.match(output.history_projection.compile_output_hash, /^[a-f0-9]{64}$/u);
});

test("S-V1-31 forbidden advisory and claim fields fail closed", () => {
  for (const testCase of negativeFixture.cases) {
    const input = clone(fixture.valid_input);
    setPath(input, testCase.mutation_path, testCase.mutation_value);

    const result = tryBuildV1CompileOutput(input);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
    assert.equal(result.error.engine_decision, false, testCase.case_id);
  }
});

test("S-V1-31 golden output check pins stable public shape", () => {
  const result = buildV1CompileOutput(fixture.valid_input);
  const golden = goldenFixture.expected;

  assert.equal(result.surface_id, golden.surface_id);
  assert.equal(result.version, golden.version);
  assert.equal(result.compile_output_status, golden.compile_output_status);
  assert.deepEqual(result.hash_metadata, golden.hash_metadata);

  assert.equal(result.canonical_output.activity_id, golden.canonical_output.activity_id);
  assert.equal(result.canonical_output.compile_input_hash, golden.canonical_output.compile_input_hash);
  assert.equal(result.canonical_output.compile_input_version, golden.canonical_output.compile_input_version);
  assert.equal(result.canonical_output.compile_output_status, golden.canonical_output.compile_output_status);
  assert.equal(result.canonical_output.compile_output_version, golden.canonical_output.compile_output_version);
  assert.equal(result.canonical_output.engine_version, golden.canonical_output.engine_version);
  assert.equal(result.canonical_output.factual_only, golden.canonical_output.factual_only);
  assert.equal(result.canonical_output.planned_session.session_id, golden.canonical_output.planned_session.session_id);
  assert.equal(result.canonical_output.execution_ui_contract.planned_item_count, golden.canonical_output.execution_ui_contract.planned_item_count);
  assert.equal(result.canonical_output.history_projection.planned_item_count, golden.canonical_output.history_projection.planned_item_count);
  assert.deepEqual(result.canonical_output.runtime_trace, golden.canonical_output.runtime_trace);
});

test("S-V1-31 documentation binds execution UI and history without UI implementation", () => {
  const doc = fs.readFileSync("docs/v1/V1_COMPILE_OUTPUT_CONTRACT.md", "utf8");

  assert.match(doc, /Output is deterministic/);
  assert.match(doc, /only permitted factual fields/);
  assert.match(doc, /execution UI/);
  assert.match(doc, /history/);
  assert.match(doc, /No UI implementation/);
  assert.match(doc, /S-V1-31/);
});

test("S-V1-31 source avoids live UI route or persistence implementation", () => {
  const source = fs.readFileSync("src/v1CompileOutputContract.mjs", "utf8");

  assert.doesNotMatch(source, /express|router|app\.|fetch|INSERT INTO|UPDATE\s+/i);
});
