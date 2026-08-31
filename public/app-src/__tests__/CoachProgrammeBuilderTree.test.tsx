// DEV NOTE: FULL-UI-05B programme builder tree behavioral proof - covers
// CoachProgrammeBuilderTree.tsx's rendering of the block/week/session/
// work-item structure, driven by the kolosseum:programme-draft-changed
// bridge event the still-legacy builder broadcasts (see
// useProgrammeBuilderDraft.ts's own DEV NOTE). This file asserts markup/
// data-attribute shape (what the still-legacy delegated click/input/
// change listeners on #templateBlocks depend on) - the mutation behavior
// itself was verified live against a real seeded coach account (see PR
// description), since it's all still legacy code, unchanged by this port.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachProgrammeBuilderTree } from "../screens/coach/CoachProgrammeBuilderTree";
import {
  newTemplateBlock,
  newTemplateSession,
  newTemplateWeek,
  storedWorkItemToDraft,
  type ProgrammeBlockDraft,
  type ProgrammeDraft
} from "../screens/coach/programmeDraft";

function draft(overrides: Partial<ProgrammeDraft> = {}): ProgrammeDraft {
  return {
    template_id: "",
    template_family_id: "",
    template_version: 1,
    template_status: "draft",
    template_name: "Base Strength Block",
    description: "",
    activity_id: "powerlifting",
    event_plan: null,
    event_compile_summary: null,
    bound_event_id: "",
    bound_event_record_sha256: "",
    blocks: [newTemplateBlock(1)],
    ...overrides
  };
}

// Builds a draft around one fully-specified work item, avoiding the
// default newTemplateBlock()/Session() scaffolding's four blank work
// items (each missing an exercise_id) - built via intermediate named
// variables rather than one deeply-nested inline literal (see
// CoachProgrammePreviewPanel.test.tsx's own precedent for why).
function draftWithWorkItem(workItemOverrides: Record<string, unknown> = {}, blockOverrides: Partial<ProgrammeBlockDraft> = {}): ProgrammeDraft {
  const item = storedWorkItemToDraft({ exercise_id: "back_squat", ...workItemOverrides }, 0);
  const session = { ...newTemplateSession(1), work_items: [item] };
  const week = { ...newTemplateWeek(1), sessions: [session] };
  const block = { ...newTemplateBlock(1), weeks: [week], ...blockOverrides };
  return draft({ blocks: [block] });
}

function broadcast(value: ProgrammeDraft | null) {
  return act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:programme-draft-changed", { detail: { draft: value } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the legacy builder broadcasts an open draft", () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  assert.equal(container.innerHTML, "");
});

test("renders one card per block/week/session/work-item with the exact legacy CSS classes", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem());

  assert.equal(container.querySelectorAll(".template-block").length, 1);
  assert.equal(container.querySelectorAll(".template-week").length, 1);
  assert.equal(container.querySelectorAll(".template-session").length, 1);
  assert.equal(container.querySelectorAll(".template-work-item").length, 1);
});

test("every field control carries the exact data-template-kind/data-*-index/data-field attributes the legacy delegated handlers key off", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem());

  const blockNameInput = container.querySelector('input[data-template-kind="block"][data-field="name"]') as HTMLInputElement;
  assert.ok(blockNameInput);
  assert.equal(blockNameInput.getAttribute("data-block-index"), "0");

  const exerciseSelect = container.querySelector('select[data-template-kind="work-item"][data-field="exercise_id"]') as HTMLSelectElement;
  assert.ok(exerciseSelect);
  assert.equal(exerciseSelect.getAttribute("data-block-index"), "0");
  assert.equal(exerciseSelect.getAttribute("data-week-index"), "0");
  assert.equal(exerciseSelect.getAttribute("data-session-index"), "0");
  assert.equal(exerciseSelect.getAttribute("data-work-item-index"), "0");
});

test("defaults to reps prescription and percent-1RM loading, showing the matching fieldset legends", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem());

  const legends = [...container.querySelectorAll("fieldset legend")].map((el) => el.textContent);
  assert.deepEqual(legends, ["Repetitions", "Loading"]);
  assert.ok(screen.getByText("% 1RM"));
});

test("a duration-prescribed work item shows the duration fieldset instead of reps", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem({ prescription_mode: "duration" }));

  const legends = [...container.querySelectorAll("fieldset legend")].map((el) => el.textContent);
  assert.ok(legends.includes("Duration"));
  assert.ok(!legends.includes("Repetitions"));
});

test("a bodyweight-loaded work item shows the factual no-load note instead of a numeric field", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem({ loading_reference: { type: "bodyweight" } }));

  assert.ok(screen.getByText("No external load is prescribed."));
  assert.equal(container.querySelector('input[data-field="percent_1rm"]'), null);
});

