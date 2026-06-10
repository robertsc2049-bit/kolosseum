import type { PlannedItem, PlannedItemIntensity, PlannedItemRole } from "./types.js";
import { uniqueStable } from "./util.js";
import { applyTimeboxDeterministic } from "./timebox.js";

export function plannedItemsFromIntent(intent: string[], session_id: string): PlannedItem[] {
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
