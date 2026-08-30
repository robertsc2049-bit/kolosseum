// DEV NOTE: Attendance events slice 1 - coach event list/detail/cancel
// behavioral proof.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AttendanceEventDetailPanel } from "../screens/coach/AttendanceEventDetailPanel";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(handler: (call: FetchCall) => Response | null) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const result = handler({ input, init });
    if (result) return result;
    return jsonResponse({ error: `unhandled_request_${String(input)}` }, false, 404);
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when the coach has no events yet", async () => {
  installMocks(({ input }) => {
    const path = String(input);
    if (path === "/attendance-events") return jsonResponse({ ok: true, events: [] });
    return null;
  });

  render(<AttendanceEventDetailPanel />);
  await waitFor(() => screen.getByText("No events created yet."));
});

test("lists the coach's own events and opens the selected event's detail with its roster", async () => {
  installMocks(({ input }) => {
    const path = String(input);
    if (path === "/attendance-events") {
      return jsonResponse({
        ok: true,
        events: [{ event_id: "attendance_event_1", title: "Saturday class", status: "active" }]
      });
    }
    if (path === "/attendance-events/attendance_event_1") {
      return jsonResponse({
        ok: true,
        event: { event_id: "attendance_event_1", title: "Saturday class", status: "active", location: "Main gym" },
        occurrences: [{ occurrence_id: "occ_1", occurrence_date: "2026-09-05", start_time: "09:00", end_time: "10:00" }],
        roster: [{
          athlete_user_id: "athlete_1",
          display_name: "Jordan Lee",
          invite_state: "invited",
          rsvp_by_occurrence: { occ_1: "attending" }
        }]
      });
    }
    return null;
  });

  render(<AttendanceEventDetailPanel />);
  await waitFor(() => screen.getByText("Saturday class"));

  act(() => {
    screen.getByText("Open event").click();
  });

  await waitFor(() => screen.getByText("Jordan Lee"));
  assert.ok(screen.getByText("Attending"));
  assert.ok(screen.getByText("Main gym"));
});

test("an athlete with no RSVP yet shows a factual 'No response yet' state", async () => {
  installMocks(({ input }) => {
    const path = String(input);
    if (path === "/attendance-events") {
      return jsonResponse({ ok: true, events: [{ event_id: "attendance_event_1", title: "Saturday class", status: "active" }] });
    }
    if (path === "/attendance-events/attendance_event_1") {
      return jsonResponse({
        ok: true,
        event: { event_id: "attendance_event_1", title: "Saturday class", status: "active" },
        occurrences: [{ occurrence_id: "occ_1", occurrence_date: "2026-09-05" }],
        roster: [{ athlete_user_id: "athlete_1", display_name: "Jordan Lee", invite_state: "invited", rsvp_by_occurrence: { occ_1: null } }]
      });
    }
    return null;
  });

  render(<AttendanceEventDetailPanel />);
  await waitFor(() => screen.getByText("Saturday class"));
  act(() => { screen.getByText("Open event").click(); });
  await waitFor(() => screen.getByText("No response yet"));
});

test("cancelling an active event calls the cancel route and reflects the cancelled state", async () => {
  let cancelled = false;
  installMocks(({ input, init }) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-token" });
    if (path === "/attendance-events") {
      return jsonResponse({
        ok: true,
        events: [{ event_id: "attendance_event_1", title: "Saturday class", status: cancelled ? "cancelled" : "active" }]
      });
    }
    if (path === "/attendance-events/attendance_event_1/cancel" && init?.method === "POST") {
      cancelled = true;
      return jsonResponse({ ok: true, event: { event_id: "attendance_event_1", status: "cancelled" } });
    }
    if (path === "/attendance-events/attendance_event_1") {
      return jsonResponse({
        ok: true,
        event: { event_id: "attendance_event_1", title: "Saturday class", status: cancelled ? "cancelled" : "active" },
        occurrences: [],
        roster: []
      });
    }
    return null;
  });

  render(<AttendanceEventDetailPanel />);
  await waitFor(() => screen.getByText("Saturday class"));
  act(() => { screen.getByText("Open event").click(); });
  await waitFor(() => screen.getByText("Cancel event"));

  await act(async () => {
    screen.getByText("Cancel event").click();
  });

  await waitFor(() => screen.queryByText("Cancel event") === null);
  assert.equal(cancelled, true);
});
