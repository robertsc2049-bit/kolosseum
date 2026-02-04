import type { ExerciseSignature } from "../../substitution/types.js";
import type { Phase4Result } from "./types.js";
import { pick, uniqueStable } from "./util.js";

function findMissingPlannedIds(entries: Record<string, ExerciseSignature>, plannedIds: string[]): string[] {
  const missing: string[] = [];
  for (const id of plannedIds) {
    if (!entries[id]) missing.push(id);
  }
  return missing;
}

export function guardPlannedIdsExist(
  entries: Record<string, ExerciseSignature>,
  planned_exercise_ids: string[],
  registry_path: string
): { ok: true } | { ok: false; result: Phase4Result } {
  const missingPlanned = findMissingPlannedIds(entries, planned_exercise_ids);
  if (missingPlanned.length === 0) return { ok: true };

  return {
    ok: false,
    result: {
      ok: false,
      failure_token: "PHASE4_MISSING_PLANNED_EXERCISE",
      details: {
        registry_path,
        missing_exercise_ids: missingPlanned
      }
    }
  };
}

export function buildExercisePool(
  entries: Record<string, ExerciseSignature>,
  planned_exercise_ids: string[]
): { exercise_pool: Record<string, ExerciseSignature>; exercises: ExerciseSignature[] } {
  const poolIds = uniqueStable([
    ...planned_exercise_ids,
    "dumbbell_bench_press",
    "machine_chest_press",
    "goblet_squat",
    "kettlebell_deadlift"
  ]);

  const exercise_pool: Record<string, ExerciseSignature> = {};

  // Planned ids are guaranteed present (guarded before calling). Extras are best-effort.
  for (const id of poolIds) {
    if (entries[id]) {
      exercise_pool[id] = pick(entries, id);
    }
  }

  const exercises = Object.values(exercise_pool).sort((a, b) => a.exercise_id.localeCompare(b.exercise_id));
  return { exercise_pool, exercises };
}
