// DEV NOTE: REG-FULL-06 runtime adapter. This module projects the canonical
// substitution registry and its explicit exercise/equipment/activity authorities
// into the frozen S-V1-32 engine input shape. It never authors, reverses, ranks,
// or infers substitution edges at runtime.

import fs from "node:fs";
import path from "node:path";
import {
  RUGBY_UNION_POSITION_SUBSTITUTION_PROFILE,
  type RugbyUnionPositionExclusionEntry
} from "./rugby_union_position_substitution_profile.js";

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
  activityId: string,
  rows: Record<string, ApplicabilityRow>
): ApplicabilityRow | null {
  return (
    Object.values(rows).find(
      (row) =>
        row.exercise_id === exerciseId &&
        row.activity_id === activityId &&
        row.activity_context === "training"
    ) ?? null
  );
}

function isExplicitlyEligible(exerciseId: string, activityId: string, rows: Record<string, ApplicabilityRow>): boolean {
  const row = trainingApplicability(exerciseId, activityId, rows);
  return row?.applicability_state === "allowed" && row?.substitution_applicability === "eligible";
}

// Position is a pure, optional narrowing filter over an already
// activity-eligible substitution pool - see the DEV NOTE atop
// rugby_union_position_substitution_profile.ts. It has no bearing on
// eligibility itself (isExplicitlyEligible/isKnownSubstitutionExerciseId
// are unaffected) and is only ever consulted inside buildV1SubstitutionInput.
export function positionExclusionEntry(
  activityId: string,
  position: string | null | undefined
): RugbyUnionPositionExclusionEntry | null {
  if (!position) return null;
  return RUGBY_UNION_POSITION_SUBSTITUTION_PROFILE[`${activityId}__${position}`] ?? null;
}

export function isExcludedForPosition(
  exerciseId: string,
  entry: RugbyUnionPositionExclusionEntry | null,
  exercises: Record<string, { movement_pattern_id?: string }>
): boolean {
  if (!entry) return false;
  if (entry.excluded_exercise_ids?.includes(exerciseId)) return true;
  const movementId = exercises[exerciseId]?.movement_pattern_id;
  return !!movementId && !!entry.excluded_movement_pattern_ids?.includes(movementId);
}

