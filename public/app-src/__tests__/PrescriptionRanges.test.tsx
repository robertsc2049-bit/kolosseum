// Set ranges, % ranges and fixed-weight ranges, as a coach writes them and
// an athlete reads and logs them: "3–4 × 6–8 @ 70–75% 1RM" in the builder,
// "3–4 sets · 105–112.5 kg" on the session, and the 4th set offered as
// optional in the set logger.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { SetLogger } from "../screens/athlete/SetLogger";
import { workItemSummary } from "../screens/coach/CoachProgrammeBuilderTree";
import { programmePreviewLoad, programmePreviewSets, storedWorkItemToDraft } from "../screens/coach/programmeDraft";
import { exerciseDetails } from "../utils/format";

test.afterEach(() => cleanup());

test("a stored set range and load ranges come back into the builder as ranges", () => {
  const squat = storedWorkItemToDraft({ exercise_id: "back_squat", planned_sets: 3, set_prescription: { type: "range", minimum: 3, maximum: 4 }, loading_reference: { type: "percent_1rm", value: 70, maximum: 75 } }, 0);
  assert.deepEqual([squat.set_mode, squat.planned_sets, squat.planned_sets_max, squat.load_range_mode, squat.percent_1rm, squat.percent_1rm_max], ["range", 3, 4, "range", 70, 75]);
  const rdl = storedWorkItemToDraft({ exercise_id: "romanian_deadlift", planned_sets: 4, loading_reference: { type: "load", value: 100, maximum: 110, unit: "kg" } }, 1);
  assert.deepEqual([rdl.set_mode, rdl.load_range_mode, rdl.weight_value, rdl.weight_value_max], ["fixed", "range", 100, 110]);
  const plain = storedWorkItemToDraft({ exercise_id: "bench_press", planned_sets: 5, loading_reference: { type: "percent_1rm", value: 80 } }, 2);
  assert.deepEqual([plain.set_mode, plain.load_range_mode], ["fixed", "fixed"], "a programme written before ranges is unchanged");
});

test("the builder's one-line summary and the preview read the ranges", () => {
  const squat = storedWorkItemToDraft({ exercise_id: "back_squat", planned_sets: 3, set_prescription: { type: "range", minimum: 3, maximum: 4 }, rep_prescription: { type: "range", minimum: 6, maximum: 8 }, loading_reference: { type: "percent_1rm", value: 70, maximum: 75 }, rest_seconds: 150 }, 0);
  assert.equal(workItemSummary(squat), "3–4 × 6–8 @ 70–75% 1RM · 2:30 rest");
  assert.equal(programmePreviewSets(squat), "3–4 sets");
  assert.equal(programmePreviewLoad(squat), "70–75% 1RM");
  const rdl = storedWorkItemToDraft({ exercise_id: "romanian_deadlift", planned_sets: 4, loading_reference: { type: "load", value: 100, maximum: 110, unit: "kg" }, rest_seconds: 120 }, 1);
  assert.equal(workItemSummary(rdl), "4 × 5 @ 100–110 kg · 2:00 rest");
  assert.equal(programmePreviewLoad(rdl), "100–110 kg");
});

test("the athlete's session line reads the set range and the weight range - never the % behind it", () => {
  const squat = exerciseDetails({ sets: 3, set_range: { minimum: 3, maximum: 4 }, rep_range: { minimum: 6, maximum: 8 }, intensity: { type: "percent_1rm", value: 70, maximum: 75 }, resolved_load: { value: 105, maximum_value: 112.5, unit: "kg" }, rest_seconds: 150 });
  assert.deepEqual(squat, ["3–4 sets", "6–8 reps", "105–112.5 kg", "2:30 rest"]);
  const rdl = exerciseDetails({ sets: 4, reps: 8, intensity: { type: "load", value: 100, maximum: 110, unit: "kg" }, rest_seconds: 120 });
  assert.deepEqual(rdl, ["4 sets", "8 reps", "100–110 kg", "2:00 rest"]);
});

test("a set range offers the sets beyond the least as optional in the set logger", () => {
  render(<SetLogger exercise={{ exercise_id: "back_squat", sets: 3, set_range: { minimum: 3, maximum: 4 }, reps: 6, segment: "working" }} setLogs={[]} busy={false} logSet={async () => null} />);
  assert.ok(screen.getByText("Sets logged: 0 of 3–4"));
  assert.ok(screen.getByText("Set 3"));
  assert.ok(screen.getByText("Set 4 (optional)"));
  assert.equal(screen.queryByText("Set 5 (optional)"), null);
});

test("1 to 30 sets are allowed; past 12 the coach is asked to check, never blocked", async () => {
  const { draftToValidationRecord, programmeActivationIssues, newTemplateBlock, newTemplateSession, setsWarning } = await import("../screens/coach/programmeDraft");
  const issuesFor = (overrides: Record<string, unknown>) => {
    const item = { ...storedWorkItemToDraft({ exercise_id: "back_squat" }, 0), ...overrides };
    const block = newTemplateBlock(1);
    block.weeks[0] = { ...block.weeks[0], sessions: [{ ...newTemplateSession(1), work_items: [item] }] };
    const draft = { template_id: "", template_name: "Intervals", template_version: 1, description: "", activity_id: "powerlifting", blocks: [block] } as never;
    return programmeActivationIssues(draftToValidationRecord(draft), [{ exercise_id: "back_squat" }]).map((issue) => issue.code);
  };
  assert.equal(issuesFor({ planned_sets: 30 }).includes("planned_sets_invalid"), false, "30 sets is allowed (20 x 400 m intervals and the like)");
  assert.ok(issuesFor({ planned_sets: 31 }).includes("planned_sets_invalid"), "31 is not");
  assert.equal(setsWarning(12), null, "Westside's 12 x 2 needs no warning");
  assert.match(setsWarning(13) ?? "", /13 sets is a lot/u);
  assert.match(setsWarning(4, 15) ?? "", /15 sets/u, "the top of a set range counts");
  assert.equal(setsWarning(31), null, "past 30 it is an error, not a warning");
});
