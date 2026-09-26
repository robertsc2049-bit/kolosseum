
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import type { Phase4ItemPrescription, PlannedItem, PlannedItemIntensity, PlannedItemRole } from "./types.js";
import { uniqueStable } from "./util.js";
import { applyTimeboxDeterministic } from "./timebox.js";

export // DEV NOTE: S-V0-09 planned item identity closure.
// Intent IDs are deduped before planned_items are built so every emitted
// planned item has one explicit exercise_id, one stable ordinal, and no
// duplicate execution ambiguity. Do not infer exercise identity later from
// registry order, substitution candidates, or target defaults; downstream
// phases must consume these explicit planned_items or fail with stable tokens.
function plannedItemsFromIntent(
  intent: string[],
  session_id: string,
  prescriptions?: Phase4ItemPrescription[]
): PlannedItem[] {
  const ids = uniqueStable(intent);

  return ids.map((exercise_id, i) => {
    const isAccessory = i >= 4;
    const role: PlannedItemRole = isAccessory ? "accessory" : "primary";

    // Template-declared prescriptions are validated 1:1 against a duplicate-free
    // exercise_eligibility at load time, so index i is the same exercise here.
    const declared = prescriptions?.[i];

    const sets = declared ? declared.sets : (isAccessory ? 3 : 4);
    const reps = declared ? declared.reps : (isAccessory ? 10 : 5);

    const intensity: PlannedItemIntensity = declared
      ? { ...declared.intensity }
      : isAccessory
        ? { type: "percent_1rm", value: 60 }
        : { type: "percent_1rm", value: 75 };

    const rest_seconds = declared ? declared.rest_seconds : (isAccessory ? 90 : 180);

    const item: PlannedItem = {
      block_id: "B0",
      item_id: `B0_I${i}`,
      exercise_id,
      session_id,
      role,
      sets,
      reps,
      intensity,
      rest_seconds
    };

    if (declared?.distance_m !== undefined) {
      item.distance_value = declared.distance_m;
      item.distance_unit = "meters";
    }
    if (declared?.duration_seconds !== undefined) item.duration_seconds = declared.duration_seconds;

    const group = declared?.group;
    if (group) {
      item.group_id = group.group_id;
      item.group_type = group.group_type;
      if (group.time_cap_seconds !== undefined) item.group_time_cap_seconds = group.time_cap_seconds;
      if (group.round_seconds !== undefined) item.group_round_seconds = group.round_seconds;
      if (group.total_rounds !== undefined) item.group_total_rounds = group.total_rounds;
    }

    return item;
  });
}

export function buildPlannedItems(
  intent: string[],
  session_id: string,
  timeboxMinutes: number,
  prescriptions?: Phase4ItemPrescription[]
): PlannedItem[] {
  let planned_items = plannedItemsFromIntent(intent, session_id, prescriptions);
  planned_items = applyTimeboxDeterministic(planned_items, timeboxMinutes);
  return planned_items;
}

export function derivePlannedExerciseIds(planned_items: PlannedItem[]): string[] {
  return planned_items.map((it) => it.exercise_id);
}

export function deriveTargetExerciseId(planned_exercise_ids: string[]): string {
  return planned_exercise_ids[0] ?? "";
}
