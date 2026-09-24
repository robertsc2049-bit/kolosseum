// DEV NOTE: FULL-UI-05B programme builder event-plan detail fields
// behavioral proof - covers CoachProgrammeEventFields.tsx's rendering of
// the name/type/dates/location/timezone/notes controls, driven by the
// kolosseum:programme-draft-changed bridge event the still-legacy
// builder broadcasts (see useProgrammeBuilderDraft.ts's own DEV NOTE).
// The mutation behavior itself (the new delegated
// elements.templateEventFieldsRoot input/change listeners driving
// updateTemplateEventField()) is still legacy code, verified live
// against a real seeded coach account (see PR description) rather than
// re-implemented in this test file.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { CoachProgrammeEventFields } from "../screens/coach/CoachProgrammeEventFields";
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

function eventPlan(overrides: Record<string, unknown> = {}) {
  return {
    event_plan_id: "",
    event_name: "",
    event_type: "powerlifting_meet",
    event_date: "2026-11-21",
    programme_start_date: "2026-08-29",
    location: "",
    timezone: "Europe/London",
    notes: "",
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
  const { container } = render(<CoachProgrammeEventFields />);
  assert.equal(container.innerHTML, "");
});

test("renders nothing while the draft has no event plan (the compiler toggle is off)", async () => {
  const { container } = render(<CoachProgrammeEventFields />);
  await broadcast(draft());
  assert.equal(container.innerHTML, "");
});

test("renders the event fields pre-filled from the broadcast event plan, scoped to the activity's event types", async () => {
  render(<CoachProgrammeEventFields />);
  await broadcast(draft({ event_plan: eventPlan({ event_name: "British Championships" }) }));

  const nameInput = screen.getByDisplayValue("British Championships") as HTMLInputElement;
  assert.equal(nameInput.getAttribute("data-template-kind"), "event");
  assert.equal(nameInput.getAttribute("data-field"), "event_name");

  assert.ok(screen.getByText("Powerlifting meet"));
  assert.equal(screen.queryByText("Rugby match"), null);
});

test("scopes event type options to a rugby activity", async () => {
  render(<CoachProgrammeEventFields />);
  await broadcast(draft({ activity_id: "rugby_union", event_plan: eventPlan({ event_type: "rugby_match" }) }));

  await screen.findByText("Rugby match");
  assert.equal(screen.queryByText("Powerlifting meet"), null);
});

test("disables every field once the programme is bound to a standalone event", async () => {
  render(<CoachProgrammeEventFields />);
  await broadcast(draft({ bound_event_id: "event_1", event_plan: eventPlan() }));

  const nameInput = await screen.findByPlaceholderText("British Championships") as HTMLInputElement;
  assert.equal(nameInput.disabled, true);
  assert.equal((document.querySelector('textarea[data-field="notes"]') as HTMLTextAreaElement).disabled, true);
});

test("clears back to nothing once the legacy builder broadcasts a null draft (closed)", async () => {
  const { container } = render(<CoachProgrammeEventFields />);
  await broadcast(draft({ event_plan: eventPlan() }));
  await screen.findByPlaceholderText("British Championships");

  await broadcast(null);
  assert.equal(container.innerHTML, "");
});
