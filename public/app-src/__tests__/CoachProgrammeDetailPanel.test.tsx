// DEV NOTE: FULL-UI-05A programme detail (read-only) behavioral proof -
// covers the facts/version-family/usage/actions moved out of
// public/app/app.js's renderProgrammeDetail(). The activation validation
// summary, structure preview and marketplace sharing/release sub-panel
// stay legacy (their own future slices) and are not covered here.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { CoachProgrammeDetailHeader, CoachProgrammeDetailPanel } from "../screens/coach/CoachProgrammeDetailPanel";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function template(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    template_id: "tmpl_1_v1",
    template_family_id: "tmpl_1",
    template_name: "Base Strength Block",
    template_version: 1,
    template_status: "draft",
    activity_id: "powerlifting",
    block_count: 1,
    week_count: 4,
    session_count: 3,
    updated_at_iso8601: "2026-08-01T10:00:00.000Z",
    description: "",
    event_plan: null,
    ...overrides
  };
}

function assignment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    assignment_id: "assign_1",
    template_id: "tmpl_1_v1",
    assigned_athlete_id: "athlete_1",
    assignment_status: "assigned",
    requested_at_iso8601: "2026-08-01T10:00:00.000Z",
    ...overrides
  };
}

function relationship(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    athlete_user_id: "athlete_1",
    display_name: "Alex Athlete",
    ...overrides
  };
}

