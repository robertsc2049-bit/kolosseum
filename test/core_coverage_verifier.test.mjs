import test from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_CORE_MOVEMENTS,
  REQUIRED_CORE_EXERCISE_IDS,
  evaluateCoreCoverage,
} from "../ci/scripts/run_core_coverage_verifier.mjs";

function buildMovementRegistry() {
  return {
    registry_id: "movement",
    version: "1.0.0",
    entries: {
      anti_rotation: {
        movement_id: "anti_rotation",
        equipment_vocab: ["bodyweight", "cable", "plate"],
        joint_stress_tags_vocab: ["neutral", "thoracic_low", "lumbar_low"],
      },
      loaded_flexion: {
        movement_id: "loaded_flexion",
        equipment_vocab: ["bodyweight", "cable", "plate"],
        joint_stress_tags_vocab: ["neutral", "thoracic_low", "lumbar_low"],
      },
      rotational_work: {
        movement_id: "rotational_work",
        equipment_vocab: ["bodyweight", "cable", "plate"],
        joint_stress_tags_vocab: ["neutral", "thoracic_low", "lumbar_low"],
      },
    },
  };
}

function buildExercise(exercise_id, pattern, equipment, equipment_tags, jointStressTags) {
  return {
    exercise_id,
    pattern,
    stimulus_intent: "strength",
    rom: "partial",
    stability: "stable",
    equipment,
    equipment_tags,
    equipment_tier: "TIER_3",
    difficulty_tier: "intermediate",
    joint_stress_tags: jointStressTags,
  };
}

function buildExerciseRegistry() {
  return {
    registry_id: "exercise",
    version: "1.0.0",
    entries: {
      pallof_press: buildExercise(
        "pallof_press",
        "anti_rotation",
        ["cable"],
        ["bodyweight"],
        ["thoracic_low", "lumbar_low"]
      ),
      cable_crunch: buildExercise(
        "cable_crunch",
        "loaded_flexion",
        ["cable"],
        ["bodyweight"],
        ["thoracic_low", "lumbar_low"]
      ),
      cable_woodchop: buildExercise(
        "cable_woodchop",
        "rotational_work",
        ["cable"],
        ["bodyweight"],
        ["thoracic_low", "lumbar_low"]
      ),
    },
  };
}

test("P70b: passes when all required core movements have required exercise ids", () => {
  const result = evaluateCoreCoverage(buildMovementRegistry(), buildExerciseRegistry());

  assert.equal(result.ok, true);
  assert.deepEqual(result.required_core_movements, REQUIRED_CORE_MOVEMENTS);
  assert.deepEqual(result.required_core_exercise_ids, REQUIRED_CORE_EXERCISE_IDS);
  assert.deepEqual(result.missing_movements, []);
  assert.deepEqual(result.missing_required_exercise_ids, {
    anti_rotation: [],
    loaded_flexion: [],
    rotational_work: [],
  });
});

test("P70b: fails when a required movement is missing", () => {
  const movementRegistry = buildMovementRegistry();
  delete movementRegistry.entries.rotational_work;

  const result = evaluateCoreCoverage(movementRegistry, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing_movements, ["rotational_work"]);
});

test("P70b: fails when a required exercise id is missing", () => {
  const exerciseRegistry = buildExerciseRegistry();
  delete exerciseRegistry.entries.cable_crunch;

  const result = evaluateCoreCoverage(buildMovementRegistry(), exerciseRegistry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing_required_exercise_ids.loaded_flexion, ["cable_crunch"]);
});

test("P70b: fails when a movement has an exercise but not the required canonical id", () => {
  const exerciseRegistry = buildExerciseRegistry();
  delete exerciseRegistry.entries.pallof_press;
  exerciseRegistry.entries.band_press_hold = buildExercise(
    "band_press_hold",
    "anti_rotation",
    ["bodyweight"],
    ["bodyweight"],
    ["thoracic_low", "lumbar_low"]
  );

  const result = evaluateCoreCoverage(buildMovementRegistry(), exerciseRegistry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing_required_exercise_ids.anti_rotation, ["pallof_press"]);
});