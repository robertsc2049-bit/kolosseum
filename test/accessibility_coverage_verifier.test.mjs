import test from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_ACCESSIBLE_PATTERNS,
  evaluateAccessibilityCoverage,
  isAccessibleExercise,
} from "../ci/scripts/run_accessibility_coverage_verifier.mjs";

function buildExercise(overrides = {}) {
  return {
    exercise_id: "example_exercise",
    pattern: "squat",
    stimulus_intent: "strength",
    rom: "full",
    stability: "stable",
    equipment: ["machine"],
    equipment_tags: ["machine"],
    equipment_tier: "TIER_2",
    difficulty_tier: "beginner",
    joint_stress_tags: [],
    ...overrides,
  };
}

function buildRegistryForAllRequiredPatterns() {
  const entries = {};

  for (const pattern of REQUIRED_ACCESSIBLE_PATTERNS) {
    entries[`accessible_${pattern}`] = buildExercise({
      exercise_id: `accessible_${pattern}`,
      pattern,
    });
  }

  return {
    registry_id: "exercise",
    version: "1.0.0",
    entries,
  };
}

test("P68: accessible exercise requires beginner difficulty plus stable/semi_stable plus machine-like equipment", () => {
  assert.equal(
    isAccessibleExercise(
      buildExercise({
        stability: "stable",
        difficulty_tier: "beginner",
        equipment: ["machine"],
        equipment_tags: ["machine"],
      }),
    ),
    true,
  );

  assert.equal(
    isAccessibleExercise(
      buildExercise({
        difficulty_tier: "intermediate",
        equipment: ["machine"],
        equipment_tags: ["machine"],
      }),
    ),
    false,
  );

  assert.equal(
    isAccessibleExercise(
      buildExercise({
        difficulty_tier: "beginner",
        stability: "unstable",
        equipment: ["machine"],
        equipment_tags: ["machine"],
      }),
    ),
    false,
  );

  assert.equal(
    isAccessibleExercise(
      buildExercise({
        difficulty_tier: "beginner",
        stability: "stable",
        equipment: ["barbell", "rack"],
        equipment_tags: ["barbell"],
      }),
    ),
    false,
  );
});

test("P68: passes when every canonical major pattern has at least one machine / accessible option", () => {
  const registry = buildRegistryForAllRequiredPatterns();

  const result = evaluateAccessibilityCoverage(registry);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing_patterns, []);
});

test("P68: fails when one required pattern is missing machine / accessible coverage", () => {
  const registry = buildRegistryForAllRequiredPatterns();
  delete registry.entries.accessible_hinge;

  const result = evaluateAccessibilityCoverage(registry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing_patterns, ["hinge"]);
});

test("P68: fails when a pattern exists but only high-skill or non-machine variants are present", () => {
  const registry = buildRegistryForAllRequiredPatterns();

  registry.entries.accessible_vertical_push = buildExercise({
    exercise_id: "hard_vertical_push",
    pattern: "vertical_push",
    difficulty_tier: "advanced",
    equipment: ["barbell"],
    equipment_tags: ["barbell"],
    stability: "unstable",
  });

  const result = evaluateAccessibilityCoverage(registry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing_patterns, ["vertical_push"]);
});