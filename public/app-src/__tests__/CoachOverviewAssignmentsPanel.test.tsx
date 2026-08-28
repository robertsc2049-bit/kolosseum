// DEV NOTE: FULL-UI-03 Coach Overview "Action queue" behavioral proof -
// replaces the source-text regex checks
// test/full_ui_03_coach_dashboard.test.mjs previously ran against the
// now-removed app.js renderCoachDashboard() assignment-queue rendering
// block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { CoachOverviewAssignmentsPanel } from "../screens/coach/CoachOverviewAssignmentsPanel";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: { relationships?: Record<string, unknown>[]; assignments?: Record<string, unknown>[] }) {
  const { relationships = [], assignments = [] } = options;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships });
    if (path.startsWith("/coach-workspace/assignments")) return jsonResponse({ assignments });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state directing the coach to connect an athlete when there are no connected athletes", async () => {
  installMocks({ relationships: [], assignments: [] });
  render(<CoachOverviewAssignmentsPanel />);
  await waitFor(() => screen.getByText("No assignment actions"));
  assert.ok(screen.getByText("Connect an athlete before creating an assignment."));
});

test("shows a factual empty state when every connected athlete already has an assignment", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" }],
    assignments: [{ athlete_user_id: "athlete_1", template_id: "template_1" }]
  });
  render(<CoachOverviewAssignmentsPanel />);
  await waitFor(() => screen.getByText("No assignment actions"));
  assert.ok(screen.getByText("Every connected athlete has at least one recorded assignment."));
});

test("lists accepted athletes without a recorded assignment", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" },
      { athlete_user_id: "athlete_2", display_name: "Jordan", relationship_state: "accepted" },
      { athlete_user_id: "athlete_3", display_name: "Pending Pat", relationship_state: "invited" }
    ],
    assignments: [{ athlete_user_id: "athlete_1", template_id: "template_1" }]
  });

  render(<CoachOverviewAssignmentsPanel />);

  await waitFor(() => screen.getByText("Jordan"));
  assert.equal(screen.queryByText("Alex"), null);
  assert.equal(screen.queryByText("Pending Pat"), null);
  assert.ok(screen.getByText("No programme assignment is currently recorded."));
  assert.ok(screen.getByText("Action required"));
});

test("the Open profile button dispatches kolosseum:open-athlete-profile-request with focus_assignment", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" }],
    assignments: []
  });

  let received: { athlete_user_id?: string; focus_assignment?: boolean } | undefined;
  document.addEventListener("kolosseum:open-athlete-profile-request", (event) => {
    received = (event as CustomEvent).detail;
  });

  render(<CoachOverviewAssignmentsPanel />);
  await waitFor(() => screen.getByText("Open profile"));

  act(() => {
    screen.getByText("Open profile").click();
  });

  assert.deepEqual(received, { athlete_user_id: "athlete_1", focus_assignment: true });
});

test("an athlete name containing markup is rendered as inert text, never as HTML", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: '<img src=x onerror="window.pwned=true">', relationship_state: "accepted" }],
    assignments: []
  });

  render(<CoachOverviewAssignmentsPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:coach-overview-changed fires", async () => {
  installMocks({ relationships: [], assignments: [] });
  render(<CoachOverviewAssignmentsPanel />);
  await waitFor(() => screen.getByText("No assignment actions"));

  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" }],
    assignments: []
  });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-overview-changed"));
  });

  await waitFor(() => screen.getByText("Alex"));
});
