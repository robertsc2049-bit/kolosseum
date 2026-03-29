import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSubstitutionGraph,
} from "../ci/scripts/run_exercise_substitution_graph_verifier.mjs";

function buildExerciseRegistry() {
  return {
    registry_id: "exercise",
    version: "1.0.0",
    entries: {
      back_squat: {
        exercise_id: "back_squat",
        pattern: "squat",
      },
      goblet_squat: {
        exercise_id: "goblet_squat",
        pattern: "squat",
      },
      bench_press: {
        exercise_id: "bench_press",
        pattern: "horizontal_push",
      },
      dumbbell_bench_press: {
        exercise_id: "dumbbell_bench_press",
        pattern: "horizontal_push",
      },
      overhead_press: {
        exercise_id: "overhead_press",
        pattern: "vertical_push",
      },
      dumbbell_overhead_press: {
        exercise_id: "dumbbell_overhead_press",
        pattern: "vertical_push",
      },
    },
  };
}

test("P71: passes when all substitution edges stay inside pattern", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      back_squat: ["goblet_squat"],
      bench_press: ["dumbbell_bench_press"],
      overhead_press: ["dumbbell_overhead_press"],
    },
  };

  const result = evaluateSubstitutionGraph(graph, buildExerciseRegistry());

  assert.equal(result.ok, true);
  assert.equal(result.validated_edge_count, 3);
  assert.deepEqual(result.problems, []);
});

test("P71: fails when target exercise is missing", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      back_squat: ["missing_target_exercise"],
    },
  };

  const result = evaluateSubstitutionGraph(graph, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "missing_target");
});

test("P71: fails when source exercise is missing", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      missing_source_exercise: ["goblet_squat"],
    },
  };

  const result = evaluateSubstitutionGraph(graph, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "missing_source");
});

test("P71: fails when substitution crosses patterns", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      back_squat: ["bench_press"],
    },
  };

  const result = evaluateSubstitutionGraph(graph, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "cross_pattern_edge");
});

test("P71: fails on self-edge", () => {
  const graph = {
    graph_id: "exercise_substitution_graph",
    version: "1.0.0",
    edges: {
      back_squat: ["back_squat"],
    },
  };

  const result = evaluateSubstitutionGraph(graph, buildExerciseRegistry());

  assert.equal(result.ok, false);
  assert.equal(result.problems[0].type, "self_edge");
});