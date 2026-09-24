// DEV NOTE: FULL-UI-05B programme builder identity fields behavioral
// proof - covers CoachProgrammeIdentityFields.tsx's rendering of the
// name/activity/description controls, driven by the
// kolosseum:programme-draft-changed bridge event the still-legacy
// builder broadcasts (see useProgrammeBuilderDraft.ts's own DEV NOTE).
// The mutation behavior itself (the new delegated
// elements.templateIdentityRoot input/change listeners driving
// updateTemplateIdentityField()) is still legacy code, verified live
// against a real seeded coach account (see PR description) rather than
// re-implemented in this test file.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { CoachProgrammeIdentityFields } from "../screens/coach/CoachProgrammeIdentityFields";
import { newTemplateBlock, type ProgrammeDraft } from "../screens/coach/programmeDraft";

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
  const { container } = render(<CoachProgrammeIdentityFields />);
  assert.equal(container.innerHTML, "");
});

test("renders the name/activity/description fields pre-filled from the broadcast draft", async () => {
  render(<CoachProgrammeIdentityFields />);
  await broadcast(draft({ template_name: "My Programme", activity_id: "rugby_union", description: "A note." }));

  const nameInput = screen.getByDisplayValue("My Programme") as HTMLInputElement;
  assert.equal(nameInput.id, "templateName");
  assert.equal(nameInput.getAttribute("data-template-kind"), "header");
  assert.equal(nameInput.getAttribute("data-field"), "template_name");

  const activitySelect = document.getElementById("templateActivity") as HTMLSelectElement;
  assert.equal(activitySelect.value, "rugby_union");
  assert.equal(activitySelect.getAttribute("data-field"), "activity_id");

  const descriptionField = screen.getByDisplayValue("A note.") as HTMLTextAreaElement;
  assert.equal(descriptionField.getAttribute("data-field"), "description");
});

// DEV NOTE: within one continuous open builder session, these fields only
// ever change because their OWN typing changed them (verified live - see
// PR description) - state.templateDraft.template_name never gets
// externally overwritten while the SAME draft stays open. The realistic
// "different values shown" scenario is closing one draft (draft -> null)
// and opening another (null -> a fresh draft), which - unlike an in-place
// value swap on an already-mounted uncontrolled input - forces a genuine
// unmount/remount, so defaultValue applies correctly to the new value.
test("shows the newly-opened draft's values after closing one draft and opening another", async () => {
  render(<CoachProgrammeIdentityFields />);
  await broadcast(draft({ template_name: "First Programme" }));
  await screen.findByDisplayValue("First Programme");

  await broadcast(null);
  await broadcast(draft({ template_name: "Second Programme", activity_id: "rugby_union" }));

  await screen.findByDisplayValue("Second Programme");
  assert.equal((document.getElementById("templateActivity") as HTMLSelectElement).value, "rugby_union");
});

test("clears back to nothing once the legacy builder broadcasts a null draft (closed)", async () => {
  const { container } = render(<CoachProgrammeIdentityFields />);
  await broadcast(draft());
  await screen.findByDisplayValue("Base Strength Block");

  await broadcast(null);
  assert.equal(container.innerHTML, "");
});
