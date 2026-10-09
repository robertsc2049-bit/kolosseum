import React from "react";

// "Search exercises" box for an exercise picker: by name, muscle or shorthand.
export function ExerciseSearchInput({ value, onChange, ariaLabel = "Search exercises" }: {
  value: string;
  onChange: (query: string) => void;
  ariaLabel?: string;
}) {
  return (
    <label className="field exercise-search">
      <span>Search</span>
      <input type="search" aria-label={ariaLabel} placeholder="e.g. fly, RDL, glutes" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
