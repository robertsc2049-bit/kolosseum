// DEV NOTE: pure logic, no JSX - named .tsx (not .ts) so it's picked up by
// npm run test:react's `public/app-src/__tests__/*.test.tsx` glob. A
// colocated utils/*.test.ts file would not run under any existing script.
import assert from "node:assert/strict";
import test from "node:test";

import {
  FULL_PLATE_SET_BY_UNIT,
  computePlateBreakdown,
  computeWarmupRamp,
  defaultAvailablePlates,
  nearestAchievableWeight,
  plateVisual
} from "../utils/plateCalculator";

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

test("computePlateBreakdown treats weighted collars as a fixed floor subtracted before splitting the remaining weight across plates", () => {
  const withoutCollars = computePlateBreakdown(100, 20, "kg");
  assert.equal(withoutCollars.collarWeight, 0);

  const withCollars = computePlateBreakdown(100, 20, "kg", { useCollars: true });
  assert.equal(withCollars.collarWeight, 5);
  assert.deepEqual(withCollars.perSide, [{ plate: 25, count: 1 }, { plate: 10, count: 1 }, { plate: 2.5, count: 1 }]);
  assert.equal(withCollars.achievedWeight, 100);
  assert.equal(withCollars.exact, true);
});

test("computePlateBreakdown only reaches for fractional (micro) plates when they're added to availablePlates, achieving an otherwise-unreachable exact target", () => {
  const withoutFractional = computePlateBreakdown(100.5, 20, "kg", { availablePlates: defaultAvailablePlates("kg") });
  assert.equal(withoutFractional.achievedWeight, 100);
  assert.equal(withoutFractional.exact, false);

  const withFractional = computePlateBreakdown(100.5, 20, "kg", {
    availablePlates: new Set([...defaultAvailablePlates("kg"), 0.25])
  });
  assert.ok(withFractional.perSide.some((pair) => pair.plate === 0.25));
  assert.equal(withFractional.achievedWeight, 100.5);
  assert.equal(withFractional.exact, true);
});

// DEV NOTE: ported from kolosseum.tools/ironclock - not every gym has
// every plate (25kg included), so every denomination is individually
// opt-out-able via availablePlates, not just the fractional ones.
test("computePlateBreakdown skips a plate the gym doesn't have, even a large/standard one like 25kg", () => {
  const without25 = computePlateBreakdown(100, 20, "kg", {
    availablePlates: new Set(Array.from(defaultAvailablePlates("kg")).filter((plate) => plate !== 25))
  });
  assert.ok(!without25.perSide.some((pair) => pair.plate === 25));
  assert.deepEqual(without25.perSide, [{ plate: 20, count: 2 }]);
  assert.equal(without25.achievedWeight, 100);
  assert.equal(without25.exact, true);
});

test("computePlateBreakdown falls back to the standard set when no availablePlates option is given", () => {
  const result = computePlateBreakdown(100, 20, "kg");
  assert.deepEqual(result.perSide, [{ plate: 25, count: 1 }, { plate: 15, count: 1 }]);
});

test("defaultAvailablePlates matches the standard plate set, fractional plates excluded", () => {
  assert.deepEqual(new Set(FULL_PLATE_SET_BY_UNIT.kg.slice(0, 7)), defaultAvailablePlates("kg"));
  assert.equal(defaultAvailablePlates("kg").has(0.25), false);
  assert.equal(defaultAvailablePlates("lb").has(0.5), false);
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
  assert.equal(nearestAchievableWeight(41, 20, defaultAvailablePlates("kg")), 40);
  assert.equal(nearestAchievableWeight(19, 20, defaultAvailablePlates("kg")), 20);
});

test("nearestAchievableWeight rounds to a finer increment once a fractional plate is available", () => {
  assert.equal(nearestAchievableWeight(21, 20, defaultAvailablePlates("kg")), 20, "the standard 1.25kg-per-side increment (2.5kg) rounds 21 down to the bar");
  assert.equal(nearestAchievableWeight(21, 20, new Set([...defaultAvailablePlates("kg"), 0.25])), 21, "the fractional 0.25kg-per-side increment (0.5kg) can reach 21 exactly");
});

test("nearestAchievableWeight falls back to a 2.5 increment when nothing is available, matching ironclock's own stepKg fallback", () => {
  assert.equal(nearestAchievableWeight(23, 20, new Set()), 22.5);
});

test("computeWarmupRamp produces an ascending ramp that stops before the working weight", () => {
  const ramp = computeWarmupRamp(100, 20, defaultAvailablePlates("kg"));
  assert.deepEqual(ramp.map((step) => step.label), ["Bar", "40%", "60%", "80%", "90%"]);
  assert.deepEqual(ramp.map((step) => step.weight), [20, 40, 60, 80, 90]);
  for (const step of ramp) {
    assert.ok(step.weight < 100);
    assert.equal((step.weight - 20) % 2.5, 0);
  }
});

test("computeWarmupRamp deduplicates degenerate steps for a near-bar-weight target", () => {
  const ramp = computeWarmupRamp(22, 20, defaultAvailablePlates("kg"));
  assert.deepEqual(ramp, [{ label: "Bar", weight: 20, reps: "8-10" }]);
});

test("computeWarmupRamp returns nothing for an invalid or zero target", () => {
  assert.deepEqual(computeWarmupRamp(0, 20, defaultAvailablePlates("kg")), []);
  assert.deepEqual(computeWarmupRamp(Number.NaN, 20, defaultAvailablePlates("kg")), []);
});

test("plateVisual returns a distinct, larger spec for heavier plates within each unit", () => {
  const kg25 = plateVisual(25, "kg");
  const kg1_25 = plateVisual(1.25, "kg");
  assert.ok(kg25.height > kg1_25.height);
  assert.ok(kg25.width > kg1_25.width);
  assert.notEqual(kg25.gradientId, kg1_25.gradientId);

  const lb45 = plateVisual(45, "lb");
  const lb2_5 = plateVisual(2.5, "lb");
  assert.ok(lb45.height > lb2_5.height);
  assert.ok(lb45.width > lb2_5.width);
});

test("plateVisual assigns the same rank (size/color) to a kg and lb plate at the same position in their respective sets, since lb has no independent color standard of its own", () => {
  assert.deepEqual(plateVisual(25, "kg"), plateVisual(45, "lb"));
  assert.deepEqual(plateVisual(20, "kg"), plateVisual(35, "lb"));
});

test("plateVisual falls back to the smallest/lightest spec for a plate size outside the known set", () => {
  const fallback = plateVisual(999, "kg");
  assert.ok(fallback.height > 0);
  assert.ok(fallback.width > 0);
  assert.ok(fallback.gradientId);
});
