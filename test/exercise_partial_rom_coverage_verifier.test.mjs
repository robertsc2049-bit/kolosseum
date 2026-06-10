import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluatePartialRomCoverage,
} from "../ci/scripts/run_exercise_partial_rom_coverage_verifier.mjs";

function buildRegistry() {
  return {
    registry_id: "exercise",
    version: "1.0.0",
    entries: {
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
        rom: "full",
      },
      box_squat: {
        exercise_id: "box_squat",
        pattern: "squat",
        rom: "partial",
      },
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
        rom: "full",
      },
      pin_press: {
        exercise_id: "pin_press",
        pattern: "horizontal_push",
        rom: "partial",
      },
      deadlift: {
        exercise_id: "deadlift",
        pattern: "hinge",
        rom: "full",
      },
      partial_deadlift: {
        exercise_id: "partial_deadlift",
        pattern: "hinge",
        rom: "partial",
      },
    },
  };
}

test("P74: passes when each major lift family has a partial ROM variant", () => {
  const result = evaluatePartialRomCoverage(buildRegistry());

  assert.equal(result.ok, true);
  assert.equal(result.validated_pattern_count, 3);
  assert.deepEqual(result.problems, []);
});

test("P74: fails when squat has no partial ROM variant", () => {
  const registry = buildRegistry();
  delete registry.entries.box_squat;

  const result = evaluatePartialRomCoverage(registry);

  assert.equal(result.ok, false);
  assert.equal(
    result.problems.some(
      (problem) =>
        problem.type === "missing_partial_rom_variant" &&
        problem.pattern === "squat",
    ),
    true,
  );
});

test("P74: fails when horizontal_push has no partial ROM variant", () => {
  const registry = buildRegistry();
  delete registry.entries.pin_press;

  const result = evaluatePartialRomCoverage(registry);

  assert.equal(result.ok, false);
  assert.equal(
    result.problems.some(
      (problem) =>
        problem.type === "missing_partial_rom_variant" &&
        problem.pattern === "horizontal_push",
    ),
    true,
  );
});

test("P74: fails when hinge has no partial ROM variant", () => {
  const registry = buildRegistry();
  delete registry.entries.partial_deadlift;

  const result = evaluatePartialRomCoverage(registry);

  assert.equal(result.ok, false);
  assert.equal(
    result.problems.some(
      (problem) =>
        problem.type === "missing_partial_rom_variant" &&
        problem.pattern === "hinge",
    ),
    true,
  );
});

test("P74: fails when an exercise is missing pattern", () => {
  const registry = buildRegistry();
  delete registry.entries.back_squat.pattern;

  const result = evaluatePartialRomCoverage(registry);

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "missing_pattern");
});