import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  REQUIRED_UNILATERAL_BY_PATTERN,
  verifyUnilateralCoverage,
} from "../ci/scripts/run_unilateral_coverage_verifier.mjs";

function makeTempRegistry(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p67-unilateral-coverage-"));
  const file = path.join(dir, "exercise.registry.json");

  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        registry_id: "exercise",
        version: "test",
        entries,
      },
      null,
      2
    )
  );

  return file;
}

function makePassingEntries() {
  return {
    bench_press: {
      exercise_id: "bench_press",
      pattern: "horizontal_push",
    },
    single_arm_dumbbell_press: {
      exercise_id: "single_arm_dumbbell_press",
      pattern: "horizontal_push",
    },
    overhead_press: {
      exercise_id: "overhead_press",
      pattern: "vertical_push",
    },
    single_arm_overhead_press: {
      exercise_id: "single_arm_overhead_press",
      pattern: "vertical_push",
    },
    back_squat: {
      exercise_id: "back_squat",
      pattern: "squat",
    },
    split_squat: {
      exercise_id: "split_squat",
      pattern: "squat",
    },
    deadlift: {
      exercise_id: "deadlift",
      pattern: "hinge",
    },
    single_leg_rdl: {
      exercise_id: "single_leg_rdl",
      pattern: "hinge",
    },
  };
}

test("P67: verifier passes when every valid lane has unilateral coverage", () => {
  const registryPath = makeTempRegistry(makePassingEntries());

  const result = verifyUnilateralCoverage({
    exerciseRegistryPath: registryPath,
  });

  assert.equal(result.ok, true);
  assert.equal(result.unilateral_pattern_count, 4);
  assert.deepEqual(result.required_unilateral_by_pattern, REQUIRED_UNILATERAL_BY_PATTERN);
  assert.deepEqual(
    { ...result.coverage_by_pattern },
    {
      horizontal_push: ["single_arm_dumbbell_press"],
      vertical_push: ["single_arm_overhead_press"],
      squat: ["split_squat"],
      hinge: ["single_leg_rdl"],
    }
  );
});

test("P67: verifier fails when squat unilateral coverage is removed", () => {
  const entries = makePassingEntries();
  delete entries.split_squat;

  const registryPath = makeTempRegistry(entries);

  assert.throws(
    () =>
      verifyUnilateralCoverage({
        exerciseRegistryPath: registryPath,
      }),
    /Required unilateral exercise 'split_squat' is missing/i
  );
});

test("P67: verifier fails when hinge unilateral coverage is remapped to wrong lane", () => {
  const entries = makePassingEntries();
  entries.single_leg_rdl = {
    exercise_id: "single_leg_rdl",
    pattern: "squat",
  };

  const registryPath = makeTempRegistry(entries);

  assert.throws(
    () =>
      verifyUnilateralCoverage({
        exerciseRegistryPath: registryPath,
      }),
    /must remain in pattern 'hinge'/i
  );
});

test("P67: verifier fails when unilateral exercise id is renamed", () => {
  const entries = makePassingEntries();
  entries.single_arm_overhead_press = {
    exercise_id: "single_arm_db_ohp",
    pattern: "vertical_push",
  };

  const registryPath = makeTempRegistry(entries);

  assert.throws(
    () =>
      verifyUnilateralCoverage({
        exerciseRegistryPath: registryPath,
      }),
    /mismatched exercise_id 'single_arm_db_ohp'/i
  );
});