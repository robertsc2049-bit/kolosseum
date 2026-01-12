import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { phase5ApplySubstitutionAndAdjustment } from "../dist/engine/src/phases/phase5.js";

function stripBom(s) {
  return (s && s.length && s.charCodeAt(0) === 0xFEFF) ? s.slice(1) : s;
}

function loadExerciseRegistryEntries() {
  const p = "registries/exercise/exercise.registry.json";
  const raw = stripBom(fs.readFileSync(p, "utf8"));
  const j = JSON.parse(raw);
  return Object.values(j.entries || {});
}

test("T003: registry-backed substitution picks dumbbell bench when only shoulder_high is avoided", () => {
  const entries = loadExerciseRegistryEntries();

  const program = {
    exercises: entries,
    target_exercise_id: "bench_press",
    constraints: { avoid_joint_stress_tags: ["shoulder_high"] }
  };

  const p5 = phase5ApplySubstitutionAndAdjustment(program, {});
  assert.equal(p5.ok, true);

  const adj = p5.adjustments?.[0];
  assert.equal(adj?.adjustment_id, "SUBSTITUTE_EXERCISE");
  assert.equal(adj?.details?.target_exercise_id, "bench_press");
  assert.equal(adj?.details?.substitute_exercise_id, "dumbbell_bench_press");
});

test("T003: registry-backed substitution falls back to machine chest press when shoulder_high+shoulder_medium are avoided", () => {
  const entries = loadExerciseRegistryEntries();

  const program = {
    exercises: entries,
    target_exercise_id: "bench_press",
    constraints: { avoid_joint_stress_tags: ["shoulder_high", "shoulder_medium"] }
  };

  const p5 = phase5ApplySubstitutionAndAdjustment(program, {});
  assert.equal(p5.ok, true);

  const adj = p5.adjustments?.[0];
  assert.equal(adj?.adjustment_id, "SUBSTITUTE_EXERCISE");
  assert.equal(adj?.details?.target_exercise_id, "bench_press");
  assert.equal(adj?.details?.substitute_exercise_id, "machine_chest_press");
});
