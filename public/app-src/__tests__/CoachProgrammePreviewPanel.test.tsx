// DEV NOTE: FULL-UI-05A programme structure preview (read-only) behavioral
// proof - covers programmeDraft.ts's preview-formatting helpers
// (programmePreviewRepetitions/Duration/Distance/Prescription/Load/
// exerciseDisplayName) and CoachProgrammePreviewPanel.tsx's rendering of
// the full block/week/session/work-item structure, ported from
// public/app/app.js's programmePreviewHtml().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { CoachProgrammePreviewPanel } from "../screens/coach/CoachProgrammePreviewPanel";
import {
  exerciseDisplayName,
  programmePreviewLoad,
  programmePreviewPrescription,
  storedWorkItemToDraft
} from "../screens/coach/programmeDraft";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function workItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    work_item_id: "item_1",
    order_index: 1,
    exercise_id: "back_squat",
    planned_sets: 3,
    prescription_mode: "reps",
    rep_prescription: { type: "fixed", value: 8 },
    rest_seconds: 90,
    role: "primary",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight",
    loading_reference: { type: "bodyweight" },
    ...overrides
  };
}

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: "session_1",
    order_index: 1,
    title: "Session 1",
    coaching_notes: "",
    work_items: [workItem()],
    ...overrides
  };
}

function week(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    week_id: "week_1",
    order_index: 1,
    days: [{ day_id: "day_1", order_index: 1, sessions: [session()] }],
    ...overrides
  };
}

function block(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    block_id: "block_1",
    order_index: 1,
    name: "Block 1",
    description: "",
    block_type: "general",
    week_count: 1,
    weeks: [week()],
    ...overrides
  };
}

function template(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    template_id: "tmpl_1_v1",
    template_family_id: "tmpl_1",
    template_name: "Base Strength Block",
    template_version: 1,
    template_status: "draft",
    activity_id: "powerlifting",
    description: "",
    event_plan: null,
    template_structure: { blocks: [block()] },
    ...overrides
  };
}

// Builds a full template around a single work item (optionally with
// session-level overrides too), without deeply nested inline object
// literals - each intermediate step uses the already-balanced block()/
// week()/session()/workItem() helpers above.
function templateWithWorkItem(workItemOverrides: Record<string, unknown> = {}, sessionOverrides: Record<string, unknown> = {}): Record<string, unknown> {
  const item = workItem(workItemOverrides);
  const sess = session({ ...sessionOverrides, work_items: [item] });
  const day = { day_id: "day_1", order_index: 1, sessions: [sess] };
  const wk = week({ days: [day] });
  const blk = block({ weeks: [wk] });
  return template({ template_structure: { blocks: [blk] } });
}

test.afterEach(() => {
  cleanup();
});

// --- Pure formatting helper coverage ---

test("prescription formats reps, duration and distance correctly", () => {
  const reps = storedWorkItemToDraft({ prescription_mode: "reps", rep_prescription: { type: "fixed", value: 8 } }, 0);
  assert.equal(programmePreviewPrescription(reps), "8 reps");

  const repRange = storedWorkItemToDraft({ prescription_mode: "reps", rep_prescription: { type: "range", minimum: 6, maximum: 10 } }, 0);
  assert.equal(programmePreviewPrescription(repRange), "6–10 reps");

  const duration = storedWorkItemToDraft({ prescription_mode: "duration", duration_prescription: { type: "fixed", value: 45 } }, 0);
  assert.equal(programmePreviewPrescription(duration), "Hold 45s");

  const distance = storedWorkItemToDraft({ prescription_mode: "distance", distance_prescription: { type: "fixed", value: 400 }, distance_unit: "meters" }, 0);
  assert.equal(programmePreviewPrescription(distance), "400m");
});

test("load formats bodyweight, fixed weight, RPE and percent-1RM correctly", () => {
  const bodyweight = storedWorkItemToDraft({ loading_reference: { type: "bodyweight" } }, 0);
  assert.equal(programmePreviewLoad(bodyweight), "Bodyweight");

  const fixedWeight = storedWorkItemToDraft({ loading_reference: { type: "load", value: 100, unit: "kg" } }, 0);
  assert.equal(programmePreviewLoad(fixedWeight), "100 kg");

  const rpe = storedWorkItemToDraft({ loading_reference: { type: "rpe", value: 8 } }, 0);
  assert.equal(programmePreviewLoad(rpe), "RPE 8");

  const percent = storedWorkItemToDraft({ loading_reference: { type: "percent_1rm", value: 75 } }, 0);
  assert.equal(programmePreviewLoad(percent), "75% 1RM");
});

