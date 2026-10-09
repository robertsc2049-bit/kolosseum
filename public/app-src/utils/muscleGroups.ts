// The muscle groups exercise pickers filter by. Each exercise option from the
// server lists the groups it's filed under (muscle_groups), from
// src/api/exercise_muscles.ts, whose MUSCLE_GROUPS this list mirrors.

export const MUSCLE_GROUPS: readonly { id: string; label: string }[] = [
  { id: "neck", label: "Neck" },
  { id: "shoulders", label: "Shoulders" },
  { id: "rotator_cuff", label: "Rotator cuff" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back and lats" },
  { id: "traps", label: "Traps" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms_grip", label: "Forearms and grip" },
  { id: "abs_obliques", label: "Abs and obliques" },
  { id: "lower_back", label: "Lower back" },
  { id: "glutes", label: "Glutes and hips" },
  { id: "hip_flexors", label: "Hip flexors" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "adductors", label: "Adductors" },
  { id: "calves_shins", label: "Calves and shins" },
  { id: "conditioning", label: "Conditioning" }
];

// Whether an exercise option is filed under a muscle group ("" is every group).
export function inMuscleGroup(option: { muscle_groups?: unknown }, group: string): boolean {
  return !group || (Array.isArray(option.muscle_groups) && option.muscle_groups.includes(group));
}

// "Targets quadriceps and glute max; also adductors" - what an exercise trains.
export function musclesText(option: { target_muscles?: unknown; secondary_muscles?: unknown } | undefined): string {
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
  const target = list(option?.target_muscles);
  const secondary = list(option?.secondary_muscles);
  if (!target.length) return "";
  return `Targets: ${target.join(", ")}${secondary.length ? ` · Also works: ${secondary.join(", ")}` : ""}`;
}
