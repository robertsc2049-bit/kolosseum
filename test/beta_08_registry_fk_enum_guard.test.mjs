import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  BETA_08_FAILURE_TOKENS,
  beta08ValidateRegistryFkEnumGuard
} from "../ci/registry/beta_08_registry_fk_enum_guard.mjs";

import {
  beta08NegativeFixtures,
  beta08PositiveFixtures
} from "../ci/fixtures/beta_08_registry_fk_enum_guard/fixture_cases.mjs";

function assertFailureToken(fixture, expectedToken) {
  assert.equal(fixture.slice_id, "BETA-08");
  assert.equal(fixture.expected_failure_token, expectedToken);

  assert.throws(
    () => beta08ValidateRegistryFkEnumGuard(fixture),
    (error) =>
      error?.code === expectedToken &&
      error?.failure_token === expectedToken &&
      typeof error?.reason === "string" &&
      error.reason.length > 0
  );
}

test("BETA-08 positive beta activity fixtures pass closed FK and enum validation", () => {
  const expectedActivities = ["powerlifting", "rugby_union", "general_strength"];

  for (const activityId of expectedActivities) {
    const result = beta08ValidateRegistryFkEnumGuard(beta08PositiveFixtures[activityId]);

    assert.equal(result.ok, true, activityId);
    assert.equal(result.guard_slice_id, "BETA-08", activityId);
    assert.equal(result.checked_activity_id, activityId, activityId);
    assert.equal(result.enum_bundle_version, "EB2-1.0.0", activityId);
    assert.equal(result.closed_world, true, activityId);
    assert.equal(result.failure_domain, "ci_registry_fk_enum_guard", activityId);
    assert.equal(result.sport_metric_count, 1, activityId);
    assert.equal(result.metric_exercise_link_count, 1, activityId);
    assert.equal(Object.isFrozen(result), true, activityId);
  }
});

test("BETA-08 unknown enum token fails closed", () => {
  assertFailureToken(beta08NegativeFixtures.unknown_enum, BETA_08_FAILURE_TOKENS.UNKNOWN_ENUM_TOKEN);
});

test("BETA-08 unresolved FK fails closed", () => {
  assertFailureToken(beta08NegativeFixtures.bad_fk, BETA_08_FAILURE_TOKENS.UNRESOLVED_FK);
});

test("BETA-08 duplicate registry entry id fails closed", () => {
  assertFailureToken(beta08NegativeFixtures.duplicate_id, BETA_08_FAILURE_TOKENS.DUPLICATE_ENTRY_ID);
});

test("BETA-08 missing 1C-A metric-to-exercise link fails where linked metric is declared", () => {
  assertFailureToken(beta08NegativeFixtures.missing_1c_a_link, BETA_08_FAILURE_TOKENS.MISSING_METRIC_EXERCISE_LINK);
});

test("BETA-08 metric/activity mismatch fails closed", () => {
  assertFailureToken(beta08NegativeFixtures.metric_activity_mismatch, BETA_08_FAILURE_TOKENS.METRIC_ACTIVITY_MISMATCH);
});

test("BETA-08 activity/subdivision mismatch fails closed", () => {
  assertFailureToken(beta08NegativeFixtures.activity_subdivision_mismatch, BETA_08_FAILURE_TOKENS.ACTIVITY_SUBDIVISION_MISMATCH);
});

test("BETA-08 derived-only metric in Phase 1 fails closed", () => {
  assertFailureToken(beta08NegativeFixtures.derived_only_phase1_metric, BETA_08_FAILURE_TOKENS.DERIVED_ONLY_PHASE1_METRIC);
});

test("BETA-08 registry cross-domain contamination fails closed", () => {
  assertFailureToken(beta08NegativeFixtures.cross_domain_contamination, BETA_08_FAILURE_TOKENS.CROSS_DOMAIN_CONTAMINATION);
});

test("BETA-08 fixture surface names all required positive and negative cases", () => {
  assert.deepEqual(Object.keys(beta08PositiveFixtures), [
    "powerlifting",
    "rugby_union",
    "general_strength"
  ]);

  assert.deepEqual(Object.keys(beta08NegativeFixtures), [
    "unknown_enum",
    "bad_fk",
    "duplicate_id",
    "missing_1c_a_link",
    "metric_activity_mismatch",
    "activity_subdivision_mismatch",
    "derived_only_phase1_metric",
    "cross_domain_contamination"
  ]);
});

test("BETA-08 extends registry validation without adding a duplicate loader or file discovery", () => {
  const sourcePath = path.join(process.cwd(), "ci", "registry", "beta_08_registry_fk_enum_guard.mjs");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /beta07LoadAtomicRegistryStore/);
  assert.match(source, /DEV NOTE: BETA-08 registry FK and enum guard/);
  assert.doesNotMatch(source, /readFileSync/u);
  assert.doesNotMatch(source, /writeFileSync/u);
  assert.doesNotMatch(source, /readdirSync/u);
});
