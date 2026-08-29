// DEV NOTE: REG-FULL-06 runtime adapter. This module projects the canonical
// substitution registry and its explicit exercise/equipment/activity authorities
// into the frozen S-V1-32 engine input shape. It never authors, reverses, ranks,
// or infers substitution edges at runtime.

import fs from "node:fs";
import path from "node:path";

const ACTIVITY_ID = "general_strength";

const EXERCISE_REGISTRY_PATH = path.join(
  process.cwd(),
  "registries",
  "exercise",
  "exercise.registry.json"
);
const EQUIPMENT_REGISTRY_PATH = path.join(
  process.cwd(),
  "registries",
  "equipment",
  "equipment.registry.json"
);
const EQUIPMENT_COMPATIBILITY_REGISTRY_PATH = path.join(
  process.cwd(),
  "registries",
  "exercise_equipment_compatibility",
  "exercise_equipment_compatibility.registry.json"
);
const ACTIVITY_APPLICABILITY_REGISTRY_PATH = path.join(
  process.cwd(),
  "registries",
  "exercise_activity_applicability",
  "exercise_activity_applicability.registry.json"
);
const SUBSTITUTION_REGISTRY_PATH = path.join(
  process.cwd(),
  "registries",
  "substitution",
  "substitution.registry.json"
);

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

type ExerciseRow = {
  exercise_id?: string;
  movement_pattern_id?: string;
};

type EquipmentCompatibilityRow = {
  exercise_id?: string;
  equipment_id?: string;
  compatibility_type?: string;
};

type ApplicabilityRow = {
  exercise_id?: string;
  activity_id?: string;
  activity_context?: string;
  applicability_state?: string;
  substitution_applicability?: string;
};

type SubstitutionRow = {
  substitution_edge_id?: string;
  source_exercise_id?: string;
  target_exercise_id?: string;
  activity_applicability?: string[];
  deterministic_ordering_key?: string;
};

type RuntimeAuthority = {
  exercises: Record<string, ExerciseRow>;
  equipment: Record<string, Record<string, unknown>>;
  equipmentCompatibility: Record<string, EquipmentCompatibilityRow>;
  applicability: Record<string, ApplicabilityRow>;
  substitutions: Record<string, SubstitutionRow>;
};

function readEntries<T>(filePath: string, expectedRegistryId: string): Record<string, T> {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`REG_FULL_06_RUNTIME_REGISTRY_INVALID:${expectedRegistryId}`);
  }
  if (parsed.registry_id !== expectedRegistryId) {
    throw new Error(`REG_FULL_06_RUNTIME_REGISTRY_ID:${expectedRegistryId}:${String(parsed.registry_id ?? "missing")}`);
  }
  if (!parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
    throw new Error(`REG_FULL_06_RUNTIME_REGISTRY_ENTRIES:${expectedRegistryId}`);
  }
  return parsed.entries as Record<string, T>;
}

function loadRuntimeAuthority(): RuntimeAuthority {
  return {
    exercises: readEntries<ExerciseRow>(EXERCISE_REGISTRY_PATH, "exercise"),
    equipment: readEntries<Record<string, unknown>>(EQUIPMENT_REGISTRY_PATH, "equipment"),
    equipmentCompatibility: readEntries<EquipmentCompatibilityRow>(
      EQUIPMENT_COMPATIBILITY_REGISTRY_PATH,
      "exercise_equipment_compatibility_registry"
    ),
    applicability: readEntries<ApplicabilityRow>(
      ACTIVITY_APPLICABILITY_REGISTRY_PATH,
      "exercise_activity_applicability"
    ),
    substitutions: readEntries<SubstitutionRow>(SUBSTITUTION_REGISTRY_PATH, "substitution_registry")
  };
}

function requiredEquipmentIds(
  exerciseId: string,
  rows: Record<string, EquipmentCompatibilityRow>
): string[] {
  return Object.values(rows)
    .filter(
      (row) =>
        row.exercise_id === exerciseId &&
        row.compatibility_type === "required" &&
        typeof row.equipment_id === "string" &&
        row.equipment_id.length > 0
    )
    .map((row) => row.equipment_id as string)
    .sort();
}

function trainingApplicability(
  exerciseId: string,
  rows: Record<string, ApplicabilityRow>
): ApplicabilityRow | null {
  return (
    Object.values(rows).find(
      (row) =>
        row.exercise_id === exerciseId &&
        row.activity_id === ACTIVITY_ID &&
        row.activity_context === "training"
    ) ?? null
  );
}

function isExplicitlyEligible(exerciseId: string, rows: Record<string, ApplicabilityRow>): boolean {
  const row = trainingApplicability(exerciseId, rows);
  return row?.applicability_state === "allowed" && row?.substitution_applicability === "eligible";
}

function outgoingEdges(
  sourceExerciseId: string,
  substitutions: Record<string, SubstitutionRow>
): SubstitutionRow[] {
  return Object.values(substitutions)
    .filter(
      (row) =>
        row.source_exercise_id === sourceExerciseId &&
        Array.isArray(row.activity_applicability) &&
        row.activity_applicability.includes(ACTIVITY_ID)
    )
    .sort((left, right) => {
      const leftKey = typeof left.deterministic_ordering_key === "string" ? left.deterministic_ordering_key : "";
      const rightKey = typeof right.deterministic_ordering_key === "string" ? right.deterministic_ordering_key : "";
      if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
      return String(left.substitution_edge_id ?? "").localeCompare(String(right.substitution_edge_id ?? ""));
    });
}

