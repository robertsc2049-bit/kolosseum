import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { type DayItem, TrainingDayEditor } from "../components/TrainingDayEditor";
import { matchesExerciseSearch } from "../utils/muscleGroups";

test.afterEach(() => cleanup());

const rdl = { target_muscles: ["Hamstrings", "Glute max"] };
const thrust = { target_muscles: ["Glute max"] };
const fly = { target_muscles: ["Chest (lower and mid pec)"] };

test("a coach can find an exercise by name, shorthand, plural or the muscle it targets", () => {
  assert.equal(matchesExerciseSearch("Romanian deadlift", rdl, "rdl"), true, "gym shorthand");
  assert.equal(matchesExerciseSearch("Dumbbell Romanian deadlift", rdl, "db rdl"), true, "every word must match");
  assert.equal(matchesExerciseSearch("Romanian deadlift", rdl, "db rdl"), false, "not a dumbbell exercise");
  assert.equal(matchesExerciseSearch("Barbell hip thrust", thrust, "glutes"), true, "a plural finds the muscle");
  assert.equal(matchesExerciseSearch("Cable fly (crossover)", fly, "FLY"), true, "case doesn't matter");
  assert.equal(matchesExerciseSearch("Cable fly (crossover)", fly, "chest"), true, "by target muscle");
  assert.equal(matchesExerciseSearch("Triceps dip", { target_muscles: ["Triceps"] }, "chest"), false, "secondary muscles don't count");
  assert.equal(matchesExerciseSearch("Anything", {}, "  "), true, "an empty search matches everything");
});

test("an athlete types 'curl' while planning a day and sees only curls, keeping what's already chosen", () => {
  const options = [
    { exercise_id: "dumbbell_curl", label: "Dumbbell curl", muscle_groups: ["biceps"], target_muscles: ["Biceps"] },
    { exercise_id: "seated_leg_curl", label: "Seated leg curl", muscle_groups: ["hamstrings"], target_muscles: ["Hamstrings"] },
    { exercise_id: "bench_press", label: "Bench press", muscle_groups: ["chest"], target_muscles: ["Chest (lower and mid pec)"] }
  ];
  const items: DayItem[] = [{ exercise_id: "bench_press", sets: 3, reps: 8 }, { exercise_id: "", sets: 3, reps: 8 }];
  render(<TrainingDayEditor label="Day 1" items={items} options={options} onChange={() => {}} />);
  fireEvent.change(screen.getByLabelText("Day 1 search exercises"), { target: { value: "curl" } });
  const listed = (n: number) => [...(screen.getByLabelText(`Day 1 exercise ${n}`) as HTMLSelectElement).options].map((o) => o.value).filter(Boolean);
  assert.deepEqual(listed(2), ["dumbbell_curl", "seated_leg_curl"]);
  assert.deepEqual(listed(1), ["dumbbell_curl", "seated_leg_curl", "bench_press"], "the chosen bench press stays");

  fireEvent.change(screen.getByLabelText("Day 1 muscle group"), { target: { value: "biceps" } });
  assert.deepEqual(listed(2), ["dumbbell_curl"], "search and muscle group combine");
});
