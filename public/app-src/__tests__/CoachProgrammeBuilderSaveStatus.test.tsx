// DEV NOTE: FULL-UI-05B programme builder save-state badge/detail
// behavioral proof - covers builderSaveStatus() (programmeDraft.ts,
// ported from public/app/app.js's renderTemplateBuilderState()) and
// CoachProgrammeBuilderSaveStatus.tsx's rendering of it, driven by the
// kolosseum:programme-draft-changed bridge event the still-legacy
// builder broadcasts (see useProgrammeBuilderDraft.ts's own DEV NOTE).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { CoachProgrammeBuilderSaveBadge, CoachProgrammeBuilderSaveDetail } from "../screens/coach/CoachProgrammeBuilderSaveStatus";
import { builderSaveStatus, newTemplateBlock, type ProgrammeDraft } from "../screens/coach/programmeDraft";

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

function broadcast(detail: { draft: ProgrammeDraft | null; saving?: boolean; saveError?: string; dirty?: boolean; recovered?: boolean; savedAt?: string }) {
  return act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:programme-draft-changed", { detail }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test.afterEach(() => {
  cleanup();
});

test("builderSaveStatus reports each mutually-exclusive state in priority order", () => {
  assert.deepEqual(
    builderSaveStatus({ draft: null, saving: false, saveError: "", dirty: false, recovered: false, savedAt: "" }),
    { label: "No draft open", badgeClass: "badge neutral", detail: "Open or create a programme to begin." }
  );

  const openDraft = draft();
  assert.deepEqual(
    builderSaveStatus({ draft: openDraft, saving: true, saveError: "", dirty: true, recovered: false, savedAt: "" }),
    { label: "Saving…", badgeClass: "badge active", detail: "Writing the draft to the server." }
  );

  assert.deepEqual(
    builderSaveStatus({ draft: openDraft, saving: false, saveError: "Network error.", dirty: true, recovered: false, savedAt: "" }),
    { label: "Save failed", badgeClass: "badge warning", detail: "Network error." }
  );

  assert.deepEqual(
    builderSaveStatus({ draft: openDraft, saving: false, saveError: "", dirty: true, recovered: true, savedAt: "" }),
    { label: "Unsaved changes", badgeClass: "badge warning", detail: "Recovered browser changes have not been saved to the server." }
  );

  assert.deepEqual(
    builderSaveStatus({ draft: openDraft, saving: false, saveError: "", dirty: true, recovered: false, savedAt: "" }),
    { label: "Unsaved changes", badgeClass: "badge warning", detail: "Changes are preserved in this browser but not yet saved to the server." }
  );

  assert.deepEqual(
    builderSaveStatus({ draft: draft({ template_id: "tmpl_1" }), saving: false, saveError: "", dirty: false, recovered: false, savedAt: "" }),
    { label: "Saved", badgeClass: "badge complete", detail: "This draft matches the server record." }
  );

  assert.deepEqual(
    builderSaveStatus({ draft: draft(), saving: false, saveError: "", dirty: false, recovered: false, savedAt: "" }),
    { label: "New draft", badgeClass: "badge neutral", detail: "Enter programme details, then save the draft." }
  );
});

test("shows a factual Saved-at date once savedAt is recorded for a persisted, clean draft", () => {
  const status = builderSaveStatus({
    draft: draft({ template_id: "tmpl_1" }),
    saving: false,
    saveError: "",
    dirty: false,
    recovered: false,
    savedAt: "2026-08-01T00:00:00.000Z"
  });
  assert.match(status.detail, /^Last saved /u);
});

test("badge shows No draft open before any broadcast arrives", () => {
  render(<CoachProgrammeBuilderSaveBadge />);
  assert.ok(screen.getByText("No draft open"));
});

test("badge and detail update together when the legacy builder broadcasts a new draft", async () => {
  render(
    <>
      <CoachProgrammeBuilderSaveBadge />
      <CoachProgrammeBuilderSaveDetail />
    </>
  );
  await broadcast({ draft: draft() });

  await screen.findByText("New draft");
  assert.ok(screen.getByText("Enter programme details, then save the draft."));
});

test("shows Saving… while a save is in flight, then Save failed on a real error", async () => {
  render(<CoachProgrammeBuilderSaveBadge />);
  await broadcast({ draft: draft(), saving: true });
  await screen.findByText("Saving…");

  await broadcast({ draft: draft(), saving: false, saveError: "The draft could not be saved." });
  await screen.findByText("Save failed");
});

test("clears back to No draft open once the legacy builder broadcasts a null draft (closed)", async () => {
  render(<CoachProgrammeBuilderSaveBadge />);
  await broadcast({ draft: draft() });
  await screen.findByText("New draft");

  await broadcast({ draft: null });
  await screen.findByText("No draft open");
});
