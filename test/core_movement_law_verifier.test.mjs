import test from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_CORE_MOVEMENT_IDS,
  evaluateCoreMovementLaw,
} from "../ci/scripts/run_core_movement_law_verifier.mjs";

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

test("P70a: passes when all required core movements exist with required vocab", () => {
  const result = evaluateCoreMovementLaw(buildMovementRegistry());

  assert.equal(result.ok, true);
  assert.deepEqual(result.required_core_movement_ids, REQUIRED_CORE_MOVEMENT_IDS);
  assert.deepEqual(result.missing_movements, []);
  assert.deepEqual(result.invalid_movements, []);
});

test("P70a: fails when a required core movement is missing", () => {
  const registry = buildMovementRegistry();
  delete registry.entries.rotational_work;

  const result = evaluateCoreMovementLaw(registry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing_movements, ["rotational_work"]);
});

test("P70a: fails when required equipment vocab is incomplete", () => {
  const registry = buildMovementRegistry();
  registry.entries.anti_rotation.equipment_vocab = ["bodyweight", "plate"];

  const result = evaluateCoreMovementLaw(registry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.invalid_movements, ["anti_rotation"]);
});

test("P70a: fails when required joint stress vocab is incomplete", () => {
  const registry = buildMovementRegistry();
  registry.entries.loaded_flexion.joint_stress_tags_vocab = ["neutral", "thoracic_low"];

  const result = evaluateCoreMovementLaw(registry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.invalid_movements, ["loaded_flexion"]);
});