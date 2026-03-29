import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  LOCKED_CORE_COMPOUND_SET,
  verifyCanonicalCompoundSetLock,
} from "../ci/scripts/run_canonical_compound_set_lock_verifier.mjs";

function makeTempRegistry(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p62-compound-set-lock-"));
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
    push_up: {
      exercise_id: "push_up",
      pattern: "horizontal_push",
    },
    goblet_squat: {
      exercise_id: "goblet_squat",
      pattern: "squat",
    },
  };
}

test("P62: verifier passes when locked canonical compound lifts are present", () => {
  const registryPath = makeTempRegistry(makePassingEntries());

  const result = verifyCanonicalCompoundSetLock({
    exerciseRegistryPath: registryPath,
  });

  assert.equal(result.ok, true);
  assert.equal(result.locked_pattern_count, 4);
  assert.equal(result.locked_exercise_count, 4);
  assert.deepEqual(result.locked_core_compound_set, LOCKED_CORE_COMPOUND_SET);
  assert.deepEqual(
    result.verified.map((x) => `${x.pattern}:${x.exercise_id}`),
    [
      "squat:back_squat",
      "hinge:deadlift",
      "horizontal_push:bench_press",
      "vertical_push:overhead_press",
    ]
  );
});

test("P62: verifier fails when a locked squat lift is removed", () => {
  const entries = makePassingEntries();
  delete entries.back_squat;

  const registryPath = makeTempRegistry(entries);

  assert.throws(
    () =>
      verifyCanonicalCompoundSetLock({
        exerciseRegistryPath: registryPath,
      }),
    /Locked core lift 'back_squat' is missing/i
  );
});

test("P62: verifier fails when a locked hinge lift changes pattern", () => {
  const entries = makePassingEntries();
  entries.deadlift = {
    exercise_id: "deadlift",
    pattern: "squat",
  };

  const registryPath = makeTempRegistry(entries);

  assert.throws(
    () =>
      verifyCanonicalCompoundSetLock({
        exerciseRegistryPath: registryPath,
      }),
    /must remain in pattern 'hinge'/i
  );
});

test("P62: verifier fails when a locked push lift is renamed", () => {
  const entries = makePassingEntries();
  entries.bench_press = {
    exercise_id: "barbell_bench_press",
    pattern: "horizontal_push",
  };

  const registryPath = makeTempRegistry(entries);

  assert.throws(
    () =>
      verifyCanonicalCompoundSetLock({
        exerciseRegistryPath: registryPath,
      }),
    /mismatched exercise_id 'barbell_bench_press'/i
  );
});