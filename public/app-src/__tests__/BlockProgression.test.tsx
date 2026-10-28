// A coach writes week 1 of a 6-week block (squat at 70% of max, 5 reps;
// bench at RPE 7; rows at 60 kg), duplicates it, then progresses the main
// lifts across the block in one go.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { BlockProgressionPanel, REPLACE_BLOCK_WEEKS_EVENT } from "../screens/coach/BlockProgressionPanel";
import { DEFAULT_PROGRESSION, isDeloadWeek, progressBlockWeeks, progressionPreview } from "../screens/coach/blockProgression";
import type { ProgrammeBlockDraft, ProgrammeWeekDraft, ProgrammeWorkItemDraft } from "../screens/coach/programmeDraft";

function item(exercise_id: string, extra: Partial<ProgrammeWorkItemDraft>): ProgrammeWorkItemDraft {
  return {
    work_item_id: "", order_index: 1, exercise_id, planned_sets: 4, set_mode: "fixed", planned_sets_max: 5, prescription_mode: "reps", rep_mode: "fixed",
    planned_reps: 5, rep_min: 5, rep_max: 5, tempo: "", duration_mode: "fixed", planned_duration_seconds: 30, duration_min_seconds: 20, duration_max_seconds: 40,
    distance_mode: "fixed", distance_unit: "meters", planned_distance_value: 20, distance_min_value: 10, distance_max_value: 30, load_mode: "percent_1rm",
    percent_1rm: 70, weight_value: 60, weight_unit: "kg", load_range_mode: "fixed", percent_1rm_max: 70, weight_value_max: 60, rpe_value: 7, borg_value: 13, cr10_value: 5,
    rest_seconds: 180, role: "primary", coaching_notes: "", segment: "working", group_id: "", group_type: "straight", group_time_cap_seconds: 0, group_round_seconds: 0, group_total_rounds: 0,
    ...extra
  };
}
function week(): ProgrammeWeekDraft {
  return {
    week_id: "", order_index: 1, calendar_start_date: "", calendar_end_date: "", days_until_event_at_week_start: null, partial_week: false,
    sessions: [{ session_id: "", order_index: 1, title: "Day A", coaching_notes: "", work_items: [
      item("back_squat", {}),
      item("bench_press", { load_mode: "rpe", rpe_value: 7 }),
      item("barbell_row", { load_mode: "fixed_weight", weight_value: 60, weight_value_max: 60, role: "accessory", planned_reps: 8, rep_min: 8, rep_max: 8 }),
      item("hip_mobility", { segment: "warm_up", role: "accessory" })
    ] }]
  };
}
const sixWeeks = () => Array.from({ length: 6 }, week);
const at = (weeks: ProgrammeWeekDraft[], w: number, i: number) => weeks[w].sessions[0].work_items[i];

test.afterEach(() => cleanup());

test("main lifts step up each week from week 1; accessories and warm-ups are left alone", () => {
  const weeks = progressBlockWeeks(sixWeeks(), DEFAULT_PROGRESSION);
  assert.deepEqual(weeks.map((_, w) => at(weeks, w, 0).percent_1rm), [70, 72.5, 75, 77.5, 80, 82.5]);
  assert.deepEqual(weeks.map((_, w) => at(weeks, w, 1).rpe_value), [7, 7.5, 8, 8.5, 9, 9.5]);
  assert.deepEqual(weeks.map((_, w) => at(weeks, w, 2).weight_value), [60, 60, 60, 60, 60, 60], "the row is an accessory");
  assert.deepEqual(weeks.map((_, w) => at(weeks, w, 3).percent_1rm), [70, 70, 70, 70, 70, 70], "warm-ups never");
  const all = progressBlockWeeks(sixWeeks(), { ...DEFAULT_PROGRESSION, scope: "loaded" });
  assert.deepEqual(all.map((_, w) => at(all, w, 2).weight_value), [60, 62.5, 65, 67.5, 70, 72.5], "every loaded exercise includes it");
});

