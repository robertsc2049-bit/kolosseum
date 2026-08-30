// DEV NOTE: Attendance events slice 1 - coach event list/detail/cancel
// behavioral proof.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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

test("skipping one occurrence and rescheduling another never touches the sibling occurrence", async () => {
  const state = { occ1Status: "scheduled", occ2Status: "scheduled", rescheduledToDate: null as string | null };

  installMocks(({ input, init }) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-token" });
    if (path === "/attendance-events") {
      return jsonResponse({ ok: true, events: [{ event_id: "attendance_event_1", title: "MWF class", status: "active" }] });
    }
    if (path === "/attendance-events/attendance_event_1/occurrences/occ_1/skip" && init?.method === "POST") {
      state.occ1Status = "skipped";
      return jsonResponse({ ok: true, occurrence: { occurrence_id: "occ_1", status: "skipped" } });
    }
    if (path === "/attendance-events/attendance_event_1/occurrences/occ_2/reschedule" && init?.method === "POST") {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      state.occ2Status = "rescheduled";
      state.rescheduledToDate = body.new_date ?? null;
      return jsonResponse({ ok: true, occurrence: { occurrence_id: "occ_2", status: "rescheduled" } });
    }
    if (path === "/attendance-events/attendance_event_1") {
      return jsonResponse({
        ok: true,
        event: { event_id: "attendance_event_1", title: "MWF class", status: "active" },
        occurrences: [
          { occurrence_id: "occ_1", occurrence_date: "2026-09-07", status: state.occ1Status },
          {
            occurrence_id: "occ_2", occurrence_date: "2026-09-09", status: state.occ2Status,
            rescheduled_to_date: state.rescheduledToDate, rescheduled_to_start_time: null
          }
        ],
        roster: [{
          athlete_user_id: "athlete_1", display_name: "Jordan Lee", invite_state: "invited",
          rsvp_by_occurrence: { occ_1: "attending", occ_2: "attending" }
        }]
      });
    }
    return null;
  });

  render(<AttendanceEventDetailPanel />);
  await waitFor(() => screen.getByText("MWF class"));
  act(() => { screen.getByText("Open event").click(); });
  await waitFor(() => screen.getByText("2026-09-09"));

  const rows = screen.getAllByText("Skip").map((button) => button.closest(".attendance-occurrence-row") as HTMLElement);
  assert.equal(rows.length, 2, "expected one Skip button per unresolved occurrence");
  const [row1, row2] = rows;

  await act(async () => {
    fireEvent.click(within(row1).getByText("Skip"));
  });
  await waitFor(() => within(row1).getByText("Skipped"));
  assert.equal(within(row1).queryByText("Skip"), null, "a skipped occurrence no longer offers Skip/Reschedule");
  within(row2).getByText("Scheduled"); // sibling occurrence 2 is untouched by occurrence 1's skip

  await act(async () => {
    fireEvent.click(within(row2).getByText("Reschedule"));
  });
  await waitFor(() => within(row2).getByLabelText("New date"));
  fireEvent.change(within(row2).getByLabelText("New date"), { target: { value: "2026-09-10" } });
  await act(async () => {
    fireEvent.click(within(row2).getByText("Confirm"));
  });

  await waitFor(() => within(row2).getByText("Rescheduled"));
  assert.ok(within(row2).getByText("Moved to 2026-09-10"));
  assert.equal(within(row1).getByText("Skipped").textContent, "Skipped", "occurrence 1 remained skipped throughout occurrence 2's reschedule");
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
