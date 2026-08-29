// DEV NOTE: FULL-UI-05B programme builder completion validation list
// behavioral proof - covers draftToValidationRecord() (programmeDraft.ts,
// ported from public/app/app.js's templateDraftValidationRecord()) and
// CoachProgrammeBuilderValidationList.tsx's rendering of
// programmeActivationIssues() for a live editing draft, driven by the
// kolosseum:programme-draft-changed bridge event the still-legacy builder
// broadcasts (see useProgrammeBuilderDraft.ts's own DEV NOTE).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { CoachProgrammeBuilderValidationList } from "../screens/coach/CoachProgrammeBuilderValidationList";
import {
  draftToValidationRecord,
  newTemplateBlock,
  newTemplateSession,
  programmeActivationIssues,
  storedWorkItemToDraft,
  type ProgrammeDraft
} from "../screens/coach/programmeDraft";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

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

// Builds a draft around a single, fully-valid work item (the default
// newTemplateBlock()/Session() scaffolding fills every session with four
// BLANK work items - each missing an exercise_id, so it always fails
// validation - not a useful "valid draft" fixture on its own).
function draftWithWorkItem(workItemOverrides: Record<string, unknown> = {}, draftOverrides: Partial<ProgrammeDraft> = {}): ProgrammeDraft {
  const item = storedWorkItemToDraft({ exercise_id: "back_squat", ...workItemOverrides }, 0);
  const session = { ...newTemplateSession(1), work_items: [item] };
  const block = newTemplateBlock(1);
  block.weeks[0] = { ...block.weeks[0], sessions: [session] };
  return draft({ blocks: [block], ...draftOverrides });
}

function installMocks(templateExercises: Record<string, unknown>[] = [{ exercise_id: "back_squat" }]) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/templates/exercises")) return jsonResponse({ exercises: templateExercises });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
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

test("draftToValidationRecord round-trips through programmeActivationIssues with zero issues for a valid draft", () => {
  const record = draftToValidationRecord(draftWithWorkItem());
  const issues = programmeActivationIssues(record, [{ exercise_id: "back_squat" }]);
  assert.deepEqual(issues, []);
});

test("draftToValidationRecord round-trip flags a missing programme name, matching a persisted-record check", () => {
  const record = draftToValidationRecord(draftWithWorkItem({}, { template_name: "" }));
  const issues = programmeActivationIssues(record, [{ exercise_id: "back_squat" }]);
  assert.ok(issues.some((issue) => issue.code === "template_name_required"));
});

test("renders nothing until the legacy builder broadcasts an open draft", () => {
  installMocks();
  const { container } = render(<CoachProgrammeBuilderValidationList />);
  assert.equal(container.innerHTML, "");
});

test("shows a clean pass message for a fully valid draft", async () => {
  installMocks();
  render(<CoachProgrammeBuilderValidationList />);
  await broadcast(draftWithWorkItem());
  await screen.findByText(/All visible completion checks pass/u);
});

test("lists every issue with its path, message and code, as clickable builder-validation-index buttons", async () => {
  installMocks();
  render(<CoachProgrammeBuilderValidationList />);
  await broadcast(draftWithWorkItem({}, { template_name: "" }));

  await screen.findByText("Programme name is required.");
  assert.ok(screen.getByText("programme name"));
  assert.ok(screen.getByText("template_name_required"));
  const button = screen.getByText("template_name_required").closest("button") as HTMLElement;
  assert.equal(button.getAttribute("data-builder-validation-index"), "0");
});

test("re-renders when the legacy builder broadcasts an updated (now-fixed) draft", async () => {
  installMocks();
  render(<CoachProgrammeBuilderValidationList />);
  await broadcast(draftWithWorkItem({}, { template_name: "" }));
  await screen.findByText("template_name_required");

  await broadcast(draftWithWorkItem({}, { template_name: "Now Named" }));
  await screen.findByText(/All visible completion checks pass/u);
});

test("clears back to nothing once the legacy builder broadcasts a null draft (closed)", async () => {
  installMocks();
  const { container } = render(<CoachProgrammeBuilderValidationList />);
  await broadcast(draftWithWorkItem());
  await screen.findByText(/All visible completion checks pass/u);

  await broadcast(null);
  assert.equal(container.innerHTML, "");
});
