import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildV1CompileInput,
  stableCanonicalJson,
  tryBuildV1CompileInput,
  v1CompileInputCanonicalisationContract
} from "../src/v1CompileInputCanonicalisation.mjs";

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_input_canonicalisation/s_v1_30_compile_input_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_input_canonicalisation_negative/s_v1_30_unknown_field_negative.json", "utf8")
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

test("S-V1-30 exposes closed compile input canonicalisation contract", () => {
  assert.equal(v1CompileInputCanonicalisationContract.surface_id, "v1_compile_input_canonicalisation");
  assert.equal(v1CompileInputCanonicalisationContract.version, "1.0.0");
  assert.equal(v1CompileInputCanonicalisationContract.failure_code, "v1_compile_input_canonicalisation_failure");
  assert.equal(v1CompileInputCanonicalisationContract.compile_input_version, "S-V1-30");
  assert.equal(v1CompileInputCanonicalisationContract.compile_input_status, "canonical_v1_compile_input");
  assert.equal(v1CompileInputCanonicalisationContract.canonical_json, "stable_sorted_keys");
  assert.equal(v1CompileInputCanonicalisationContract.hash_algorithm, "sha256");
  assert.deepEqual(
    [...v1CompileInputCanonicalisationContract.required_engine_visible_fields].sort(),
    [...fixture.expected_visible_fields].sort()
  );
});

test("S-V1-30 canonical hash is stable for equivalent input orderings", () => {
  const first = buildV1CompileInput(fixture.valid_input);
  const second = buildV1CompileInput(fixture.same_semantic_input_different_order);

  assert.equal(first.canonical_json, second.canonical_json);
  assert.equal(first.canonical_hash, second.canonical_hash);
  assert.match(first.canonical_hash, /^[a-f0-9]{64}$/u);
  assert.equal(first.hash_metadata.algorithm, "sha256");
  assert.equal(first.hash_metadata.canonical_json, "stable_sorted_keys");
  assert.equal(first.hash_metadata.hash_field, "canonical_hash");
});

test("S-V1-30 canonical input exposes only explicit engine-visible fields", () => {
  const result = buildV1CompileInput(fixture.valid_input);
  const canonicalKeys = Object.keys(result.canonical_input).sort();

  assert.deepEqual(canonicalKeys, [...fixture.expected_visible_fields].sort());
  assert.equal(result.canonical_input.activity_id, "powerlifting");
  assert.equal(result.canonical_input.compile_input_version, "S-V1-30");
  assert.equal(result.canonical_input.compile_input_status, "canonical_v1_compile_input");
  assert.equal(result.canonical_input.programme_assignment_id, "programme_assignment_001");
  assert.equal(result.canonical_input.template_id, "template_powerlifting_001");
});

test("S-V1-30 stable canonical JSON sorts nested object keys", () => {
  const left = stableCanonicalJson({
    z: 1,
    a: {
      d: true,
      b: "x"
    }
  });

  const right = stableCanonicalJson({
    a: {
      b: "x",
      d: true
    },
    z: 1
  });

  assert.equal(left, right);
  assert.equal(left, "{\"a\":{\"b\":\"x\",\"d\":true},\"z\":1}");
});

test("S-V1-30 unknown and non-engine fields fail closed", () => {
  for (const testCase of negativeFixture.cases) {
    const input = clone(fixture.valid_input);
    setPath(input, testCase.mutation_path, testCase.mutation_value);

    const result = tryBuildV1CompileInput(input);

    assert.equal(result.ok, false, testCase.case_id);
    assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
    assert.equal(result.error.engine_decision, false, testCase.case_id);
  }
});

test("S-V1-30 compile input rejects activity and registry mismatches", () => {
  const activityMismatch = clone(fixture.valid_input);
  activityMismatch.programme_template.activity_id = "rugby_union";

  const activityResult = tryBuildV1CompileInput(activityMismatch);

  assert.equal(activityResult.ok, false);
  assert.equal(activityResult.error.reason, "v1_compile_input_activity_mismatch");

  const registryMismatch = clone(fixture.valid_input);
  registryMismatch.registry_bundle.template_registry_version = "different_template_registry";

  const registryResult = tryBuildV1CompileInput(registryMismatch);

  assert.equal(registryResult.ok, false);
  assert.equal(registryResult.error.reason, "v1_compile_input_template_registry_version_mismatch");
});

test("S-V1-30 documentation binds canonicalisation without billing notes UI or copy as engine input", () => {
  const doc = fs.readFileSync("docs/v1/V1_COMPILE_INPUT_CANONICALISATION.md", "utf8");

  assert.match(doc, /Engine input canonicalisation is stable/);
  assert.match(doc, /Non-engine fields are rejected/);
  assert.match(doc, /Hashes are reproducible/);
  assert.match(doc, /billing/);
  assert.match(doc, /coach notes/);
  assert.match(doc, /UI state/);
  assert.match(doc, /copy/);
  assert.match(doc, /S-V1-30/);
});
