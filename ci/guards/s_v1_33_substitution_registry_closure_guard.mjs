// @law: Registry Law
// @severity: high
// @scope: registry
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const guard = "S-V1-33";
const TOKEN = "CI_V1_SUBSTITUTION_REGISTRY_CLOSURE";

const requiredFiles = [
  "test/s_v1_33_substitution_registry_closure.test.mjs",
  "ci/guards/s_v1_33_substitution_registry_closure_guard.mjs",
  "docs/v1/V1_SUBSTITUTION_REGISTRY_CLOSURE.md",
  "ci/fixtures/v1_substitution_registry_closure/s_v1_33_substitution_registry_closure_cases.json",
  "ci/fixtures/v1_substitution_registry_closure_negative/s_v1_33_substitution_registry_closure_negative.json"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`${TOKEN}: missing required file ${file}`);
  }
}

const fixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_registry_closure/s_v1_33_substitution_registry_closure_cases.json", "utf8")
);

const negativeFixture = JSON.parse(
  fs.readFileSync("ci/fixtures/v1_substitution_registry_closure_negative/s_v1_33_substitution_registry_closure_negative.json", "utf8")
);

assert.equal(fixture.closure_version, "S-V1-33");
assert.deepEqual([...fixture.supported_activity_ids].sort(), [
  "general_strength",
  "powerlifting",
  "rugby_union"
]);

const edgeActivityIds = [...new Set(fixture.registry_records.substitution_edges.map((edge) => edge.activity_id))].sort();
assert.deepEqual(edgeActivityIds, [
  "general_strength",
  "powerlifting",
  "rugby_union"
]);

for (const edge of fixture.registry_records.substitution_edges) {
  assert.equal(typeof edge.edge_id, "string");
  assert.equal(typeof edge.source_exercise_id, "string");
  assert.equal(typeof edge.target_exercise_id, "string");
  assert.ok(edge.reason_codes.includes("declared_edge_matched"));
}

for (const testCase of negativeFixture.cases) {
  assert.equal(typeof testCase.case_id, "string");
  assert.equal(typeof testCase.mutation_path, "string");
  assert.equal(typeof testCase.expected_reason, "string");
}

assert.ok(
  negativeFixture.cases.some((entry) => entry.expected_reason === "substitution_non_registry_authority_refused"),
  "negative fixture must prove non-registry substitution authority is refused"
);

assert.ok(
  negativeFixture.cases.some((entry) => entry.expected_reason === "v1_substitution_declared_candidate_missing"),
  "negative fixture must prove undeclared fallback is refused by S-V1-32"
);

const doc = fs.readFileSync("docs/v1/V1_SUBSTITUTION_REGISTRY_CLOSURE.md", "utf8");
const testSource = fs.readFileSync("test/s_v1_33_substitution_registry_closure.test.mjs", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

for (const expected of [
  "All substitutions resolve through registry law",
  "No ad hoc substitutions",
  "No UI-only substitution authority",
  "S-V1-21",
  "S-V1-22",
  "S-V1-23",
  "S-V1-24",
  "S-V1-32",
  "S-V1-33"
]) {
  assert.match(doc, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const expected of [
  "S-V1-33 validates complete substitution registry closure for supported activities",
  "S-V1-33 all substitutions resolve through registry law and v1 contract",
  "S-V1-33 refuses ad hoc substitutions and UI-only substitution authority",
  "S-V1-33 negative fixture proves registry closure fails closed"
]) {
  assert.match(testSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const expected of [
  "node --test test/s_v1_33_substitution_registry_closure.test.mjs",
  "node ci/guards/s_v1_33_substitution_registry_closure_guard.mjs"
]) {
  assert.ok(packageJson.includes(expected), `package.json must include ${expected}`);
}

for (const forbiddenFile of [
  "src/v1SubstitutionRegistryClosure.mjs",
  "shared/v1-registry/v1SubstitutionRegistryClosure.mjs",
  "server/api/v1SubstitutionRegistryClosure.ts"
]) {
  assert.equal(fs.existsSync(forbiddenFile), false, `${forbiddenFile} must not be added by S-V1-33`);
}

const child = spawnSync(process.execPath, ["--test", "test/s_v1_33_substitution_registry_closure.test.mjs"], {
  encoding: "utf8",
  stdio: "pipe"
});

if (child.status !== 0) {
  throw new Error(`${TOKEN}: S-V1-33 tests failed\n${child.stdout}\n${child.stderr}`);
}

console.log(JSON.stringify({
  ok: true,
  guard,
  token: TOKEN,
  message: "Substitution registry closure passed."
}));
