import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateJointStressCoverage,
} from "../ci/scripts/run_exercise_joint_stress_coverage_verifier.mjs";

function buildRegistry() {
  return {
    registry_id: "exercise",
    version: "1.0.0",
    entries: {
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
        joint_stress_tags: ["knee_high", "hip_high"],
      },
      goblet_squat: {
        exercise_id: "goblet_squat",
        pattern: "squat",
        joint_stress_tags: ["knee_low", "hip_low"],
      },
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
        joint_stress_tags: ["shoulder_medium"],
      },
      push_up: {
        exercise_id: "push_up",
        pattern: "horizontal_push",
        joint_stress_tags: ["shoulder_low"],
      },
      overhead_press: {
        exercise_id: "overhead_press",
        pattern: "vertical_push",
        joint_stress_tags: ["shoulder_medium"],
      },
      pike_push_up: {
        exercise_id: "pike_push_up",
        pattern: "vertical_push",
        joint_stress_tags: ["shoulder_low"],
      },
    },
  };
}

test("P73: passes when every lane has at least one low joint-stress option", () => {
  const result = evaluateJointStressCoverage(buildRegistry());

  assert.equal(result.ok, true);
  assert.equal(result.validated_lane_count, 3);
  assert.deepEqual(result.problems, []);
});

test("P73: fails when an exercise is missing joint_stress_tags", () => {
  const registry = buildRegistry();
  delete registry.entries.back_squat.joint_stress_tags;

  const result = evaluateJointStressCoverage(registry);

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "missing_joint_stress_tags");
});

test("P73: fails when joint_stress_tags contain an illegal severity", () => {
  const registry = buildRegistry();
  registry.entries.back_squat.joint_stress_tags = ["knee_extreme"];

  const result = evaluateJointStressCoverage(registry);

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "invalid_joint_stress_tags");
});

test("P73: fails when a lane has no low joint-stress option", () => {
  const registry = buildRegistry();
  registry.entries.push_up.joint_stress_tags = ["shoulder_medium"];

  const result = evaluateJointStressCoverage(registry);

  assert.equal(result.ok, false);
  assert.equal(
    result.problems.some(
      (problem) =>
        problem.type === "missing_low_joint_stress_option" &&
        problem.pattern === "horizontal_push",
    ),
    true,
  );
});

test("P73: fails when an exercise is missing pattern", () => {
  const registry = buildRegistry();
  delete registry.entries.back_squat.pattern;

  const result = evaluateJointStressCoverage(registry);

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "missing_pattern");
});