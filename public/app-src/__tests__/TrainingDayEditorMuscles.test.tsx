import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { type DayItem, TrainingDayEditor } from "../components/TrainingDayEditor";

test.afterEach(() => cleanup());

const options = [
  { exercise_id: "back_squat", label: "Back squat", muscle_groups: ["quads", "glutes"], target_muscles: ["Quadriceps", "Glute max"], secondary_muscles: [] },
  { exercise_id: "leg_extension", label: "Leg extension", muscle_groups: ["quads"], target_muscles: ["Quadriceps"], secondary_muscles: [] },
  { exercise_id: "bench_press", label: "Bench press", muscle_groups: ["chest"], target_muscles: ["Chest (lower and mid pec)"], secondary_muscles: ["Triceps"] }
];

test("an athlete planning leg day narrows the exercise list to quad work, keeps what's already chosen, and sees what it trains", () => {
  let items: DayItem[] = [{ exercise_id: "bench_press", sets: 3, reps: 8 }, { exercise_id: "", sets: 3, reps: 8 }];
  const { rerender } = render(<TrainingDayEditor label="Day 1" items={items} options={options} onChange={(next) => { items = next; }} />);
  assert.ok(screen.getByText("Targets: Chest (lower and mid pec) · Also works: Triceps"));

  fireEvent.change(screen.getByLabelText("Day 1 muscle group"), { target: { value: "quads" } });
  const listed = (n: number) => [...(screen.getByLabelText(`Day 1 exercise ${n}`) as HTMLSelectElement).options].map((o) => o.value).filter(Boolean);
  assert.deepEqual(listed(2), ["back_squat", "leg_extension"]);
  assert.deepEqual(listed(1), ["back_squat", "leg_extension", "bench_press"], "the bench press already chosen stays");

  fireEvent.change(screen.getByLabelText("Day 1 exercise 2"), { target: { value: "leg_extension" } });
  rerender(<TrainingDayEditor label="Day 1" items={items} options={options} onChange={(next) => { items = next; }} />);
  assert.ok(screen.getByText("Targets: Quadriceps"));
});
