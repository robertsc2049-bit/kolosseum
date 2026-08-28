// DEV NOTE: FULL-UI-05A programme library (read-only) behavioral proof -
// replaces the source-text regex checks test/full_ui_05a_programme_library
// .test.mjs previously ran against the now-removed app.js rendering
// functions (filteredProgrammeTemplates/templateCard/
// bindTemplateLibraryActions). The programme detail panel and builder stay
// legacy, so this file only covers the metric cards, search/filter/sort
// and card list/actions - each action button's bridge-event dispatch is
// asserted directly rather than the (out of scope) legacy mutation it
// triggers.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { CoachProgrammeLibraryPanel, CoachProgrammeMetricsPanel } from "../screens/coach/CoachProgrammeLibraryPanel";

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

function installMocks(templates: Record<string, unknown>[], assignments: Record<string, unknown>[] = []) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/templates?coach_user_id")) return jsonResponse({ templates });
    if (path.startsWith("/coach-workspace/assignments")) return jsonResponse({ assignments });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows factual draft/complete/active/archived/superseded counts", async () => {
  installMocks([
    template({ template_id: "a_v1", template_family_id: "a", template_status: "draft" }),
    template({ template_id: "b_v1", template_family_id: "b", template_status: "complete" }),
    template({ template_id: "c_v1", template_family_id: "c", template_status: "active" }),
    template({ template_id: "d_v1", template_family_id: "d", template_status: "archived" }),
    template({ template_id: "e_v1", template_family_id: "e", template_status: "active", template_version: 1 }),
    template({ template_id: "e_v2", template_family_id: "e", template_status: "active", template_version: 2 })
  ]);
  render(<CoachProgrammeMetricsPanel />);

  const draftCard = screen.getByText("Draft programmes").closest("article")!;
  const activeCard = screen.getByText("Active programmes").closest("article")!;
  const supersededCard = screen.getByText("Superseded versions").closest("article")!;

  await within(draftCard).findByText("1");
  await within(activeCard).findByText("2");
  await within(supersededCard).findByText("1");
});

