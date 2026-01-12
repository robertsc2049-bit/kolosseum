import test from "node:test";
import assert from "node:assert/strict";

import { pickBestSubstitute } from "../dist/engine/src/substitution/score.js";

const target = {
  exercise_id: "bench_press",
  pattern: "horizontal_push",
  stimulus_intent: "strength",
  rom: "full",
  stability: "stable",
  equipment: ["barbell", "bench", "rack"],
  equipment_tier: "TIER_1",
  joint_stress_tags: ["shoulder_high"]
};

const candidates = [
  {
    exercise_id: "dumbbell_bench_press",
    pattern: "horizontal_push",
    stimulus_intent: "strength",
    rom: "full",
    stability: "semi_stable",
    equipment: ["dumbbells", "bench"],
    equipment_tier: "TIER_2",
    joint_stress_tags: ["shoulder_medium"]
  },
  {
    exercise_id: "push_up",
    pattern: "horizontal_push",
    stimulus_intent: "strength",
    rom: "full",
    stability: "semi_stable",
    equipment: ["bodyweight"],
    equipment_tier: "TIER_4",
    joint_stress_tags: ["shoulder_medium"]
  },
  {
    exercise_id: "incline_bench_press",
    pattern: "horizontal_push",
    stimulus_intent: "strength",
    rom: "full",
    stability: "stable",
    equipment: ["barbell", "bench", "rack"],
    equipment_tier: "TIER_1",
    joint_stress_tags: ["shoulder_high"]
  },
  {
    exercise_id: "cable_chest_press",
    pattern: "horizontal_push",
    stimulus_intent: "hypertrophy",
    rom: "full",
    stability: "stable",
    equipment: ["cable"],
    equipment_tier: "TIER_3",
    joint_stress_tags: ["shoulder_low"]
  }
];

test("Substitution prefers matching stimulus + pattern over everything else", () => {
  const pick = pickBestSubstitute(target, candidates, {});
  assert.ok(pick);
  // incline matches perfectly but is same stress profile; still best without constraints
  assert.equal(pick.selected_exercise_id, "incline_bench_press");
});

test("Safety: avoid_joint_stress_tags disqualifies candidates", () => {
  const pick = pickBestSubstitute(target, candidates, { avoid_joint_stress_tags: ["shoulder_high"] });
  assert.ok(pick);
  // incline is disqualified; dumbbell is best remaining strength+pattern
  assert.equal(pick.selected_exercise_id, "dumbbell_bench_press");
});

test("Banned equipment disqualifies candidates deterministically", () => {
  const pick = pickBestSubstitute(target, candidates, { banned_equipment: ["barbell"] });
  assert.ok(pick);
  assert.equal(pick.selected_exercise_id, "dumbbell_bench_press");
});
