import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyExerciseLaneCoverage } from "../ci/scripts/run_exercise_lane_coverage_verifier.mjs";

function makeTempRegistries({ movementEntries, exerciseEntries }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p60-lane-coverage-"));

  const movementRegistryPath = path.join(dir, "movement.registry.json");
  const exerciseRegistryPath = path.join(dir, "exercise.registry.json");

  fs.writeFileSync(
    movementRegistryPath,
    JSON.stringify(
      {
        registry_id: "movement",
        version: "test",
        entries: movementEntries,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    exerciseRegistryPath,
    JSON.stringify(
      {
        registry_id: "exercise",
        version: "test",
        entries: exerciseEntries,
      },
      null,
      2
    )
  );

  return {
    movementRegistryPath,
    exerciseRegistryPath,
  };
}

test("P60: verifier passes when every movement lane has at least one exercise", () => {
  const { movementRegistryPath, exerciseRegistryPath } = makeTempRegistries({
    movementEntries: {
      horizontal_push: { movement_id: "horizontal_push" },
      vertical_push: { movement_id: "vertical_push" },
      squat: { movement_id: "squat" },
      hinge: { movement_id: "hinge" },
    },
    exerciseEntries: {
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
      },
      overhead_press: {
        exercise_id: "overhead_press",
        pattern: "vertical_push",
      },
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
      },
      deadlift: {
        exercise_id: "deadlift",
        pattern: "hinge",
      },
    },
  });

  const result = verifyExerciseLaneCoverage({
    movementRegistryPath,
    exerciseRegistryPath,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.required_movement_ids, [
    "horizontal_push",
    "vertical_push",
    "squat",
    "hinge",
  ]);
  assert.deepEqual(
    { ...result.coverage_by_movement },
    {
      horizontal_push: 1,
      vertical_push: 1,
      squat: 1,
      hinge: 1,
    }
  );
});

test("P60: verifier fails when a movement lane has zero exercises", () => {
  const { movementRegistryPath, exerciseRegistryPath } = makeTempRegistries({
    movementEntries: {
      horizontal_push: { movement_id: "horizontal_push" },
      vertical_push: { movement_id: "vertical_push" },
      squat: { movement_id: "squat" },
      hinge: { movement_id: "hinge" },
    },
    exerciseEntries: {
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
      },
      overhead_press: {
        exercise_id: "overhead_press",
        pattern: "vertical_push",
      },
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
      },
    },
  });

  assert.throws(
    () =>
      verifyExerciseLaneCoverage({
        movementRegistryPath,
        exerciseRegistryPath,
      }),
    /Movement lane 'hinge' must have at least one exercise\./i
  );
});

test("P60: verifier fails when an exercise references an unknown movement lane", () => {
  const { movementRegistryPath, exerciseRegistryPath } = makeTempRegistries({
    movementEntries: {
      horizontal_push: { movement_id: "horizontal_push" },
      vertical_push: { movement_id: "vertical_push" },
      squat: { movement_id: "squat" },
      hinge: { movement_id: "hinge" },
    },
    exerciseEntries: {
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
      },
      strange_press: {
        exercise_id: "strange_press",
        pattern: "diagonal_push",
      },
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
      },
      deadlift: {
        exercise_id: "deadlift",
        pattern: "hinge",
      },
    },
  });

  assert.throws(
    () =>
      verifyExerciseLaneCoverage({
        movementRegistryPath,
        exerciseRegistryPath,
      }),
    /unknown movement lane 'diagonal_push'/i
  );
});

test("P60: verifier fails when an exercise is missing pattern", () => {
  const { movementRegistryPath, exerciseRegistryPath } = makeTempRegistries({
    movementEntries: {
      horizontal_push: { movement_id: "horizontal_push" },
    },
    exerciseEntries: {
      bench_press: {
        exercise_id: "bench_press",
      },
    },
  });

  assert.throws(
    () =>
      verifyExerciseLaneCoverage({
        movementRegistryPath,
        exerciseRegistryPath,
      }),
    /missing required field 'pattern'/i
  );
});