import type { AssembleSupportedProgramArgs, Phase4Result } from "./types.js";
import { readSessionTimeboxMinutes } from "./timebox.js";
import { buildPlannedItems, derivePlannedExerciseIds, deriveTargetExerciseId } from "./planned_items.js";
import { buildExercisePool, guardPlannedIdsExist } from "./exercise_pool.js";

export function assembleSupportedProgram(args: AssembleSupportedProgramArgs): Phase4Result {
  const { canonicalInput, phase3, template, registry } = args;
  const { entries, registry_path } = registry;

  // Keep Phase6 stable: single session for now.
  const session_id = "SESSION_V1";

  const timeboxMinutes = readSessionTimeboxMinutes(canonicalInput, phase3.constraints);

  const planned_items = buildPlannedItems(template.intent, session_id, timeboxMinutes);

  // Derived convenience only (and must match planned_items order 1:1 per test contract)
  const planned_exercise_ids = derivePlannedExerciseIds(planned_items);

  // Hardening: planned ids MUST exist in registry (no silent omission).
  const guard = guardPlannedIdsExist(entries, planned_exercise_ids, registry_path);
  if (!guard.ok) return guard.result;

  const { exercise_pool, exercises } = buildExercisePool(entries, planned_exercise_ids);
  const target_exercise_id = deriveTargetExerciseId(planned_exercise_ids);

  return {
    ok: true,
    program: {
      program_id: template.program_id,
      version: "1.0.0",
      blocks: [],
      planned_items,
      planned_exercise_ids,
      exercises,
      exercise_pool,
      target_exercise_id,
      constraints: phase3.constraints
    },
    notes: ["PHASE_4_V1: prescription-ready planned_items emitted"]
  };
}
