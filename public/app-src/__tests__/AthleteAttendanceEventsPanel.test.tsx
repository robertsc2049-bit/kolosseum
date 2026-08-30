// DEV NOTE: Attendance events slice 1 - athlete invited-events/RSVP
// behavioral proof.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteAttendanceEventsPanel } from "../screens/athlete/AthleteAttendanceEventsPanel";

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

test("shows a factual empty state when the athlete has no invited events", async () => {
  installMocks(({ input }) => {
    const path = String(input);
    if (path === "/attendance-events/mine") return jsonResponse({ ok: true, occurrences: [] });
    return null;
  });

  render(<AthleteAttendanceEventsPanel />);
  await waitFor(() => screen.getByText("No upcoming events yet."));
});

test("lists an invited occurrence with its current RSVP state", async () => {
  installMocks(({ input }) => {
    const path = String(input);
    if (path === "/attendance-events/mine") {
      return jsonResponse({
        ok: true,
        occurrences: [{
          event_id: "attendance_event_1",
          title: "Saturday class",
          location: "Main gym",
          occurrence_id: "occ_1",
          occurrence_date: "2026-09-05",
          start_time: "09:00",
          end_time: "10:00",
          my_rsvp_state: null
        }]
      });
    }
    return null;
  });

  render(<AthleteAttendanceEventsPanel />);
  await waitFor(() => screen.getByText("Saturday class"));
  assert.ok(screen.getByText("No response yet"));
  assert.ok(screen.getByText("Main gym"));
});

test("submitting an RSVP calls the rsvp route with the chosen state and refreshes the list", async () => {
  let rsvpState: string | null = null;
  installMocks(({ input, init }) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-token" });
    if (path === "/attendance-events/mine") {
      return jsonResponse({
        ok: true,
        occurrences: [{
          event_id: "attendance_event_1",
          title: "Saturday class",
          occurrence_id: "occ_1",
          occurrence_date: "2026-09-05",
          my_rsvp_state: rsvpState
        }]
      });
    }
    if (path === "/attendance-events/occurrences/occ_1/rsvp" && init?.method === "POST") {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      rsvpState = body.rsvp_state;
      return jsonResponse({ ok: true, rsvp: { rsvp_state: rsvpState } }, true, 201);
    }
    return null;
  });

  render(<AthleteAttendanceEventsPanel />);
  await waitFor(() => screen.getByText("Saturday class"));

  await act(async () => {
    screen.getByText("Attending").click();
  });

  await waitFor(() => screen.getAllByText("Attending").length >= 1);
  assert.equal(rsvpState, "attending");
});

test("a failed RSVP shows a factual error message", async () => {
  installMocks(({ input, init }) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-token" });
    if (path === "/attendance-events/mine") {
      return jsonResponse({
        ok: true,
        occurrences: [{ event_id: "attendance_event_1", title: "Saturday class", occurrence_id: "occ_1", occurrence_date: "2026-09-05", my_rsvp_state: null }]
      });
    }
    if (path === "/attendance-events/occurrences/occ_1/rsvp" && init?.method === "POST") {
      return jsonResponse({ error: "attendance_event_not_invited" }, false, 403);
    }
    return null;
  });

  render(<AthleteAttendanceEventsPanel />);
  await waitFor(() => screen.getByText("Saturday class"));

  await act(async () => {
    screen.getByText("Attending").click();
  });

  await waitFor(() => screen.getByText("attendance_event_not_invited"));
});