test("a deload every 4th week is lighter with a set fewer; the build carries on after it", () => {
  const weeks = progressBlockWeeks(sixWeeks(), { ...DEFAULT_PROGRESSION, deload_every: 4 });
  assert.equal(isDeloadWeek(3, 4), true);
  assert.deepEqual(weeks.map((_, w) => at(weeks, w, 0).percent_1rm), [70, 72.5, 75, 67.5, 77.5, 80]);
  assert.deepEqual(weeks.map((_, w) => at(weeks, w, 0).planned_sets), [4, 4, 4, 3, 4, 4]);
  assert.equal(at(weeks, 3, 1).rpe_value, 7, "RPE 8.5 less 1.5 on the deload");
});

test("reps can come down as the load goes up; % never passes 100 and RPE never 10", () => {
  const weeks = progressBlockWeeks(sixWeeks(), { ...DEFAULT_PROGRESSION, pct_step: 10, rpe_step: 1, reps_step: -1 });
  assert.deepEqual(weeks.map((_, w) => at(weeks, w, 0).planned_reps), [5, 4, 3, 2, 1, 1]);
  assert.equal(at(weeks, 5, 0).percent_1rm, 100);
  assert.equal(at(weeks, 5, 1).rpe_value, 10);
});

test("an exercise that doesn't line up with week 1 is left as the coach wrote it", () => {
  const weeks = sixWeeks();
  weeks[2].sessions[0].work_items[0] = item("front_squat", { percent_1rm: 65 });
  const result = progressBlockWeeks(weeks, DEFAULT_PROGRESSION);
  assert.equal(at(result, 2, 0).percent_1rm, 65);
  assert.equal(at(result, 3, 0).percent_1rm, 77.5);
});

test("the preview reads week by week", () => {
  const [row] = progressionPreview(sixWeeks(), { ...DEFAULT_PROGRESSION, deload_every: 4 }, (id) => id.replaceAll("_", " "));
  assert.equal(row.label, "Day A: back squat");
  assert.deepEqual(row.weeks.slice(0, 4), ["4×5 @ 70%", "4×5 @ 72.5%", "4×5 @ 75%", "3×5 @ 67.5% (deload)"]);
});

test("the coach previews, confirms, applies and can undo", async () => {
  const block: ProgrammeBlockDraft = { block_id: "b1", order_index: 1, name: "Base", description: "", block_type: "strength", week_count: 6, calendar_start_date: "", calendar_end_date: "", weeks: sixWeeks() };
  const sent: ProgrammeWeekDraft[][] = [];
  const listener = (event: Event) => sent.push((event as CustomEvent).detail.weeks);
  document.addEventListener(REPLACE_BLOCK_WEEKS_EVENT, listener);
  let applied = 0;
  render(<BlockProgressionPanel block={block} blockIndex={0} exerciseName={(id) => id} onApplied={() => { applied += 1; }} />);
  assert.ok(screen.getByText(/W2 4×5 @ 72.5%/u));
  await act(async () => { fireEvent.click(screen.getByText("Progress weeks 2-6")); });
  await act(async () => { fireEvent.click(screen.getByText("Overwrite weeks 2-6")); });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][5].sessions[0].work_items[0].percent_1rm, 82.5);
  assert.equal(applied, 1);
  await act(async () => { fireEvent.click(screen.getByText("Undo")); });
  assert.equal(sent[1][5].sessions[0].work_items[0].percent_1rm, 70, "back as it was");
  document.removeEventListener(REPLACE_BLOCK_WEEKS_EVENT, listener);
});

test("a one-week block says to add weeks first", () => {
  const block: ProgrammeBlockDraft = { block_id: "b1", order_index: 1, name: "Base", description: "", block_type: "strength", week_count: 1, calendar_start_date: "", calendar_end_date: "", weeks: [week()] };
  render(<BlockProgressionPanel block={block} blockIndex={0} exerciseName={(id) => id} onApplied={() => undefined} />);
  assert.ok(screen.getByTestId("block-progression-hint"));
});