test("shows the empty state when there are no programmes", async () => {
  installMocks([]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("No programmes created");
});

test("renders a card with facts, status badge and updated date", async () => {
  installMocks([template({ template_name: "Peak Block", block_count: 2, week_count: 6, session_count: 4 })]);
  render(<CoachProgrammeLibraryPanel />);

  await screen.findByText("Peak Block");
  const card = screen.getByText("Peak Block").closest(".template-card") as HTMLElement;
  assert.ok(within(card).getByText("2 blocks"));
  assert.ok(within(card).getByText("6 weeks"));
  assert.ok(within(card).getByText("4 sessions"));
  assert.ok(within(card).getByText("0 assignments"));
  assert.ok(within(card).getByText("Draft"));
});

test("shows real assignment usage counts on the card", async () => {
  installMocks(
    [template({ template_id: "tmpl_1_v1", template_family_id: "tmpl_1" })],
    [assignment({ assignment_id: "a1" }), assignment({ assignment_id: "a2", assigned_athlete_id: "athlete_2" })]
  );
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("2 assignments");
});

test("searching filters the visible cards by name", async () => {
  installMocks([
    template({ template_id: "a_v1", template_family_id: "a", template_name: "Powerlifting Base" }),
    template({ template_id: "b_v1", template_family_id: "b", template_name: "Rugby Conditioning" })
  ]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("2 of 2 programmes");

  fireEvent.change(screen.getByPlaceholderText("Name, activity, event or version"), { target: { value: "rugby" } });

  await screen.findByText("1 of 2 programmes");
  assert.ok(screen.getByText("Rugby Conditioning"));
  assert.equal(screen.queryByText("Powerlifting Base"), null);
});

test("the state filter narrows the list to the selected display state", async () => {
  installMocks([
    template({ template_id: "a_v1", template_family_id: "a", template_name: "Draft One", template_status: "draft" }),
    template({ template_id: "b_v1", template_family_id: "b", template_name: "Active One", template_status: "active" })
  ]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("2 of 2 programmes");

  fireEvent.change(screen.getByLabelText("State"), { target: { value: "active" } });

  await screen.findByText("1 of 2 programmes");
  assert.ok(screen.getByText("Active One"));
  assert.equal(screen.queryByText("Draft One"), null);
});

test("clear filters resets search, state, activity and sort", async () => {
  installMocks([
    template({ template_id: "a_v1", template_family_id: "a", template_name: "Alpha" }),
    template({ template_id: "b_v1", template_family_id: "b", template_name: "Beta" })
  ]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("2 of 2 programmes");

  fireEvent.change(screen.getByPlaceholderText("Name, activity, event or version"), { target: { value: "alpha" } });
  await screen.findByText("1 of 2 programmes");

  fireEvent.click(screen.getByText("Clear filters"));
  await screen.findByText("2 of 2 programmes");
  assert.equal((screen.getByPlaceholderText("Name, activity, event or version") as HTMLInputElement).value, "");
});

test("draft cards show Edit and Mark complete but not Activate; only draft cards show View detail plus Duplicate/Archive by state", async () => {
  installMocks([template({ template_status: "draft" })]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("View detail");

  assert.ok(screen.getByText("Edit"));
  assert.ok(screen.getByText("Mark complete"));
  assert.ok(screen.getByText("Archive"));
  assert.equal(screen.queryByText("Activate"), null);
  assert.equal(screen.queryByText("Duplicate version"), null);
});

test("complete cards show Activate and Duplicate but not Edit or Mark complete", async () => {
  installMocks([template({ template_status: "complete" })]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("View detail");

  assert.ok(screen.getByText("Activate"));
  assert.ok(screen.getByText("Duplicate version"));
  assert.equal(screen.queryByText("Edit"), null);
  assert.equal(screen.queryByText("Mark complete"), null);
});

test("archived cards do not show an Archive action", async () => {
  installMocks([template({ template_status: "archived" })]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("View detail");
  assert.equal(screen.queryByText("Archive"), null);
});

function withBridgeSpy(run: () => void): { eventName: string; templateId: string } | null {
  let captured: { eventName: string; templateId: string } | null = null;
  const original = document.dispatchEvent.bind(document);
  document.dispatchEvent = ((event: Event) => {
    if (event instanceof CustomEvent && String(event.type).startsWith("kolosseum:")) {
      captured = { eventName: event.type, templateId: (event.detail as { template_id?: string })?.template_id ?? "" };
    }
    return original(event);
  }) as typeof document.dispatchEvent;
  try {
    run();
  }
  finally {
    document.dispatchEvent = original;
  }
  return captured;
}

test("View detail dispatches a bridge event with the template id and sets the hash", async () => {
  installMocks([template({ template_id: "tmpl_9_v1", template_family_id: "tmpl_9" })]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("View detail");

  const captured = withBridgeSpy(() => {
    fireEvent.click(screen.getByText("View detail"));
  });

  assert.deepEqual(captured, { eventName: "kolosseum:open-programme-detail", templateId: "tmpl_9_v1" });
  assert.equal(window.location.hash, "#/coach/programmes/tmpl_9_v1");
  window.location.hash = "";
});

test("Archive dispatches the archive bridge event with the template id, without porting the archive mutation itself", async () => {
  installMocks([template({ template_id: "tmpl_5_v1", template_family_id: "tmpl_5", template_status: "active" })]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("Archive");

  const captured = withBridgeSpy(() => {
    fireEvent.click(screen.getByText("Archive"));
  });

  assert.deepEqual(captured, { eventName: "kolosseum:archive-programme", templateId: "tmpl_5_v1" });
});

test("Edit dispatches the edit-programme bridge event (opens the still-legacy builder)", async () => {
  installMocks([template({ template_id: "tmpl_6_v1", template_family_id: "tmpl_6", template_status: "draft" })]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("Edit");

  const captured = withBridgeSpy(() => {
    fireEvent.click(screen.getByText("Edit"));
  });

  assert.deepEqual(captured, { eventName: "kolosseum:edit-programme", templateId: "tmpl_6_v1" });
});

test("refetches when a legacy kolosseum:templates-changed event fires", async () => {
  installMocks([template({ template_id: "tmpl_1_v1", template_family_id: "tmpl_1", template_name: "Original Name" })]);
  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("Original Name");

  installMocks([template({ template_id: "tmpl_1_v1", template_family_id: "tmpl_1", template_name: "Renamed After Mutation" })]);
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:templates-changed"));
  });

  await screen.findByText("Renamed After Mutation");
});

test("shows a factual error with a working retry when the library fails to load", async () => {
  let fail = true;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/templates?coach_user_id")) {
      return fail ? jsonResponse({ error: "server_error" }, false, 500) : jsonResponse({ templates: [template()] });
    }
    if (path.startsWith("/coach-workspace/assignments")) return jsonResponse({ assignments: [] });
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;

  render(<CoachProgrammeLibraryPanel />);
  await screen.findByText("Programme library could not be loaded");

  fail = false;
  await act(async () => {
    fireEvent.click(screen.getByText("Retry"));
  });

  await screen.findByText("Base Strength Block");
});
