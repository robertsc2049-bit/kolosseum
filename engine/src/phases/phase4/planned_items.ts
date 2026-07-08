
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import type { PlannedItem, PlannedItemIntensity, PlannedItemRole } from "./types.js";
import { uniqueStable } from "./util.js";
import { applyTimeboxDeterministic } from "./timebox.js";

export // DEV NOTE: S-V0-09 planned item identity closure.
// Intent IDs are deduped before planned_items are built so every emitted
// planned item has one explicit exercise_id, one stable ordinal, and no
// duplicate execution ambiguity. Do not infer exercise identity later from
// registry order, substitution candidates, or target defaults; downstream
// phases must consume these explicit planned_items or fail with stable tokens.
function plannedItemsFromIntent(intent: string[], session_id: string): PlannedItem[] {
  const ids = uniqueStable(intent);

  return ids.map((exercise_id, i) => {
    const isAccessory = i >= 4;
    const role: PlannedItemRole = isAccessory ? "accessory" : "primary";

    const sets = isAccessory ? 3 : 4;
    const reps = isAccessory ? 10 : 5;

    const intensity: PlannedItemIntensity = isAccessory
      ? { type: "percent_1rm", value: 60 }
      : { type: "percent_1rm", value: 75 };

    const rest_seconds = isAccessory ? 90 : 180;

    return {
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
  });
}

export function buildPlannedItems(intent: string[], session_id: string, timeboxMinutes: number): PlannedItem[] {
  let planned_items = plannedItemsFromIntent(intent, session_id);
  planned_items = applyTimeboxDeterministic(planned_items, timeboxMinutes);
  return planned_items;
}

export function derivePlannedExerciseIds(planned_items: PlannedItem[]): string[] {
  return planned_items.map((it) => it.exercise_id);
}

export function deriveTargetExerciseId(planned_exercise_ids: string[]): string {
  return planned_exercise_ids[0] ?? "";
}
