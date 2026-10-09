import React from "react";

import { MUSCLE_GROUPS } from "../utils/muscleGroups";

// "Muscle group" filter for an exercise picker: every group, or one.
export function MuscleGroupSelect({ value, onChange, label = "Muscle group", ariaLabel }: {
  value: string;
  onChange: (group: string) => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <label className="field exercise-muscle-filter">
      <span>{label}</span>
      <select aria-label={ariaLabel ?? label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All muscle groups</option>
        {MUSCLE_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
      </select>
    </label>
  );
}
