import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyTimeBoxCoverage } from "../ci/scripts/run_time_box_coverage_verifier.mjs";

function writeFixture(payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p78-timebox-"));
  const filePath = path.join(dir, "exercise.registry.json");
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

test("P78: passes when every lane has at least one fast option", () => {
  const fixturePath = writeFixture({
    entries: {
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
        fast_execution: false
      },
      push_up: {
        exercise_id: "push_up",
        pattern: "horizontal_push",
        fast_execution: true
      },
      overhead_press: {
        exercise_id: "overhead_press",
        pattern: "vertical_push",
        fast_execution: true
      },
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
        fast_execution: false
      },
      goblet_squat: {
        exercise_id: "goblet_squat",
        pattern: "squat",
        fast_execution: true
      },
      deadlift: {
        exercise_id: "deadlift",
        pattern: "hinge",
        fast_execution: false
      },
      kettlebell_deadlift: {
        exercise_id: "kettlebell_deadlift",
        pattern: "hinge",
        fast_execution: true
      }
    }
  });

  const result = verifyTimeBoxCoverage(fixturePath);

  assert.equal(result.ok, true);
  assert.equal(result.checked_exercise_count, 7);
  assert.equal(result.lane_count, 4);
  assert.deepEqual(result.failures, []);
});

test("P78: fails when fast_execution is missing", () => {
  const fixturePath = writeFixture({
    entries: {
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push"
      }
    }
  });

  const result = verifyTimeBoxCoverage(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "fast_execution_invalid");
});

test("P78: fails when lane has no fast option", () => {
  const fixturePath = writeFixture({
    entries: {
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
        fast_execution: false
      },
      box_squat: {
        exercise_id: "box_squat",
        pattern: "squat",
        fast_execution: false
      },
      push_up: {
        exercise_id: "push_up",
        pattern: "horizontal_push",
        fast_execution: true
      }
    }
  });

  const result = verifyTimeBoxCoverage(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "lane_missing_fast_option");
  assert.equal(result.failures[0].lane, "squat");
});

test("P78: fails when pattern lane is missing", () => {
  const fixturePath = writeFixture({
    entries: {
      weird_exercise: {
        exercise_id: "weird_exercise",
        fast_execution: true
      }
    }
  });

  const result = verifyTimeBoxCoverage(fixturePath);

  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "lane_missing");
});

test("P78: reports lane coverage summary", () => {
  const fixturePath = writeFixture({
    entries: {
      push_up: {
        exercise_id: "push_up",
        pattern: "horizontal_push",
        fast_execution: true
      },
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
        fast_execution: false
      }
    }
  });

  const result = verifyTimeBoxCoverage(fixturePath);

  assert.equal(result.ok, true);
  assert.equal(result.coverage.length, 1);
  assert.equal(result.coverage[0].lane, "horizontal_push");
  assert.deepEqual(result.coverage[0].fast_exercise_ids, ["push_up"]);
});