function projectExercise(
  exerciseId: string,
  authority: RuntimeAuthority
): RegistryExercise | null {
  const row = authority.exercises[exerciseId];
  if (!row || row.exercise_id !== exerciseId || typeof row.movement_pattern_id !== "string") return null;
  if (!isExplicitlyEligible(exerciseId, authority.applicability)) return null;

  const equipmentIds = requiredEquipmentIds(exerciseId, authority.equipmentCompatibility);
  if (equipmentIds.length === 0 || equipmentIds.some((equipmentId) => !authority.equipment[equipmentId])) return null;

  return {
    exercise_id: exerciseId,
    activity_id: ACTIVITY_ID,
    movement_id: row.movement_pattern_id,
    equipment_ids: equipmentIds
  };
}

export function isKnownSubstitutionExerciseId(exerciseId: string): boolean {
  const id = typeof exerciseId === "string" ? exerciseId.trim() : "";
  if (!id) return false;
  const authority = loadRuntimeAuthority();
  if (!projectExercise(id, authority)) return false;
  return outgoingEdges(id, authority.substitutions).some(
    (edge) => typeof edge.target_exercise_id === "string" && projectExercise(edge.target_exercise_id, authority) !== null
  );
}

export function buildV1SubstitutionInput(
  sourceExerciseId: string,
  unavailableEquipmentIds: string[]
): Record<string, unknown> | null {
  const sourceId = typeof sourceExerciseId === "string" ? sourceExerciseId.trim() : "";
  if (!sourceId) return null;

  const authority = loadRuntimeAuthority();
  const sourceExercise = projectExercise(sourceId, authority);
  if (!sourceExercise) return null;

  const relevantEdges = outgoingEdges(sourceId, authority.substitutions).filter((edge) => {
    if (typeof edge.substitution_edge_id !== "string" || edge.substitution_edge_id.length === 0) return false;
    if (typeof edge.target_exercise_id !== "string" || edge.target_exercise_id.length === 0) return false;
    return projectExercise(edge.target_exercise_id, authority) !== null;
  });
  if (relevantEdges.length === 0) return null;

  const orderedCandidateIds = [
    sourceId,
    ...relevantEdges.map((edge) => edge.target_exercise_id as string)
  ].filter((value, index, values) => values.indexOf(value) === index);

  const candidateExercises = orderedCandidateIds
    .map((exerciseId) => projectExercise(exerciseId, authority))
    .filter((exercise): exercise is RegistryExercise => exercise !== null);

  if (candidateExercises.length !== orderedCandidateIds.length) return null;

  const equipmentIds = Object.keys(authority.equipment).sort();
  const unavailable = [...new Set(unavailableEquipmentIds.filter((value) => typeof value === "string" && value.length > 0))].sort();

  return {
    activity_id: ACTIVITY_ID,
    target_exercise_id: sourceId,
    unavailable_equipment_ids: unavailable,
    registry_links: {
      activity_ids: [ACTIVITY_ID],
      exercise_ids: candidateExercises.map((exercise) => exercise.exercise_id).sort(),
      movement_ids: [...new Set(candidateExercises.map((exercise) => exercise.movement_id))].sort(),
      equipment_ids: equipmentIds,
      substitution_edge_ids: relevantEdges.map((edge) => edge.substitution_edge_id as string).sort(),
      applicability_records: candidateExercises
        .map((exercise) => ({
          exercise_id: exercise.exercise_id,
          activity_id: ACTIVITY_ID,
          substitution_applicability: "eligible" as const
        }))
        .sort((left, right) => left.exercise_id.localeCompare(right.exercise_id))
    },
    candidate_exercises: candidateExercises.map((exercise) => ({
      exercise_id: exercise.exercise_id,
      activity_id: exercise.activity_id,
      movement_id: exercise.movement_id,
      equipment_ids: [...exercise.equipment_ids]
    })),
    substitution_edges: relevantEdges.map((edge) => ({
      edge_id: edge.substitution_edge_id as string,
      activity_id: ACTIVITY_ID,
      source_exercise_id: sourceId,
      target_exercise_id: edge.target_exercise_id as string,
      reason_codes: ["declared_edge_matched"]
    }))
  };
}

export function findSubstitutionRegistryEdge(
  edgeId: string,
  sourceExerciseId: string,
  targetExerciseId: string
): RegistryEdge | null {
  const authority = loadRuntimeAuthority();
  const row = authority.substitutions[edgeId];
  if (
    !row ||
    row.substitution_edge_id !== edgeId ||
    row.source_exercise_id !== sourceExerciseId ||
    row.target_exercise_id !== targetExerciseId ||
    !Array.isArray(row.activity_applicability) ||
    !row.activity_applicability.includes(ACTIVITY_ID)
  ) {
    return null;
  }

  return {
    edge_id: edgeId,
    activity_id: ACTIVITY_ID,
    source_exercise_id: sourceExerciseId,
    target_exercise_id: targetExerciseId,
    reason_codes: ["declared_edge_matched"]
  };
}
