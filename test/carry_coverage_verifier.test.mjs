import test from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_CARRY_EXERCISE_IDS,
  evaluateCarryCoverage,
} from "../ci/scripts/run_carry_coverage_verifier.mjs";

function buildMovementRegistry() {
  return {
    registry_id: "movement",
    version: "1.0.0",
    entries: {
      carry: {
        movement_id: "carry",
        equipment_vocab: ["bodyweight", "dumbbell", "kettlebell", "trap_bar", "sandbag", "yoke", "plate"],
        joint_stress_tags_vocab: ["neutral", "shoulder", "grip", "lumbar_low", "thoracic_low", "hip"],
      },
    },
  };
}

function buildExercise(exercise_id, equipment, equipment_tags, jointStressTags = ["grip", "shoulder"]) {
  return {
    exercise_id,
    pattern: "carry",
    stimulus_intent: "strength",
    rom: "partial",
    stability: "stable",
    equipment,
    equipment_tags,
    equipment_tier: "TIER_2",
    difficulty_tier: "intermediate",
    joint_stress_tags: jointStressTags,
  };
}

function buildExerciseRegistry() {
  return {
    registry_id: "exercise",
    version: "1.0.0",
    entries: {
      farmers_carry: buildExercise("farmers_carry", ["dumbbell"], ["dumbbell"]),
      sandbag_carry: buildExercise("sandbag_carry", ["sandbag"], ["strongman"], ["grip", "thoracic_low"]),
      yoke_carry: buildExercise("yoke_carry", ["yoke"], ["strongman"], ["shoulder", "lumbar_low"]),
    },
  };
}

test("P69b: passes when carry exists and has three required exercise ids", () => {
  const result = evaluateCarryCoverage(buildMovementRegistry(), buildExerciseRegistry());

  assert.equal(result.ok, true);
  assert.equal(result.carry_movement_present, true);
  assert.equal(result.carry_exercise_count, 3);
  assert.deepEqual(result.missing_required_exercise_ids, []);
  assert.deepEqual(result.required_carry_exercise_ids, REQUIRED_CARRY_EXERCISE_IDS);
});

test("P69b: fails when carry movement is missing", () => {
  const movementRegistry = {
    registry_id: "movement",
    version: "1.0.0",
    entries: {},
  };

  const result = evaluateCarryCoverage(movementRegistry, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.equal(result.carry_movement_present, false);
});

test("P69b: fails when fewer than three carry exercises exist", () => {
  const exerciseRegistry = buildExerciseRegistry();
  delete exerciseRegistry.entries.yoke_carry;

  const result = evaluateCarryCoverage(buildMovementRegistry(), exerciseRegistry);

  assert.equal(result.ok, false);
  assert.equal(result.carry_exercise_count, 2);
  assert.deepEqual(result.missing_required_exercise_ids, ["yoke_carry"]);
});

test("P69b: fails when one required carry exercise id is missing even if count stays at three", () => {
  const exerciseRegistry = buildExerciseRegistry();
  delete exerciseRegistry.entries.yoke_carry;
  exerciseRegistry.entries.suitcase_carry = buildExercise("suitcase_carry", ["dumbbell"], ["dumbbell"]);

  const result = evaluateCarryCoverage(buildMovementRegistry(), exerciseRegistry);

  assert.equal(result.ok, false);
  assert.equal(result.carry_exercise_count, 3);
  assert.deepEqual(result.missing_required_exercise_ids, ["yoke_carry"]);
});