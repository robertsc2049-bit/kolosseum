import test from "node:test";
import assert from "node:assert/strict";

import { phase5ApplySubstitutionAndAdjustment } from "../dist/engine/src/phases/phase5.js";

test("Phase 5 applies substitution when program has substitutable shape", () => {
  const program = {
    exercises: [
      {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
        stimulus_intent: "strength",
        rom: "full",
        stability: "stable",
        equipment: ["barbell", "bench", "rack"],
        equipment_tier: "TIER_1",
        joint_stress_tags: ["shoulder_high"]
      },
      {
        exercise_id: "dumbbell_bench_press",
        pattern: "horizontal_push",
        stimulus_intent: "strength",
        rom: "full",
        stability: "semi_stable",
        equipment: ["dumbbells", "bench"],
        equipment_tier: "TIER_2",
        joint_stress_tags: ["shoulder_medium"]
      }
    ],
    target_exercise_id: "bench_press",
    constraints: { avoid_joint_stress_tags: ["shoulder_high"] }
  };

  const res = phase5ApplySubstitutionAndAdjustment(program, {});
  assert.equal(res.ok, true);
  assert.equal(res.adjustments.length, 1);
  assert.equal(res.adjustments[0].adjustment_id, "SUBSTITUTE_EXERCISE");
  assert.equal(res.adjustments[0].applied, true);
  assert.equal(res.adjustments[0].details.substitute_exercise_id, "dumbbell_bench_press");
});

test("Phase 5 remains no-op for non-substitutable program shape (v0 stub safety)", () => {
  const res = phase5ApplySubstitutionAndAdjustment({ blocks: [] }, {});
  assert.equal(res.ok, true);
  assert.deepEqual(res.adjustments, []);
});
