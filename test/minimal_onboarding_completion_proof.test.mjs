import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), "utf8"));
}

function sortedKeys(obj) {
  return Object.keys(obj).sort();
}

function extraKeys(actual, allowed) {
  const allowedSet = new Set(allowed);
  return Object.keys(actual).filter((k) => !allowedSet.has(k)).sort();
}

const INDIVIDUAL_KEYS = [
  "activity_id",
  "actor_type",
  "bias_mode",
  "consent_granted",
  "engine_version",
  "enum_bundle_version",
  "execution_scope",
  "exposure_prompt_density",
  "instruction_density",
  "location_type",
  "nd_mode",
  "phase1_schema_version",
].sort();

const COACH_MANAGED_KEYS = [
  "activity_id",
  "actor_type",
  "bias_mode",
  "consent_granted",
  "engine_version",
  "enum_bundle_version",
  "execution_scope",
  "exposure_prompt_density",
  "governing_authority_id",
  "instruction_density",
  "location_type",
  "nd_mode",
  "phase1_schema_version",
].sort();

const BLOATED_OR_EXTRA_PROMPT_PATTERNS = [
  /readiness/i,
  /fatigue/i,
  /injury/i,
  /risk/i,
  /safety/i,
  /benefit/i,
  /performance/i,
  /adherence/i,
  /score/i,
  /recommend/i,
  /goal/i,
];

test("minimal individual onboarding fixture is pinned to the minimum required field set", () => {
  const fixture = readJson("test/fixtures/onboarding/minimal_individual_v0.json");
  assert.deepEqual(sortedKeys(fixture), INDIVIDUAL_KEYS);
  assert.equal(Object.keys(fixture).length, 12);
  assert.equal(fixture.execution_scope, "individual");
  assert.equal("governing_authority_id" in fixture, false);
});

test("minimal coach_managed onboarding fixture is pinned to the minimum required field set", () => {
  const fixture = readJson("test/fixtures/onboarding/minimal_coach_managed_v0.json");
  assert.deepEqual(sortedKeys(fixture), COACH_MANAGED_KEYS);
  assert.equal(Object.keys(fixture).length, 13);
  assert.equal(fixture.execution_scope, "coach_managed");
  assert.equal(typeof fixture.governing_authority_id, "string");
  assert.ok(fixture.governing_authority_id.length > 0);
});

test("coach_managed adds exactly one extra authority field beyond minimal individual onboarding", () => {
  const individual = readJson("test/fixtures/onboarding/minimal_individual_v0.json");
  const coachManaged = readJson("test/fixtures/onboarding/minimal_coach_managed_v0.json");
  const coachOnly = extraKeys(coachManaged, INDIVIDUAL_KEYS);
  assert.deepEqual(coachOnly, ["governing_authority_id"]);
  const individualOnly = extraKeys(individual, COACH_MANAGED_KEYS);
  assert.deepEqual(individualOnly, []);
});

test("invalid extra onboarding field fixture fails the pinned field set", () => {
  const invalid = readJson("test/fixtures/onboarding/invalid_extra_field_v0.json");
  assert.deepEqual(extraKeys(invalid, INDIVIDUAL_KEYS), ["readiness_prompt"]);
});

test("minimal accepted onboarding fixtures contain no bloated or advisory prompt semantics", () => {
  const fixtures = [
    readJson("test/fixtures/onboarding/minimal_individual_v0.json"),
    readJson("test/fixtures/onboarding/minimal_coach_managed_v0.json"),
  ];
  for (const fixture of fixtures) {
    const payload = JSON.stringify(fixture);
    for (const rx of BLOATED_OR_EXTRA_PROMPT_PATTERNS) {
      assert.equal(rx.test(payload), false, `unexpected onboarding drift: ${rx}`);
    }
  }
});