import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASSIC_PRILEPIN_ZONES,
  MODIFIED_PRILEPIN_ZONES,
  PrilepinChartReferenceError,
  lookupPrilepinZones
} from "../shared/prilepin-reference/prilepinChartReference.mjs";

function assertFails(thunk, code) {
  assert.throws(
    thunk,
    (error) => error instanceof PrilepinChartReferenceError && error.code === code
  );
}

test("PRILEPIN-CHART rejects an invalid percentage", () => {
  assertFails(() => lookupPrilepinZones(0), "prilepin_percentage_invalid");
  assertFails(() => lookupPrilepinZones(101), "prilepin_percentage_invalid");
  assertFails(() => lookupPrilepinZones("not-a-number"), "prilepin_percentage_invalid");
  assertFails(() => lookupPrilepinZones(null), "prilepin_percentage_invalid");
});

test("PRILEPIN-CHART matches the classic table at zone boundaries", () => {
  assert.deepEqual(
    lookupPrilepinZones(55).chart_matches.map((zone) => zone.zone_id).sort(),
    ["classic_sub_maximal", "modified_moderate_volume"]
  );
  assert.deepEqual(
    lookupPrilepinZones(69).chart_matches.map((zone) => zone.zone_id),
    ["classic_sub_maximal"]
  );
  assert.deepEqual(
    lookupPrilepinZones(70).chart_matches.map((zone) => zone.zone_id),
    ["classic_intermediate"]
  );
  assert.deepEqual(
    lookupPrilepinZones(89).chart_matches.map((zone) => zone.zone_id),
    ["classic_maximal"]
  );
  assert.deepEqual(
    lookupPrilepinZones(90).chart_matches.map((zone) => zone.zone_id),
    ["classic_super_maximal"]
  );
  assert.deepEqual(
    lookupPrilepinZones(100).chart_matches.map((zone) => zone.zone_id),
    ["classic_super_maximal"]
  );
});

test("PRILEPIN-CHART matches the modified table at zone boundaries", () => {
  assert.deepEqual(
    lookupPrilepinZones(30).chart_matches.map((zone) => zone.zone_id),
    ["modified_high_volume"]
  );
  assert.deepEqual(
    lookupPrilepinZones(40).chart_matches.map((zone) => zone.zone_id),
    ["modified_moderate_high_volume"]
  );
  assert.deepEqual(
    lookupPrilepinZones(50).chart_matches.map((zone) => zone.zone_id),
    ["modified_moderate_volume"]
  );
});

test("PRILEPIN-CHART returns both tables' zones when they overlap", () => {
  const result = lookupPrilepinZones(60);
  assert.deepEqual(
    result.chart_matches.map((zone) => zone.zone_id).sort(),
    ["classic_sub_maximal", "modified_moderate_volume"]
  );
});

test("PRILEPIN-CHART returns no matches for a percentage below both tables", () => {
  const result = lookupPrilepinZones(20);
  assert.deepEqual(result.chart_matches, []);
});

test("PRILEPIN-CHART never auto-selects between tables and never derives sets/reps", () => {
  const result = lookupPrilepinZones(60);
  assert.equal(result.chart_matches.length > 1, true, "expected more than one candidate zone to prove no auto-selection happened");
  for (const zone of result.chart_matches) {
    assert.equal(Object.hasOwn(zone, "planned_sets"), false);
    assert.equal(Object.hasOwn(zone, "planned_reps"), false);
  }
});

test("PRILEPIN-CHART declares the exact factual/no-inference disclosure shape", () => {
  const result = lookupPrilepinZones(75);
  assert.equal(result.type, "prilepin_zone_reference");
  assert.equal(result.percentage, 75);
  assert.equal(result.factual_reference_only, true);
  assert.equal(result.recommendation_inferred, false);
  assert.equal(result.optimisation_inferred, false);
  assert.equal(result.readiness_inferred, false);
  assert.equal(result.suitability_inferred, false);
  assert.equal(result.safety_inferred, false);
});

test("PRILEPIN-CHART output is deeply frozen", () => {
  const result = lookupPrilepinZones(80);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.chart_matches), true);
  assert.equal(Object.isFrozen(result.chart_matches[0]), true);
  assert.equal(Object.isFrozen(CLASSIC_PRILEPIN_ZONES), true);
  assert.equal(Object.isFrozen(MODIFIED_PRILEPIN_ZONES), true);
});

test("PRILEPIN-CHART zones never overlap within the same table", () => {
  for (const table of [CLASSIC_PRILEPIN_ZONES, MODIFIED_PRILEPIN_ZONES]) {
    const sorted = [...table].sort((a, b) => a.percent_1rm_min - b.percent_1rm_min);
    for (let i = 1; i < sorted.length; i += 1) {
      assert.equal(
        sorted[i].percent_1rm_min > sorted[i - 1].percent_1rm_max,
        true,
        `expected ${sorted[i].zone_id} to start after ${sorted[i - 1].zone_id} ends`
      );
    }
  }
});