function outgoingEdges(
  sourceExerciseId: string,
  activityId: string,
  substitutions: Record<string, SubstitutionRow>
): SubstitutionRow[] {
  return Object.values(substitutions)
    .filter(
      (row) =>
        row.source_exercise_id === sourceExerciseId &&
        Array.isArray(row.activity_applicability) &&
        row.activity_applicability.includes(activityId)
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
  activityId: string,
  authority: RuntimeAuthority
): RegistryExercise | null {
  const row = authority.exercises[exerciseId];
  if (!row || row.exercise_id !== exerciseId || typeof row.movement_pattern_id !== "string") return null;
  if (!isExplicitlyEligible(exerciseId, activityId, authority.applicability)) return null;

  const equipmentIds = requiredEquipmentIds(exerciseId, authority.equipmentCompatibility);
  if (equipmentIds.length === 0 || equipmentIds.some((equipmentId) => !authority.equipment[equipmentId])) return null;

  return {
    exercise_id: exerciseId,
    activity_id: activityId,
    movement_id: row.movement_pattern_id,
    equipment_ids: equipmentIds
  };
}

export function isKnownExerciseRegistryId(exerciseId: string): boolean {
  const id = typeof exerciseId === "string" ? exerciseId.trim() : "";
  if (!id) return false;
  const exercises = readEntries<ExerciseRow>(EXERCISE_REGISTRY_PATH, "exercise");
  const row = exercises[id];
  return !!row && row.exercise_id === id;
}

export function isKnownSubstitutionExerciseId(exerciseId: string, activityId: string): boolean {
  const id = typeof exerciseId === "string" ? exerciseId.trim() : "";
  const activity = typeof activityId === "string" ? activityId.trim() : "";
  if (!id || !activity) return false;
  const authority = loadRuntimeAuthority();
  if (!projectExercise(id, activity, authority)) return false;
  return outgoingEdges(id, activity, authority.substitutions).some(
    (edge) => typeof edge.target_exercise_id === "string" && projectExercise(edge.target_exercise_id, activity, authority) !== null
  );
}

export function buildV1SubstitutionInput(
  sourceExerciseId: string,
  unavailableEquipmentIds: string[],
  activityId: string,
  position?: string | null
): Record<string, unknown> | null {
  const sourceId = typeof sourceExerciseId === "string" ? sourceExerciseId.trim() : "";
  const activity = typeof activityId === "string" ? activityId.trim() : "";
  if (!sourceId || !activity) return null;

  const authority = loadRuntimeAuthority();
  const sourceExercise = projectExercise(sourceId, activity, authority);
  if (!sourceExercise) return null;

  const relevantEdgesAll = outgoingEdges(sourceId, activity, authority.substitutions).filter((edge) => {
    if (typeof edge.substitution_edge_id !== "string" || edge.substitution_edge_id.length === 0) return false;
    if (typeof edge.target_exercise_id !== "string" || edge.target_exercise_id.length === 0) return false;
    return projectExercise(edge.target_exercise_id, activity, authority) !== null;
  });
  if (relevantEdgesAll.length === 0) return null;

  const exclusionEntry = positionExclusionEntry(activity, position);
  const relevantEdgesNarrowed = exclusionEntry
    ? relevantEdgesAll.filter(
        (edge) => !isExcludedForPosition(edge.target_exercise_id as string, exclusionEntry, authority.exercises)
      )
    : relevantEdgesAll;
  // Narrowing can never reduce the offered set to zero: fall back to the
  // unnarrowed set so a thin/incomplete position profile degrades to
  // today's activity-only behaviour rather than wrongly refusing an
  // otherwise-lawful substitution.
  const relevantEdges = relevantEdgesNarrowed.length > 0 ? relevantEdgesNarrowed : relevantEdgesAll;

  const orderedCandidateIds = [
    sourceId,
    ...relevantEdges.map((edge) => edge.target_exercise_id as string)
  ].filter((value, index, values) => values.indexOf(value) === index);

  const candidateExercises = orderedCandidateIds
    .map((exerciseId) => projectExercise(exerciseId, activity, authority))
    .filter((exercise): exercise is RegistryExercise => exercise !== null);

  if (candidateExercises.length !== orderedCandidateIds.length) return null;

  const equipmentIds = Object.keys(authority.equipment).sort();
  const unavailable = [...new Set(unavailableEquipmentIds.filter((value) => typeof value === "string" && value.length > 0))].sort();

  return {
    activity_id: activity,
    target_exercise_id: sourceId,
    unavailable_equipment_ids: unavailable,
    registry_links: {
      activity_ids: [activity],
      exercise_ids: candidateExercises.map((exercise) => exercise.exercise_id).sort(),
      movement_ids: [...new Set(candidateExercises.map((exercise) => exercise.movement_id))].sort(),
      equipment_ids: equipmentIds,
      substitution_edge_ids: relevantEdges.map((edge) => edge.substitution_edge_id as string).sort(),
      applicability_records: candidateExercises
        .map((exercise) => ({
          exercise_id: exercise.exercise_id,
          activity_id: activity,
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
      activity_id: activity,
      source_exercise_id: sourceId,
      target_exercise_id: edge.target_exercise_id as string,
      reason_codes: ["declared_edge_matched"]
    }))
  };
}

export function findSubstitutionRegistryEdge(
  edgeId: string,
  sourceExerciseId: string,
  targetExerciseId: string,
  activityId: string
): RegistryEdge | null {
  const activity = typeof activityId === "string" ? activityId.trim() : "";
  if (!activity) return null;

  const authority = loadRuntimeAuthority();
  const row = authority.substitutions[edgeId];
  if (
    !row ||
    row.substitution_edge_id !== edgeId ||
    row.source_exercise_id !== sourceExerciseId ||
    row.target_exercise_id !== targetExerciseId ||
    !Array.isArray(row.activity_applicability) ||
    !row.activity_applicability.includes(activity)
  ) {
    return null;
  }

  return {
    edge_id: edgeId,
    activity_id: activity,
    source_exercise_id: sourceExerciseId,
    target_exercise_id: targetExerciseId,
    reason_codes: ["declared_edge_matched"]
  };
}
