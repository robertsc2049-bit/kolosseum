import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSubstitutionIntegrity,
} from "../ci/scripts/run_exercise_substitution_integrity_verifier.mjs";

function buildExerciseRegistry() {
  return {
    registry_id: "exercise",
    version: "1.0.0",
    entries: {
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
        equipment_class: "barbell",
      },
      dumbbell_squat: {
        exercise_id: "dumbbell_squat",
        pattern: "squat",
        equipment_class: "dumbbell",
      },
      bodyweight_squat: {
        exercise_id: "bodyweight_squat",
        pattern: "squat",
        equipment_class: "bodyweight",
      },
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
        equipment_class: "barbell",
      },
      dumbbell_bench_press: {
        exercise_id: "dumbbell_bench_press",
        pattern: "horizontal_push",
        equipment_class: "dumbbell",
      },
      push_up: {
        exercise_id: "push_up",
        pattern: "horizontal_push",
        equipment_class: "bodyweight",
      },
      overhead_press: {
        exercise_id: "overhead_press",
        pattern: "vertical_push",
        equipment_class: "barbell",
      },
      dumbbell_overhead_press: {
        exercise_id: "dumbbell_overhead_press",
        pattern: "vertical_push",
        equipment_class: "dumbbell",
      },
      pike_push_up: {
        exercise_id: "pike_push_up",
        pattern: "vertical_push",
        equipment_class: "bodyweight",
      },
    },
  };
}

test("P72: passes for barbell to dumbbell to bodyweight while preserving movement intent", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      back_squat: ["dumbbell_squat", "bodyweight_squat"],
      dumbbell_squat: ["bodyweight_squat"],
      bench_press: ["dumbbell_bench_press", "push_up"],
      dumbbell_bench_press: ["push_up"],
      overhead_press: ["dumbbell_overhead_press", "pike_push_up"],
      dumbbell_overhead_press: ["pike_push_up"],
    },
  };

  const result = evaluateSubstitutionIntegrity(graph, buildExerciseRegistry());

  assert.equal(result.ok, true);
  assert.equal(result.validated_edge_count, 9);
  assert.deepEqual(result.problems, []);
});

test("P72: fails when movement intent changes across equipment substitution", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      back_squat: ["dumbbell_bench_press"],
    },
  };

  const result = evaluateSubstitutionIntegrity(graph, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "movement_intent_mismatch");
});

test("P72: fails when substitution tries to move up the equipment ladder", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      push_up: ["dumbbell_bench_press"],
    },
  };

  const result = evaluateSubstitutionIntegrity(graph, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "cross_equipment_direction_invalid");
});

test("P72: fails when equipment class is missing", () => {
  const registry = buildExerciseRegistry();
  delete registry.entries.back_squat.equipment_class;

  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      back_squat: ["dumbbell_squat"],
    },
  };

  const result = evaluateSubstitutionIntegrity(graph, registry);

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "missing_equipment_class");
});

test("P72: fails on duplicate edge entries", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      bench_press: ["dumbbell_bench_press", "dumbbell_bench_press"],
    },
  };

  const result = evaluateSubstitutionIntegrity(graph, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "duplicate_edge");
});