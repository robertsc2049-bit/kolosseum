// DEV NOTE: Attendance events slice 1 - coach create-form behavioral proof.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AttendanceEventCreatePanel } from "../screens/coach/AttendanceEventCreatePanel";

const COACH_USER_ID = "coach_test123";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  relationships?: Record<string, unknown>[];
  orgMemberships?: Record<string, unknown>[];
  orgRosters?: Record<string, Record<string, unknown>[]>;
  createResult?: { ok: boolean; status?: number; body?: unknown };
}) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: COACH_USER_ID }, csrf_token: "csrf-token" });
    }
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ relationships: options.relationships ?? [] });
    }
    if (path === "/coach-workspace/org-memberships") {
      return jsonResponse({ memberships: options.orgMemberships ?? [] });
    }
    if (path.startsWith("/attendance-events/org-roster/")) {
      const orgId = decodeURIComponent(path.slice("/attendance-events/org-roster/".length));
      return jsonResponse({ athletes: options.orgRosters?.[orgId] ?? [] });
    }
    if (path === "/attendance-events" && init?.method === "POST") {
      if (options.createResult && !options.createResult.ok) {
        return jsonResponse(options.createResult.body ?? { error: "attendance_event_title_invalid" }, false, options.createResult.status ?? 400);
      }
      return jsonResponse(
        options.createResult?.body ?? {
          ok: true,
          event: { event_id: "attendance_event_1", title: "Saturday class" },
          occurrences: [{ occurrence_id: "occ_1", occurrence_date: "2026-09-05" }],
          invites: []
        },
        true,
        201
      );
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when the coach has no connected athletes", async () => {
  installMocks({ relationships: [] });
  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("No connected athletes yet."));
});

test("lists only currently-accepted athletes as invite candidates, not invited/declined/revoked ones", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", relationship_state: "accepted" },
      { athlete_user_id: "athlete_2", display_name: "Sam Rivera", relationship_state: "invited" }
    ]
  });
  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("Jordan Lee"));
  assert.equal(screen.queryByText("Sam Rivera"), null);
});

test("creating an event with selected athletes submits the form and shows a success message", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee", relationship_state: "accepted" }
    ]
  });

  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("Jordan Lee"));

  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Saturday class" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-05" } });
  fireEvent.click(screen.getByLabelText("Jordan Lee"));

  let received: unknown;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID }, csrf_token: "csrf-token" });
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ relationships: [{ athlete_user_id: "athlete_1", display_name: "Jordan Lee", relationship_state: "accepted" }] });
    }
    if (path === "/attendance-events" && init?.method === "POST") {
      received = init.body ? JSON.parse(String(init.body)) : null;
      return jsonResponse({
        ok: true,
        event: { event_id: "attendance_event_1", title: "Saturday class" },
        occurrences: [],
        invites: []
      }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;

  await act(async () => {
    fireEvent.submit(screen.getByText("Create event").closest("form") as HTMLFormElement);
  });

  await waitFor(() => screen.getByText("Saturday class created."));
  assert.deepEqual((received as { athlete_user_ids?: string[] })?.athlete_user_ids, ["athlete_1"]);
  assert.equal((received as { title?: string })?.title, "Saturday class");
});

