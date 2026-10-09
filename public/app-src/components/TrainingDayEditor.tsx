import React, { useState } from "react";

import { inMuscleGroup, matchesExerciseSearch, musclesText } from "../utils/muscleGroups";
import { ExerciseSearchInput } from "./ExerciseSearchInput";
import { MuscleGroupSelect } from "./MuscleGroupSelect";

// One training day's exercises with sets and reps - used for each day of an
// athlete's own week (MyTrainingCard) and for logging today's session when
// they have no week (TodaysSessionPicker).

export type DayItem = { exercise_id: string; sets: number; reps: number };
export type ExerciseOption = { exercise_id: string; label: string; muscle_groups?: string[]; target_muscles?: string[]; secondary_muscles?: string[] };

// An exercise option as the server lists it (training week exercise_options).
export function toExerciseOption(o: Record<string, unknown>): ExerciseOption {
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
  return { exercise_id: String(o.exercise_id), label: String(o.label), muscle_groups: list(o.muscle_groups), target_muscles: list(o.target_muscles), secondary_muscles: list(o.secondary_muscles) };
}

export const newDayItem = (): DayItem => ({ exercise_id: "", sets: 3, reps: 8 });

export function TrainingDayEditor({ label, items, options, onChange }: {
  label: string;
  items: DayItem[];
  options: ExerciseOption[];
  onChange: (items: DayItem[]) => void;
}) {
  const [muscleFilter, setMuscleFilter] = useState("");
  const [search, setSearch] = useState("");
  const update = (index: number, change: Partial<DayItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...change } : item)));
  return (
    <fieldset className="my-training-day">
      <legend>{label}</legend>
      <MuscleGroupSelect value={muscleFilter} onChange={setMuscleFilter} ariaLabel={`${label} muscle group`} />
      <ExerciseSearchInput value={search} onChange={setSearch} ariaLabel={`${label} search exercises`} />
      {items.map((item, i) => (
        <div key={i} className="my-training-item">
          <label className="field">
            <span>Exercise</span>
            <select aria-label={`${label} exercise ${i + 1}`} value={item.exercise_id} onChange={(event) => update(i, { exercise_id: event.target.value })}>
              <option value="">Choose an exercise</option>
              {options.filter((o) => o.exercise_id === item.exercise_id || (inMuscleGroup(o, muscleFilter) && matchesExerciseSearch(o.label, o, search))).map((o) => <option key={o.exercise_id} value={o.exercise_id}>{o.label}</option>)}
            </select>
            {item.exercise_id ? <small className="muted exercise-muscles">{musclesText(options.find((o) => o.exercise_id === item.exercise_id))}</small> : null}
          </label>
          <label className="field">
            <span>Sets</span>
            <input aria-label={`${label} exercise ${i + 1} sets`} type="number" inputMode="numeric" min={1} max={8} value={item.sets} onChange={(event) => update(i, { sets: Number(event.target.value) })} />
          </label>
          <label className="field">
            <span>Reps</span>
            <input aria-label={`${label} exercise ${i + 1} reps`} type="number" inputMode="numeric" min={1} max={30} value={item.reps} onChange={(event) => update(i, { reps: Number(event.target.value) })} />
          </label>
          {items.length > 1 ? <button className="button secondary" type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button> : null}
        </div>
      ))}
      <button className="button secondary" type="button" onClick={() => onChange([...items, newDayItem()])}>Add exercise</button>
    </fieldset>
  );
}
