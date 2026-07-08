// @law: Repo Governance
// @severity: medium
// @scope: repo
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

import {
  buildV1CompileInput,
  tryBuildV1CompileInput,
  v1CompileInputCanonicalisationContract
} from "../../src/v1CompileInputCanonicalisation.mjs";

const guard = "S-V1-30";
const TOKEN = "CI_V1_COMPILE_INPUT_CANONICALISATION";

const requiredFiles = [
  "src/v1CompileInputCanonicalisation.mjs",
  "test/s_v1_30_compile_input_canonicalisation.test.mjs",
  "ci/guards/s_v1_30_compile_input_canonicalisation_guard.mjs",
  "docs/v1/V1_COMPILE_INPUT_CANONICALISATION.md",
  "ci/fixtures/v1_compile_input_canonicalisation/s_v1_30_compile_input_cases.json",
  "ci/fixtures/v1_compile_input_canonicalisation_negative/s_v1_30_unknown_field_negative.json"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`${TOKEN}: missing required file ${file}`);
  }
}

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_input_canonicalisation/s_v1_30_compile_input_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_compile_input_canonicalisation_negative/s_v1_30_unknown_field_negative.json", "utf8")
);

assert.equal(v1CompileInputCanonicalisationContract.surface_id, "v1_compile_input_canonicalisation");
assert.equal(v1CompileInputCanonicalisationContract.failure_code, "v1_compile_input_canonicalisation_failure");
assert.equal(v1CompileInputCanonicalisationContract.compile_input_version, "S-V1-30");
assert.equal(v1CompileInputCanonicalisationContract.compile_input_status, "canonical_v1_compile_input");
assert.equal(v1CompileInputCanonicalisationContract.hash_algorithm, "sha256");

const first = buildV1CompileInput(fixture.valid_input);
const second = buildV1CompileInput(fixture.same_semantic_input_different_order);

assert.equal(first.canonical_json, second.canonical_json);
assert.equal(first.canonical_hash, second.canonical_hash);
assert.match(first.canonical_hash, /^[a-f0-9]{64}$/u);
assert.deepEqual(Object.keys(first.canonical_input).sort(), [...fixture.expected_visible_fields].sort());

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

  const result = tryBuildV1CompileInput(input);
  assert.equal(result.ok, false, testCase.case_id);
  assert.equal(result.error.reason, testCase.expected_reason, testCase.case_id);
  assert.equal(result.error.engine_decision, false, testCase.case_id);
}

const source = fs.readFileSync("src/v1CompileInputCanonicalisation.mjs", "utf8");
const testSource = fs.readFileSync("test/s_v1_30_compile_input_canonicalisation.test.mjs", "utf8");
const doc = fs.readFileSync("docs/v1/V1_COMPILE_INPUT_CANONICALISATION.md", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

for (const expected of [
  "Engine input canonicalisation is stable",
  "Non-engine fields are rejected",
  "Hashes are reproducible",
  "S-V1-18",
  "S-V1-28",
  "S-V1-29"
]) {
  assert.match(doc, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const expected of [
  "S-V1-30 canonical hash is stable for equivalent input orderings",
  "S-V1-30 unknown and non-engine fields fail closed",
  "S-V1-30 canonical input exposes only explicit engine-visible fields"
]) {
  assert.match(testSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const forbidden of [
  "billing_state",
  "coach_notes",
  "ui_state",
  "copy_id",
  "relationship_id",
  "assigned_athlete_id",
  "assigned_by_coach_id"
]) {
  assert.ok(v1CompileInputCanonicalisationContract.forbidden_non_engine_keys.includes(forbidden));
}

for (const expected of [
  "node --test test/s_v1_30_compile_input_canonicalisation.test.mjs",
  "node ci/guards/s_v1_30_compile_input_canonicalisation_guard.mjs"
]) {
  assert.ok(packageJson.includes(expected), `package.json must include ${expected}`);
}

if (!source.includes("stableCanonicalJson")) {
  throw new Error(`${TOKEN}: stableCanonicalJson export missing`);
}

if (!source.includes("sha256Hex")) {
  throw new Error(`${TOKEN}: sha256Hex export missing`);
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_30_compile_input_canonicalisation.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  throw new Error(`${TOKEN}: S-V1-30 tests failed\n${child.stdout}\n${child.stderr}`);
}

console.log(JSON.stringify({
  ok: true,
  guard,
  token: TOKEN,
  message: "V1 compile input canonicalisation passed."
}));