test("toggling repeats reveals recurrence fields, and a weekly series submits the expected recurrence_rule", async () => {
  installMocks({ relationships: [] });

  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("No connected athletes yet."));

  assert.equal(screen.queryByText("Frequency"), null, "recurrence fields hidden until repeats is toggled on");

  fireEvent.click(screen.getByLabelText("This event repeats"));
  await waitFor(() => screen.getByText("Frequency"));

  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "MWF class" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-07" } });
  fireEvent.click(screen.getByLabelText("Mon"));
  fireEvent.click(screen.getByLabelText("Wed"));
  fireEvent.change(screen.getByLabelText("Number of occurrences"), { target: { value: "5" } });

  let received: unknown;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID }, csrf_token: "csrf-token" });
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships: [] });
    if (path === "/attendance-events" && init?.method === "POST") {
      received = init.body ? JSON.parse(String(init.body)) : null;
      return jsonResponse({
        ok: true,
        event: { event_id: "attendance_event_1", title: "MWF class" },
        occurrences: [{ occurrence_id: "occ_1" }, { occurrence_id: "occ_2" }, { occurrence_id: "occ_3" }],
        invites: []
      }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;

  await act(async () => {
    fireEvent.submit(screen.getByText("Create event").closest("form") as HTMLFormElement);
  });

  await waitFor(() => screen.getByText("MWF class created (3 occurrences)."));
  const recurrence = (received as { recurrence_rule?: Record<string, unknown> })?.recurrence_rule;
  assert.equal(recurrence?.frequency, "weekly");
  assert.deepEqual(recurrence?.weekdays, ["mon", "wed"]);
  assert.deepEqual(recurrence?.ends, { type: "after_count", value: 5 });
});

test("the org-wide option is hidden without an active shared-mode org membership", async () => {
  installMocks({ relationships: [], orgMemberships: [{ org_id: "org_1", org_name: "Iron Barbell", membership_status: "invited", visibility_mode: "shared" }] });
  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("No connected athletes yet."));
  assert.equal(screen.queryByText("Who is this event for"), null, "an invited-not-active membership never offers the org-wide option");
});

test("selecting a shared team switches the picker to the org roster and submits an org-wide create request", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_own", display_name: "Own Athlete", relationship_state: "accepted" }],
    orgMemberships: [{ org_id: "org_1", org_name: "Iron Barbell", membership_status: "active", visibility_mode: "shared" }],
    orgRosters: { org_1: [{ athlete_user_id: "athlete_team", display_name: "Team Athlete" }] }
  });

  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("Own Athlete"));
  await waitFor(() => screen.getByText("Everyone in Iron Barbell"));

  fireEvent.click(screen.getByLabelText("Everyone in Iron Barbell"));
  await waitFor(() => screen.getByText("Team Athlete"));
  assert.equal(screen.queryByText("Own Athlete"), null, "switching to the org scope replaces the picker, it doesn't merge it");

  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Team practice" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-07" } });
  fireEvent.click(screen.getByLabelText("Team Athlete"));

  let received: unknown;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID }, csrf_token: "csrf-token" });
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships: [] });
    if (path === "/coach-workspace/org-memberships") return jsonResponse({ memberships: [] });
    if (path.startsWith("/attendance-events/org-roster/")) return jsonResponse({ athletes: [] });
    if (path === "/attendance-events" && init?.method === "POST") {
      received = init.body ? JSON.parse(String(init.body)) : null;
      return jsonResponse({
        ok: true,
        event: { event_id: "attendance_event_1", title: "Team practice", owner_scope: "org" },
        occurrences: [{ occurrence_id: "occ_1" }],
        invites: [{ athlete_user_id: "athlete_team" }]
      }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;

  await act(async () => {
    fireEvent.submit(screen.getByText("Create event").closest("form") as HTMLFormElement);
  });

  await waitFor(() => screen.getByText("Team practice created."));
  assert.equal((received as { owner_scope?: string })?.owner_scope, "org");
  assert.equal((received as { owner_org_id?: string })?.owner_org_id, "org_1");
  assert.deepEqual((received as { athlete_user_ids?: string[] })?.athlete_user_ids, ["athlete_team"]);
});

test("a rejected create shows a factual error message, not a generic one", async () => {
  installMocks({
    relationships: [],
    createResult: { ok: false, body: { error: "attendance_event_title_invalid" } }
  });

  render(<AttendanceEventCreatePanel />);
  await waitFor(() => screen.getByText("No connected athletes yet."));

  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-05" } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Create event").closest("form") as HTMLFormElement);
  });

  await waitFor(() => screen.getByText("attendance_event_title_invalid"));
});