function installMocks(options: {
  templates?: Record<string, unknown>[];
  assignments?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
}) {
  const { templates = [template()], assignments = [], relationships = [] } = options;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/templates?coach_user_id")) return jsonResponse({ templates });
    if (path.startsWith("/coach-workspace/assignments")) return jsonResponse({ assignments });
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function openDetail(templateId: string) {
  return act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: templateId } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test.afterEach(() => {
  cleanup();
});

test("shows a placeholder title until a programme is opened", () => {
  installMocks({});
  render(<CoachProgrammeDetailHeader />);
  const title = screen.getByRole("heading", { level: 3 });
  assert.equal(title.textContent, "Programme");
  assert.equal(title.id, "templateDetailTitle");
});

test("opening a programme shows its title, status badge, version and activity", async () => {
  installMocks({ templates: [template({ template_name: "Peak Block", template_status: "active" })] });
  render(<CoachProgrammeDetailHeader />);

  await openDetail("tmpl_1_v1");

  await screen.findByText("Peak Block");
  assert.equal((screen.getByRole("heading", { level: 3 })).id, "templateDetailTitle");
  assert.ok(screen.getByText("Active"));
  assert.ok(screen.getByText("Version 1"));
  assert.ok(screen.getByText("Powerlifting"));
});

test("shows facts, description and updated date once opened", async () => {
  installMocks({ templates: [template({ description: "A real programme description." })] });
  render(<CoachProgrammeDetailPanel />);

  await openDetail("tmpl_1_v1");

  await screen.findByText("A real programme description.");
  const facts = document.querySelector(".programme-detail-facts") as HTMLElement;
  assert.ok(within(facts).getByText("4")); // weeks
  assert.ok(within(facts).getByText("3")); // sessions
  assert.ok(within(facts).getByText(/1 Aug 2026/u));
});

test("shows a factual placeholder description when none was recorded", async () => {
  installMocks({ templates: [template({ description: "" })] });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("No programme description was recorded.");
});

test("draft programmes show Edit draft, Save complete template and Archive, but not Activate or Duplicate", async () => {
  installMocks({ templates: [template({ template_status: "draft" })] });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("Edit draft");
  assert.ok(screen.getByText("Save complete template"));
  assert.ok(screen.getByText("Archive programme"));
  assert.equal(screen.queryByText("Activate programme"), null);
  assert.equal(screen.queryByText("Duplicate version"), null);
});

test("complete programmes show Activate and Duplicate, not Edit or Save complete", async () => {
  installMocks({ templates: [template({ template_status: "complete" })] });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("Activate programme");
  assert.ok(screen.getByText("Duplicate version"));
  assert.equal(screen.queryByText("Edit draft"), null);
  assert.equal(screen.queryByText("Save complete template"), null);
});

test("archived programmes do not show an Archive action", async () => {
  installMocks({ templates: [template({ template_status: "archived" })] });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Duplicate version");
  assert.equal(screen.queryByText("Archive programme"), null);
});

test("the version family lists every version, marking the currently open one", async () => {
  installMocks({
    templates: [
      template({ template_id: "tmpl_1_v1", template_family_id: "tmpl_1", template_version: 1, template_status: "archived" }),
      template({ template_id: "tmpl_1_v2", template_family_id: "tmpl_1", template_version: 2, template_status: "active" })
    ]
  });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v2");

  await screen.findByText("Version metadata");
  const versionList = document.querySelector(".programme-version-list") as HTMLElement;
  const rows = within(versionList).getAllByRole("button");
  assert.equal(rows.length, 2);
  const currentRow = rows.find((row) => row.className.includes("current"));
  assert.ok(currentRow);
  assert.ok(within(currentRow!).getByText("Version 2"));
});

test("clicking a sibling version in the version family opens its own detail", async () => {
  installMocks({
    templates: [
      template({ template_id: "tmpl_1_v1", template_family_id: "tmpl_1", template_version: 1, template_status: "archived", template_name: "Old Version" }),
      template({ template_id: "tmpl_1_v2", template_family_id: "tmpl_1", template_version: 2, template_status: "active", template_name: "New Version" })
    ]
  });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v2");
  await screen.findByText("New Version");

  await act(async () => {
    fireEvent.click(screen.getByText("Old Version"));
  });

  assert.equal(window.location.hash, "#/coach/programmes/tmpl_1_v1");
  window.location.hash = "";
});

test("shows a factual empty state when no assignments use this exact version", async () => {
  installMocks({ templates: [template()], assignments: [] });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("No assignment records use this exact programme version.");
});

test("the usage list shows the real athlete name, assignment id and recorded date", async () => {
  installMocks({
    templates: [template()],
    assignments: [assignment({ assignment_id: "assign_7", assigned_athlete_id: "athlete_9", requested_at_iso8601: "2026-08-05T09:00:00.000Z" })],
    relationships: [relationship({ athlete_user_id: "athlete_9", display_name: "Jordan Coachee" })]
  });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("Jordan Coachee");
  assert.ok(screen.getByText("assign_7"));
  assert.equal(screen.getAllByText(/5 Aug 2026/u).length, 2);
  const usageSummary = document.querySelector(".programme-usage-summary") as HTMLElement;
  assert.equal(within(usageSummary).getByText("Assignments").closest("div")?.querySelector("strong")?.textContent, "1");
  assert.equal(within(usageSummary).getByText("Athletes").closest("div")?.querySelector("strong")?.textContent, "1");
});

test("action buttons dispatch bridge events with the template id, without porting the mutation itself", async () => {
  installMocks({ templates: [template({ template_status: "draft" })] });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Edit draft");

  let captured: { eventName: string; templateId: string } | null = null;
  const original = document.dispatchEvent.bind(document);
  document.dispatchEvent = ((event: Event) => {
    if (event instanceof CustomEvent && String(event.type).startsWith("kolosseum:") && event.type !== "kolosseum:open-programme-detail") {
      captured = { eventName: event.type, templateId: (event.detail as { template_id?: string })?.template_id ?? "" };
    }
    return original(event);
  }) as typeof document.dispatchEvent;

  try {
    fireEvent.click(screen.getByText("Save complete template"));
  }
  finally {
    document.dispatchEvent = original;
  }

  assert.deepEqual(captured, { eventName: "kolosseum:complete-programme", templateId: "tmpl_1_v1" });
});

test("refetches when a legacy kolosseum:templates-changed event fires for the currently open programme", async () => {
  installMocks({ templates: [template({ template_name: "Original Name" })] });
  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Original Name");

  installMocks({ templates: [template({ template_name: "Renamed After Mutation" })] });
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:templates-changed"));
  });

  await screen.findByText("Renamed After Mutation");
});

test("shows a factual error when the detail fails to load", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    return jsonResponse({ error: "server_error" }, false, 500);
  }) as typeof fetch;

  render(<CoachProgrammeDetailPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("The programme detail could not be loaded. Check your connection and try again.");
});
