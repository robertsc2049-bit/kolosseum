// DEV NOTE: pure logic, no JSX - named .tsx (not .ts) so it's picked up by
// npm run test:react's `public/app-src/__tests__/*.test.tsx` glob. A
// colocated utils/*.test.ts file would not run under any existing script.
import assert from "node:assert/strict";
import test from "node:test";

import { computePlateBreakdown, computeWarmupRamp, nearestAchievableWeight } from "../utils/plateCalculator";

test("computePlateBreakdown resolves a kg target with a mix of plate sizes", () => {
  const result = computePlateBreakdown(100, 20, "kg");
  assert.deepEqual(result.perSide, [{ plate: 25, count: 1 }, { plate: 15, count: 1 }]);
  assert.equal(result.achievedWeight, 100);
  assert.equal(result.exact, true);
});

test("computePlateBreakdown resolves an lb target with a single plate size", () => {
  const result = computePlateBreakdown(225, 45, "lb");
  assert.deepEqual(result.perSide, [{ plate: 45, count: 2 }]);
  assert.equal(result.achievedWeight, 225);
  assert.equal(result.exact, true);
});

test("computePlateBreakdown returns an empty breakdown when the target is below the bar weight", () => {
  const result = computePlateBreakdown(15, 20, "kg");
  assert.deepEqual(result.perSide, []);
  assert.equal(result.achievedWeight, 20);
  assert.equal(result.exact, false);
});

test("computePlateBreakdown stays exact across repeated fractional-plate subtraction", () => {
  const result = computePlateBreakdown(27.5, 20, "kg");
  assert.deepEqual(result.perSide, [{ plate: 2.5, count: 1 }, { plate: 1.25, count: 1 }]);
  assert.equal(result.achievedWeight, 27.5);
  assert.equal(result.exact, true);
});

test("nearestAchievableWeight rounds to the nearest loadable increment", () => {
  assert.equal(nearestAchievableWeight(41, 20, "kg"), 40);
  assert.equal(nearestAchievableWeight(19, 20, "kg"), 20);
});

test("computeWarmupRamp produces an ascending ramp that stops before the working weight", () => {
  const ramp = computeWarmupRamp(100, 20, "kg");
  assert.deepEqual(ramp.map((step) => step.label), ["Bar", "40%", "60%", "80%", "90%"]);
  assert.deepEqual(ramp.map((step) => step.weight), [20, 40, 60, 80, 90]);
  for (const step of ramp) {
    assert.ok(step.weight < 100);
    assert.equal((step.weight - 20) % 2.5, 0);
  }
});

test("computeWarmupRamp deduplicates degenerate steps for a near-bar-weight target", () => {
  const ramp = computeWarmupRamp(22, 20, "kg");
  assert.deepEqual(ramp, [{ label: "Bar", weight: 20, reps: "8-10" }]);
});

test("computeWarmupRamp returns nothing for an invalid or zero target", () => {
  assert.deepEqual(computeWarmupRamp(0, 20, "kg"), []);
  assert.deepEqual(computeWarmupRamp(Number.NaN, 20, "kg"), []);
});
