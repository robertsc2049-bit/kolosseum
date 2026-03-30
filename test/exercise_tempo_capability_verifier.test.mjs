import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateTempoCapability,
} from "../ci/scripts/run_exercise_tempo_capability_verifier.mjs";

function buildRegistry() {
  return {
    registry_id: "exercise",
    version: "1.0.0",
    entries: {
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
        tempo_capability: "paused_and_tempo",
      },
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
        tempo_capability: "paused_and_tempo",
      },
      deadlift: {
        exercise_id: "deadlift",
        pattern: "hinge",
        tempo_capability: "paused",
      },
    },
  };
}

test("P75: passes when major lift families have explicit tempo capability", () => {
  const result = evaluateTempoCapability(buildRegistry());

  assert.equal(result.ok, true);
  assert.equal(result.validated_pattern_count, 3);
  assert.deepEqual(result.problems, []);
});

test("P75: fails when an exercise is missing tempo_capability", () => {
  const registry = buildRegistry();
  delete registry.entries.back_squat.tempo_capability;

  const result = evaluateTempoCapability(registry);

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "missing_tempo_capability");
});

test("P75: fails when tempo_capability is invalid", () => {
  const registry = buildRegistry();
  registry.entries.back_squat.tempo_capability = "slow_only";

  const result = evaluateTempoCapability(registry);

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "invalid_tempo_capability");
});

test("P75: fails when a required pattern has no tempo-capable exercise", () => {
  const registry = buildRegistry();
  registry.entries.deadlift.tempo_capability = "none";

  const result = evaluateTempoCapability(registry);

  assert.equal(result.ok, false);
  assert.equal(
    result.problems.some(
      (problem) =>
        problem.type === "missing_tempo_capable_variant" &&
        problem.pattern === "hinge",
    ),
    true,
  );
});

test("P75: fails when an exercise is missing pattern", () => {
  const registry = buildRegistry();
  delete registry.entries.back_squat.pattern;

  const result = evaluateTempoCapability(registry);

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "missing_pattern");
});