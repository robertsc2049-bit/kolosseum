
// DEV NOTE: Small, hand-authored, closed substitution data source for the
// session execution UI. Deliberately separate from
// registries/exercise/exercise_substitution_graph.json (which
// test/dormant_registry_exclusion_guard.test.mjs requires to stay excluded
// from the live registry surface) - this file is its own narrowly-scoped
// production input for src/v1SubstitutionEngineContract.mjs and never reads
// or activates that dormant file.

const ACTIVITY_ID = "general_strength";

type RegistryExercise = {
  exercise_id: string;
  activity_id: string;
  movement_id: string;
  equipment_ids: string[];
};

type RegistryEdge = {
  edge_id: string;
  activity_id: string;
  source_exercise_id: string;
  target_exercise_id: string;
  reason_codes: string[];
};

const EXERCISES: readonly RegistryExercise[] = Object.freeze([
  { exercise_id: "bench_press", activity_id: ACTIVITY_ID, movement_id: "horizontal_push", equipment_ids: ["barbell"] },
  { exercise_id: "dumbbell_bench_press", activity_id: ACTIVITY_ID, movement_id: "horizontal_push", equipment_ids: ["dumbbell"] },
  { exercise_id: "overhead_press", activity_id: ACTIVITY_ID, movement_id: "vertical_push", equipment_ids: ["barbell"] },
  { exercise_id: "dumbbell_overhead_press", activity_id: ACTIVITY_ID, movement_id: "vertical_push", equipment_ids: ["dumbbell"] },
  { exercise_id: "back_squat", activity_id: ACTIVITY_ID, movement_id: "squat", equipment_ids: ["barbell"] },
  { exercise_id: "goblet_squat", activity_id: ACTIVITY_ID, movement_id: "squat", equipment_ids: ["dumbbell"] },
  { exercise_id: "deadlift", activity_id: ACTIVITY_ID, movement_id: "hinge", equipment_ids: ["barbell"] },
  { exercise_id: "kettlebell_deadlift", activity_id: ACTIVITY_ID, movement_id: "hinge", equipment_ids: ["kettlebell"] }
]);

const EDGES: readonly RegistryEdge[] = Object.freeze([
  {
    edge_id: "sub_edge_bench_press_to_dumbbell_bench_press",
    activity_id: ACTIVITY_ID,
    source_exercise_id: "bench_press",
    target_exercise_id: "dumbbell_bench_press",
    reason_codes: ["declared_edge_matched"]
  },
  {
    edge_id: "sub_edge_overhead_press_to_dumbbell_overhead_press",
    activity_id: ACTIVITY_ID,
    source_exercise_id: "overhead_press",
    target_exercise_id: "dumbbell_overhead_press",
    reason_codes: ["declared_edge_matched"]
  },
  {
    edge_id: "sub_edge_back_squat_to_goblet_squat",
    activity_id: ACTIVITY_ID,
    source_exercise_id: "back_squat",
    target_exercise_id: "goblet_squat",
    reason_codes: ["declared_edge_matched"]
  },
  {
    edge_id: "sub_edge_deadlift_to_kettlebell_deadlift",
    activity_id: ACTIVITY_ID,
    source_exercise_id: "deadlift",
    target_exercise_id: "kettlebell_deadlift",
    reason_codes: ["declared_edge_matched"]
  }
]);

const EQUIPMENT_IDS = Object.freeze(["barbell", "dumbbell", "kettlebell"]);

function connectedExerciseIds(sourceExerciseId: string): string[] {
  const ids = new Set<string>([sourceExerciseId]);
  for (const edge of EDGES) {
    if (edge.source_exercise_id === sourceExerciseId) ids.add(edge.target_exercise_id);
    if (edge.target_exercise_id === sourceExerciseId) ids.add(edge.source_exercise_id);
  }
  return [...ids];
}

export function isKnownSubstitutionExerciseId(exerciseId: string): boolean {
  return EXERCISES.some((ex) => ex.exercise_id === exerciseId);
}

export function buildV1SubstitutionInput(
  sourceExerciseId: string,
  unavailableEquipmentIds: string[]
): Record<string, unknown> | null {
  if (!isKnownSubstitutionExerciseId(sourceExerciseId)) return null;

  const relevantIds = connectedExerciseIds(sourceExerciseId);
  const candidateExercises = EXERCISES.filter((ex) => relevantIds.includes(ex.exercise_id));
  const relevantEdges = EDGES.filter(
    (edge) => relevantIds.includes(edge.source_exercise_id) && relevantIds.includes(edge.target_exercise_id)
  );

  return {
    activity_id: ACTIVITY_ID,
    target_exercise_id: sourceExerciseId,
    unavailable_equipment_ids: [...new Set(unavailableEquipmentIds)].sort(),
    registry_links: {
      activity_ids: [ACTIVITY_ID],
      exercise_ids: candidateExercises.map((ex) => ex.exercise_id).sort(),
      movement_ids: [...new Set(candidateExercises.map((ex) => ex.movement_id))].sort(),
      equipment_ids: [...EQUIPMENT_IDS].sort(),
      substitution_edge_ids: relevantEdges.map((edge) => edge.edge_id).sort(),
      applicability_records: candidateExercises
        .map((ex) => ({
          exercise_id: ex.exercise_id,
          activity_id: ACTIVITY_ID,
          substitution_applicability: "eligible" as const
        }))
        .sort((a, b) => a.exercise_id.localeCompare(b.exercise_id))
    },
    candidate_exercises: candidateExercises.map((ex) => ({
      exercise_id: ex.exercise_id,
      activity_id: ex.activity_id,
      movement_id: ex.movement_id,
      equipment_ids: [...ex.equipment_ids]
    })),
    substitution_edges: relevantEdges.map((edge) => ({
      edge_id: edge.edge_id,
      activity_id: edge.activity_id,
      source_exercise_id: edge.source_exercise_id,
      target_exercise_id: edge.target_exercise_id,
      reason_codes: [...edge.reason_codes]
    }))
  };
}

export function findSubstitutionRegistryEdge(
  edgeId: string,
  sourceExerciseId: string,
  targetExerciseId: string
): RegistryEdge | null {
  return (
    EDGES.find(
      (edge) =>
        edge.edge_id === edgeId &&
        edge.source_exercise_id === sourceExerciseId &&
        edge.target_exercise_id === targetExerciseId
    ) ?? null
  );
}