test("an RPE-loaded work item defaults to the RPE entry mode, showing the raw rpe_value field and a reps-in-the-tank caption", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem({ loading_reference: { type: "rpe", value: 8 } }));

  const rpeInput = container.querySelector('input[data-field="rpe_value"]') as HTMLInputElement;
  assert.ok(rpeInput);
  assert.equal(rpeInput.value, "8");
  assert.equal(container.querySelector('input[data-field="rir_value"]'), null);
  assert.ok(screen.getByText("RPE 8 - 2 reps in the tank"));
});

test("switching an RPE work item's entry mode to reps-in-reserve shows a converted, correctly-tagged input instead", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem({ loading_reference: { type: "rpe", value: 8 } }));

  fireEvent.change(screen.getByText("Enter as").closest("label")!.querySelector("select")!, { target: { value: "rir" } });

  assert.equal(container.querySelector('input[data-field="rpe_value"]'), null);
  const rirInput = container.querySelector('input[data-field="rir_value"]') as HTMLInputElement;
  assert.ok(rirInput);
  assert.equal(rirInput.value, "2", "RPE 8 is 2 reps in reserve (10 - rpe)");
  assert.equal(rirInput.getAttribute("data-template-kind"), "work-item");
  assert.ok(screen.getByText("RPE 8 - 2 reps in the tank"), "the caption still reflects the same underlying effort level");

  fireEvent.change(rirInput, { target: { value: "4" } });
  assert.ok(screen.getByText("RPE 6 - 4 reps in the tank"), "typing a new RIR live-updates the caption to its equivalent RPE");
});

test("a grouped work item shows the grouping-type select and an Ungroup button, not Group with next", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem({ group_id: "group_1", group_type: "superset" }));

  assert.ok(container.querySelector('select[data-field="group_type"]'));
  assert.ok(screen.getByText("Ungroup"));
  assert.equal(screen.queryByText("Group with next"), null);
});

test("the sole block/week/session cannot be removed, but a second one can", async () => {
  render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem());
  assert.equal(screen.queryByText("Remove block"), null);

  const twoBlocks = draftWithWorkItem();
  twoBlocks.blocks.push(newTemplateBlock(2));
  cleanup();
  render(<CoachProgrammeBuilderTree />);
  await broadcast(twoBlocks);
  assert.equal(screen.getAllByText("Remove block").length, 2);
});

test("move up/down is disabled at the first/last block", async () => {
  const draftWithTwoBlocks = draftWithWorkItem();
  draftWithTwoBlocks.blocks.push(newTemplateBlock(2));
  render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithTwoBlocks);

  const upButtons = screen.getAllByLabelText("Move block up") as HTMLButtonElement[];
  const downButtons = screen.getAllByLabelText("Move block down") as HTMLButtonElement[];
  assert.equal(upButtons[0].disabled, true);
  assert.equal(downButtons[0].disabled, false);
  assert.equal(upButtons[1].disabled, false);
  assert.equal(downButtons[1].disabled, true);
});

test("Add week is disabled once a block reaches 52 weeks", async () => {
  const fullBlock = draftWithWorkItem();
  fullBlock.blocks[0].weeks = Array.from({ length: 52 }, (_, index) => newTemplateWeek(index + 1));
  render(<CoachProgrammeBuilderTree />);
  await broadcast(fullBlock);

  const addWeekButton = screen.getByText("+ Add week") as HTMLButtonElement;
  assert.equal(addWeekButton.disabled, true);
});

test("shows the event-bound calendar strip only when the draft has an event plan and the block has calendar dates", async () => {
  const boundDraft = draftWithWorkItem({}, { calendar_start_date: "2026-09-01", calendar_end_date: "2026-09-07" });
  boundDraft.event_plan = { event_name: "Nationals" };
  render(<CoachProgrammeBuilderTree />);
  await broadcast(boundDraft);

  assert.ok(document.querySelector(".block-calendar-strip"));
});

test("does not show the calendar strip when there is no bound event, even with calendar dates set", async () => {
  const unboundDraft = draftWithWorkItem({}, { calendar_start_date: "2026-09-01", calendar_end_date: "2026-09-07" });
  render(<CoachProgrammeBuilderTree />);
  await broadcast(unboundDraft);

  assert.equal(document.querySelector(".block-calendar-strip"), null);
});

test("re-renders when the legacy builder broadcasts an updated draft (e.g. a block was added)", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem());
  assert.equal(container.querySelectorAll(".template-block").length, 1);

  const twoBlocks = draftWithWorkItem();
  twoBlocks.blocks.push(newTemplateBlock(2));
  await broadcast(twoBlocks);
  assert.equal(container.querySelectorAll(".template-block").length, 2);
});

test("clears back to nothing once the legacy builder broadcasts a null draft (closed)", async () => {
  const { container } = render(<CoachProgrammeBuilderTree />);
  await broadcast(draftWithWorkItem());
  assert.equal(container.querySelectorAll(".template-block").length, 1);

  await broadcast(null);
  assert.equal(container.innerHTML, "");
});
