import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { LoggedMuscleVolume, WeeklyMuscleVolume } from "../components/WeeklyMuscleVolume";
import { weeklyMuscleVolume } from "../utils/muscleGroups";

test.afterEach(() => cleanup());

const exercises = new Map(Object.entries({
  back_squat: { muscle_groups: ["quads", "glutes"], secondary_muscle_groups: ["adductors", "lower_back", "calves_shins"] },
  romanian_deadlift: { muscle_groups: ["hamstrings", "glutes"], secondary_muscle_groups: ["lower_back", "forearms_grip"] },
  bench_press: { muscle_groups: ["chest"], secondary_muscle_groups: ["shoulders", "triceps"] },
  leg_extension: { muscle_groups: ["quads"], secondary_muscle_groups: [] },
  bike_ergometer: { muscle_groups: ["conditioning"], secondary_muscle_groups: ["quads"], volume_counted: false },
  box_jump: { muscle_groups: ["quads", "glutes"], secondary_muscle_groups: ["calves_shins"], volume_counted: false },
  wrist_roller: { muscle_groups: ["forearms_grip"], secondary_muscle_groups: [] },
  worlds_greatest_stretch: { muscle_groups: ["hip_flexors"], secondary_muscle_groups: [] }
}));

test("a powerlifting week: squats and RDLs count fully for their target groups and half for the rest; warm-ups, jumps and conditioning don't count", () => {
  const volume = weeklyMuscleVolume([
    { exercise_id: "worlds_greatest_stretch", planned_sets: 1, segment: "warm_up" },
    { exercise_id: "back_squat", planned_sets: 5, segment: "working" },
    { exercise_id: "romanian_deadlift", planned_sets: 3, segment: "working" },
    { exercise_id: "bench_press", planned_sets: 5, segment: "working" },
    { exercise_id: "back_squat__r2", planned_sets: 3, segment: "working" },
    { exercise_id: "bike_ergometer", planned_sets: 1, segment: "working" },
    { exercise_id: "box_jump", planned_sets: 4, segment: "working" },
    { exercise_id: "custom_zercher_lunge", planned_sets: 3, segment: "working" }
  ], exercises);
  const sets = Object.fromEntries(volume.map((v) => [v.group, v.sets]));
  assert.equal(sets.quads, 8, "8 squat sets - box jumps and the bike aren't hard strength sets");
  assert.equal(sets.glutes, 11, "8 squat + 3 RDL, no box jumps");
  assert.equal(sets.hamstrings, 3);
  assert.equal(sets.chest, 5);
  assert.equal(sets.lower_back, 5.5, "half of 8 squats and 3 RDLs");
  assert.equal(sets.conditioning, undefined);
  assert.equal(sets.hip_flexors, undefined, "the warm-up drill isn't counted");
});

test("a coach sees the week's sets per muscle group against the range for the level, a group over it flagged, and the major groups with no direct work", () => {
  render(<WeeklyMuscleVolume items={[
    { exercise_id: "back_squat", planned_sets: 10, segment: "working" },
    { exercise_id: "leg_extension", planned_sets: 18, segment: "working" }
  ]} exercises={exercises} />);
  assert.ok(screen.getByText(/Sets per muscle group: Quads 28 · Glutes and hips 10 · Lower back 5 \(1 over\)/));
  assert.ok(screen.getByText("Over 22 a week - check recovery"), "28 sets of quads for an amateur");
  assert.ok(screen.getByText("6-30 sets"), "glutes in range");
  assert.ok(screen.getByText(/No direct work: Shoulders, Chest, Back and lats, Hamstrings\./u));
  assert.ok(screen.getByText(/Ranges for Amateur/));
});

test("the coach picks the level to check against, and the choice holds for every week on the page", async () => {
  const items = [{ exercise_id: "leg_extension", planned_sets: 12, segment: "working" }];
  render(<><WeeklyMuscleVolume items={items} exercises={exercises} /><WeeklyMuscleVolume items={items} exercises={exercises} /></>);
  assert.equal(screen.getAllByText("8-22 sets").length, 2);
  await act(async () => { fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "pro" } }); });
    assert.equal(screen.getAllByText("10-26 sets").length, 2, "both weeks now read against Pro");
  await act(async () => { fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "beginner" } }); });
  assert.equal(screen.getAllByText("6-16 sets").length, 2);
  await act(async () => { fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "amateur" } }); });
});

test("a grip-sport athlete's 30 sets of forearm work aren't flagged - that's the sport - but a rugby player's would be", () => {
  const items = [{ exercise_id: "wrist_roller", planned_sets: 30, segment: "working" }];
  render(<WeeklyMuscleVolume items={items} exercises={exercises} activityId="grip_sport" />);
  assert.equal(screen.queryByText(/check recovery/), null);
  cleanup();
  render(<WeeklyMuscleVolume items={items} exercises={exercises} activityId="rugby_union" />);
  assert.ok(screen.getByText("Over 20 a week - check recovery"), "a rugby player's 30 sets of forearms is a lot");
});

test("logged volume uses the athlete's sport from the server", () => {
  render(<LoggedMuscleVolume weekly={{ window_days: 7, groups: [{ group: "quads", label: "Quads", sets: 27 }], activity_id: "olympic_weightlifting", level: "amateur" }} />);
  assert.equal(screen.queryByText("Very high - check recovery"), null, "a weightlifter's squat volume");
});

test("a pro's 32 sets of glutes in an accumulation block isn't flagged, but 36 is; an amateur's 32 is", () => {
  const week = (sets: number, level: string) => ({ window_days: 7, groups: [{ group: "glutes", label: "Glutes", sets }], level });
  render(<LoggedMuscleVolume weekly={week(32, "pro")} />);
  assert.equal(screen.queryByText("Very high - check recovery"), null, "pro, 32 sets");
  cleanup();
  render(<LoggedMuscleVolume weekly={week(36, "pro")} />);
  assert.ok(screen.getByText("Very high - check recovery"), "pro, 36 sets");
  cleanup();
  render(<LoggedMuscleVolume weekly={week(32, "amateur")} />);
  assert.ok(screen.getByText("Very high - check recovery"), "amateur, 32 sets");
});

test("the coach's view of logged sets shows the ranges; the athlete's own never does", () => {
  const weekly = { window_days: 7, groups: [{ group: "quads", label: "Quads", sets: 5 }, { group: "chest", label: "Chest", sets: 12 }], level: "amateur" };
  render(<LoggedMuscleVolume weekly={weekly} coach />);
  assert.ok(screen.getByText("Under 8 a week (8-22 sets)"));
  assert.ok(screen.getByText("8-22 sets"));
  cleanup();
  const { container } = render(<LoggedMuscleVolume weekly={weekly} />);
  assert.doesNotMatch(container.textContent ?? "", /sets a week|8-22|Under|Ranges/u);
});

test("progress insights show what the athlete actually logged over the last 7 days", () => {
  render(<LoggedMuscleVolume weekly={{ window_days: 7, groups: [{ group: "quads", label: "Quads", sets: 12 }, { group: "chest", label: "Chest", sets: 4.5 }] }} />);
  assert.ok(screen.getByText(/Sets per muscle group, last 7 days: Quads 12 · Chest 4\.5/u));
  const { container } = render(<LoggedMuscleVolume weekly={{ window_days: 7, groups: [] }} />);
  assert.equal(container.textContent, "", "nothing logged, nothing shown");
});
