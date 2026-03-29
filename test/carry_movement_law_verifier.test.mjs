import test from "node:test";
import assert from "node:assert/strict";

import { evaluateCarryMovementLaw } from "../ci/scripts/run_carry_movement_law_verifier.mjs";

function buildMovementRegistry() {
  return {
    registry_id: "movement",
    version: "1.0.0",
    entries: {
      carry: {
        movement_id: "carry",
        equipment_vocab: [
          "bodyweight",
          "dumbbell",
          "kettlebell",
          "trap_bar",
          "sandbag",
          "yoke",
          "plate"
        ],
        joint_stress_tags_vocab: [
          "neutral",
          "shoulder",
          "grip",
          "lumbar_low",
          "thoracic_low",
          "hip"
        ]
      }
    }
  };
}

test("P69a: passes when carry movement exists with required vocab", () => {
  const result = evaluateCarryMovementLaw(buildMovementRegistry());

  assert.equal(result.ok, true);
  assert.equal(result.carry_present, true);
  assert.deepEqual(result.missing_equipment_tokens, []);
  assert.deepEqual(result.missing_joint_stress_tokens, []);
});

test("P69a: fails when carry movement is missing", () => {
  const registry = {
    registry_id: "movement",
    version: "1.0.0",
    entries: {}
  };

  const result = evaluateCarryMovementLaw(registry);

  assert.equal(result.ok, false);
  assert.equal(result.carry_present, false);
});

test("P69a: fails when required equipment vocab is missing", () => {
  const registry = buildMovementRegistry();
  registry.entries.carry.equipment_vocab = ["dumbbell", "kettlebell", "trap_bar"];

  const result = evaluateCarryMovementLaw(registry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing_equipment_tokens, ["sandbag", "yoke", "plate"]);
});

test("P69a: fails when required joint stress vocab is missing", () => {
  const registry = buildMovementRegistry();
  registry.entries.carry.joint_stress_tags_vocab = ["neutral", "shoulder"];

  const result = evaluateCarryMovementLaw(registry);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing_joint_stress_tokens, ["grip", "lumbar_low", "thoracic_low", "hip"]);
});