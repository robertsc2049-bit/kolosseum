import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyWarmupLinkage } from "../ci/scripts/run_warmup_linkage_verifier.mjs";

function writeFixturePair(exercisePayload, warmupPayload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p79-warmup-"));
  const exercisePath = path.join(dir, "exercise.registry.json");
  const warmupPath = path.join(dir, "exercise_warmup_mapping.registry.json");

  fs.writeFileSync(exercisePath, JSON.stringify(exercisePayload, null, 2), "utf8");
  fs.writeFileSync(warmupPath, JSON.stringify(warmupPayload, null, 2), "utf8");

  return { exercisePath, warmupPath };
}

function buildExerciseFixture() {
  return {
    entries: {
      push_up: {
        exercise_id: "push_up",
        pattern: "horizontal_push"
      },
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push"
      },
      pike_push_up: {
        exercise_id: "pike_push_up",
        pattern: "vertical_push"
      },
      goblet_squat: {
        exercise_id: "goblet_squat",
        pattern: "squat"
      },
      kettlebell_deadlift: {
        exercise_id: "kettlebell_deadlift",
        pattern: "hinge"
      }
    }
  };
}

test("P79: passes when every lane has warm-up mapping", () => {
  const fixtures = writeFixturePair(
    buildExerciseFixture(),
    {
      entries: {
        horizontal_push: {
          lane: "horizontal_push",
          warm_up_ids: ["push_up"]
        },
        vertical_push: {
          lane: "vertical_push",
          warm_up_ids: ["pike_push_up"]
        },
        squat: {
          lane: "squat",
          warm_up_ids: ["goblet_squat"]
        },
        hinge: {
          lane: "hinge",
          warm_up_ids: ["kettlebell_deadlift"]
        }
      }
    }
  );

  const result = verifyWarmupLinkage(fixtures.exercisePath, fixtures.warmupPath);

  assert.equal(result.ok, true);
  assert.equal(result.lane_count, 4);
  assert.deepEqual(result.failures, []);
});

test("P79: fails when lane mapping is missing", () => {
  const fixtures = writeFixturePair(
    buildExerciseFixture(),
    {
      entries: {
        horizontal_push: {
          lane: "horizontal_push",
          warm_up_ids: ["push_up"]
        },
        vertical_push: {
          lane: "vertical_push",
          warm_up_ids: ["pike_push_up"]
        },
        squat: {
          lane: "squat",
          warm_up_ids: ["goblet_squat"]
        }
      }
    }
  );

  const result = verifyWarmupLinkage(fixtures.exercisePath, fixtures.warmupPath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.some((failure) => failure.code === "warmup_mapping_missing"), true);
});

test("P79: fails when warm-up mapping is empty", () => {
  const fixtures = writeFixturePair(
    buildExerciseFixture(),
    {
      entries: {
        horizontal_push: {
          lane: "horizontal_push",
          warm_up_ids: []
        },
        vertical_push: {
          lane: "vertical_push",
          warm_up_ids: ["pike_push_up"]
        },
        squat: {
          lane: "squat",
          warm_up_ids: ["goblet_squat"]
        },
        hinge: {
          lane: "hinge",
          warm_up_ids: ["kettlebell_deadlift"]
        }
      }
    }
  );

  const result = verifyWarmupLinkage(fixtures.exercisePath, fixtures.warmupPath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.some((failure) => failure.code === "warmup_mapping_empty"), true);
});

test("P79: fails when warm-up id is invalid", () => {
  const fixtures = writeFixturePair(
    buildExerciseFixture(),
    {
      entries: {
        horizontal_push: {
          lane: "horizontal_push",
          warm_up_ids: ["not_real"]
        },
        vertical_push: {
          lane: "vertical_push",
          warm_up_ids: ["pike_push_up"]
        },
        squat: {
          lane: "squat",
          warm_up_ids: ["goblet_squat"]
        },
        hinge: {
          lane: "hinge",
          warm_up_ids: ["kettlebell_deadlift"]
        }
      }
    }
  );

  const result = verifyWarmupLinkage(fixtures.exercisePath, fixtures.warmupPath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.some((failure) => failure.code === "warmup_invalid_ids"), true);
});

test("P79: fails when warm-up ids are duplicated", () => {
  const fixtures = writeFixturePair(
    buildExerciseFixture(),
    {
      entries: {
        horizontal_push: {
          lane: "horizontal_push",
          warm_up_ids: ["push_up", "push_up"]
        },
        vertical_push: {
          lane: "vertical_push",
          warm_up_ids: ["pike_push_up"]
        },
        squat: {
          lane: "squat",
          warm_up_ids: ["goblet_squat"]
        },
        hinge: {
          lane: "hinge",
          warm_up_ids: ["kettlebell_deadlift"]
        }
      }
    }
  );

  const result = verifyWarmupLinkage(fixtures.exercisePath, fixtures.warmupPath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.some((failure) => failure.code === "warmup_duplicate_ids"), true);
});