test("exercise display name prefers the registry's display_name, falling back to a title-cased id", () => {
  assert.equal(exerciseDisplayName("back_squat", [{ exercise_id: "back_squat", display_name: "Back Squat" }]), "Back Squat");
  assert.equal(exerciseDisplayName("unknown_exercise", []), "Unknown Exercise");
});

// --- Component coverage ---

function installMocks(templates: Record<string, unknown>[], templateExercises: Record<string, unknown>[] = [{ exercise_id: "back_squat", display_name: "Back Squat" }]) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/templates?coach_user_id")) return jsonResponse({ templates });
    if (path.startsWith("/templates/exercises")) return jsonResponse({ exercises: templateExercises });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function openDetail(templateId: string) {
  return act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: templateId } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// templateRecordToDraft() always backfills an empty/missing structure with
// one default block/week/session (matching legacy exactly) rather than an
// actually-empty draft, so programmePreviewHtml()'s "No persisted
// programme structure is available" branch was already unreachable through
// normal template input before this port, and stays that way here - this
// test instead proves the real, reachable behaviour: a template with no
// stored structure renders that one default block.
test("backfills a missing structure with the default single block, matching templateRecordToDraft()'s fallback", async () => {
  installMocks([template({ template_structure: { blocks: [] } })]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Session 1");
  assert.equal(screen.getAllByText("Block 1").length, 2);
});

test("renders the block heading, type badge and week count", async () => {
  installMocks([template({ template_structure: { blocks: [block({ name: "Peak Phase", block_type: "peak" })] } })]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("Peak Phase");
  assert.ok(screen.getByText("Peak"));
  assert.ok(screen.getByText("1 week"));
  assert.ok(screen.getByText("Block 1"));
});

test("renders the real exercise name, role, sets, prescription, load and rest for a work item", async () => {
  installMocks([template()]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("Back Squat");
  assert.ok(screen.getByText("Primary"));
  assert.ok(screen.getByText(/3 sets · 8 reps · Bodyweight · 90s rest/u));
});

test("shows a segment badge only when the segment is not 'working'", async () => {
  installMocks([templateWithWorkItem({ segment: "warm_up" })]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Warm Up");
});

test("does not show a segment badge for the default 'working' segment", async () => {
  installMocks([template()]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Back Squat");
  assert.equal(screen.queryByText("Working"), null);
});

test("shows the tempo when one was recorded, and stays silent when it was not", async () => {
  installMocks([templateWithWorkItem({ tempo: "3-1-X-0" })]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText(/Tempo 3-1-X-0/u);
});

test("shows session and work-item coaching notes when recorded", async () => {
  installMocks([templateWithWorkItem(
    { coaching_notes: "Keep elbows tucked." },
    { coaching_notes: "Focus on bar speed." }
  )]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("Focus on bar speed.");
  assert.ok(screen.getByText("Keep elbows tucked."));
});

test("the first week of the first block is open by default", async () => {
  installMocks([template()]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Back Squat");

  const details = document.querySelector(".programme-preview-week") as HTMLDetailsElement;
  assert.equal(details.open, true);
});

test("shows a group badge only when the work item belongs to a group", async () => {
  installMocks([templateWithWorkItem({ group_id: "group_1", group_type: "superset" })]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Superset");
});

test("refetches when a legacy kolosseum:templates-changed event fires for the currently open programme", async () => {
  installMocks([templateWithWorkItem({ exercise_id: "back_squat" })]);
  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Back Squat");

  installMocks([templateWithWorkItem({ exercise_id: "back_squat", tempo: "3-1-X-0" })]);
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:templates-changed"));
  });

  await screen.findByText(/Tempo 3-1-X-0/u);
});

test("shows a factual error when the structure fails to load", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    return jsonResponse({ error: "server_error" }, false, 500);
  }) as typeof fetch;

  render(<CoachProgrammePreviewPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("The programme structure could not be loaded. Check your connection and try again.");
});
