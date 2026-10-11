import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { LoggedMuscleVolume, WeeklyMuscleVolume } from "../components/WeeklyMuscleVolume";
import { weeklyMuscleVolume } from "../utils/muscleGroups";

test.afterEach(() => cleanup());

const exercises = new Map(Object.entries({
  back_squat: { muscle_groups: ["quads", "glutes"], secondary_muscle_groups: ["adductors", "lower_back", "calves_shins"] },
  romanian_deadlift: { muscle_groups: ["hamstrings", "glutes"], secondary_muscle_groups: ["lower_back", "forearms_grip"] },
  bench_press: { muscle_groups: ["chest"], secondary_muscle_groups: ["shoulders", "triceps"] },
  leg_extension: { muscle_groups: ["quads"], secondary_muscle_groups: [] },
  bike_ergometer: { muscle_groups: ["conditioning"], secondary_muscle_groups: ["quads"] },
  worlds_greatest_stretch: { muscle_groups: ["hip_flexors"], secondary_muscle_groups: [] }
}));

test("a powerlifting week: squats and RDLs count fully for their target groups and half for the rest; warm-ups and conditioning don't count", () => {
  const volume = weeklyMuscleVolume([
    { exercise_id: "worlds_greatest_stretch", planned_sets: 1, segment: "warm_up" },
    { exercise_id: "back_squat", planned_sets: 5, segment: "working" },
    { exercise_id: "romanian_deadlift", planned_sets: 3, segment: "working" },
    { exercise_id: "bench_press", planned_sets: 5, segment: "working" },
    { exercise_id: "back_squat__r2", planned_sets: 3, segment: "working" },
    { exercise_id: "bike_ergometer", planned_sets: 1, segment: "working" },
    { exercise_id: "custom_zercher_lunge", planned_sets: 3, segment: "working" }
  ], exercises);
  const sets = Object.fromEntries(volume.map((v) => [v.group, v.sets]));
  assert.equal(sets.quads, 8.5, "8 squat sets + half of the bike - the bike's quads count as secondary");
  assert.equal(sets.glutes, 11, "8 squat + 3 RDL");
  assert.equal(sets.hamstrings, 3);
  assert.equal(sets.chest, 5);
  assert.equal(sets.lower_back, 5.5, "half of 8 squats and 3 RDLs");
  assert.equal(sets.conditioning, undefined);
  assert.equal(sets.hip_flexors, undefined, "the warm-up drill isn't counted");
});

test("a coach sees the week's sets per muscle group, a very high group flagged, and the major groups with no direct work", () => {
  render(<WeeklyMuscleVolume items={[
    { exercise_id: "back_squat", planned_sets: 10, segment: "working" },
    { exercise_id: "leg_extension", planned_sets: 18, segment: "working" }
  ]} exercises={exercises} />);
  assert.ok(screen.getByText(/Sets per muscle group: Quads 28/u));
  assert.ok(screen.getByText("Very high - check recovery"), "28 sets of quads");
  assert.ok(screen.getByText(/No direct work: Shoulders, Chest, Back and lats, Hamstrings\./u));
});

test("progress insights show what the athlete actually logged over the last 7 days", () => {
  render(<LoggedMuscleVolume weekly={{ window_days: 7, groups: [{ group: "quads", label: "Quads", sets: 12 }, { group: "chest", label: "Chest", sets: 4.5 }] }} />);
  assert.ok(screen.getByText(/Sets per muscle group, last 7 days: Quads 12 · Chest 4\.5/u));
  const { container } = render(<LoggedMuscleVolume weekly={{ window_days: 7, groups: [] }} />);
  assert.equal(container.textContent, "", "nothing logged, nothing shown");
});
