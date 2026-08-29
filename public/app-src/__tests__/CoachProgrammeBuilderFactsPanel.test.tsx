// DEV NOTE: FULL-UI-05B programme builder facts (read-only) behavioral
// proof - covers templateCounts() (programmeDraft.ts, ported from
// public/app/app.js) and CoachProgrammeBuilderFactsPanel.tsx's rendering
// of it, driven by the kolosseum:programme-draft-changed bridge event the
// still-legacy builder broadcasts (see useProgrammeBuilderDraft.ts's own
// DEV NOTE).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { CoachProgrammeBuilderFactsPanel } from "../screens/coach/CoachProgrammeBuilderFactsPanel";
import { newTemplateBlock, newTemplateWeek, templateCounts, type ProgrammeDraft } from "../screens/coach/programmeDraft";

function draft(overrides: Partial<ProgrammeDraft> = {}): ProgrammeDraft {
  return {
    template_id: "",
    template_family_id: "",
    template_version: 1,
    template_status: "draft",
    template_name: "",
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

function broadcast(value: ProgrammeDraft | null) {
  return act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:programme-draft-changed", { detail: { draft: value } }));
  });
}

test.afterEach(() => {
  cleanup();
});

test("templateCounts sums weeks and sessions across every block", () => {
  const twoBlockDraft = draft({
    blocks: [
      newTemplateBlock(1),
      { ...newTemplateBlock(2), weeks: [newTemplateWeek(1), newTemplateWeek(2)] }
    ]
  });
  const counts = templateCounts(twoBlockDraft);
  assert.deepEqual(counts, { blocks: 2, weeks: 3, sessions: 3 });
});

test("templateCounts treats a missing/null draft as zero blocks", () => {
  assert.deepEqual(templateCounts(null), { blocks: 0, weeks: 0, sessions: 0 });
  assert.deepEqual(templateCounts(undefined), { blocks: 0, weeks: 0, sessions: 0 });
});

test("renders nothing until the legacy builder broadcasts an open draft", () => {
  const { container } = render(<CoachProgrammeBuilderFactsPanel />);
  assert.equal(container.innerHTML, "");
});

test("renders the version, block, week and session counts for the broadcast draft", async () => {
  render(<CoachProgrammeBuilderFactsPanel />);
  await broadcast(draft({ template_version: 3 }));

  await screen.findByText("3");
  assert.equal(screen.getAllByText("1").length, 3);
});

test("re-renders when the legacy builder broadcasts an updated draft (e.g. a block was added)", async () => {
  render(<CoachProgrammeBuilderFactsPanel />);
  await broadcast(draft());
  assert.equal(screen.getAllByText("1").length, 4);

  await broadcast(draft({ blocks: [newTemplateBlock(1), newTemplateBlock(2)] }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(screen.getAllByText("2").length, 3);
});

test("clears back to nothing once the legacy builder broadcasts a null draft (closed)", async () => {
  const { container } = render(<CoachProgrammeBuilderFactsPanel />);
  await broadcast(draft());
  assert.equal(screen.getAllByText("1").length, 4);

  await broadcast(null);
  assert.equal(container.innerHTML, "");
});
