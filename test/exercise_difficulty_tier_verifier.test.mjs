import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyExerciseDifficultyTierLayer } from "../ci/scripts/run_exercise_difficulty_tier_verifier.mjs";

function makeTempRegistry(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p65-difficulty-tier-"));
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

test("P65: verifier passes when every exercise declares lawful difficulty tier", () => {
  const registryPath = makeTempRegistry({
    push_up: {
      exercise_id: "push_up",
      difficulty_tier: "beginner",
    },
    bench_press: {
      exercise_id: "bench_press",
      difficulty_tier: "intermediate",
    },
    deadlift: {
      exercise_id: "deadlift",
      difficulty_tier: "advanced",
    }
  });

  const result = verifyExerciseDifficultyTierLayer({ registryPath });

  assert.equal(result.ok, true);
  assert.equal(result.entry_count, 3);
});

test("P65: verifier fails when an exercise is missing difficulty_tier", () => {
  const registryPath = makeTempRegistry({
    back_squat: {
      exercise_id: "back_squat"
    }
  });

  assert.throws(
    () => verifyExerciseDifficultyTierLayer({ registryPath }),
    /missing required field 'difficulty_tier'/i
  );
});

test("P65: verifier fails on empty difficulty_tier", () => {
  const registryPath = makeTempRegistry({
    back_squat: {
      exercise_id: "back_squat",
      difficulty_tier: ""
    }
  });

  assert.throws(
    () => verifyExerciseDifficultyTierLayer({ registryPath }),
    /difficulty_tier' must be a non-empty string/i
  );
});

test("P65: verifier fails on illegal difficulty_tier", () => {
  const registryPath = makeTempRegistry({
    back_squat: {
      exercise_id: "back_squat",
      difficulty_tier: "elite"
    }
  });

  assert.throws(
    () => verifyExerciseDifficultyTierLayer({ registryPath }),
    /illegal difficulty tier 'elite'/i
  );
});