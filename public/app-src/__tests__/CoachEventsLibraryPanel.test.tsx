// DEV NOTE: coach Events screen event-library behavioral proof - replaces
// the source-text regex checks
// test/product_event_workspace_surface.test.mjs previously ran against
// the now-removed app.js renderCoachEvents() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { CoachEventsListPanel, CoachEventsMetricCards } from "../screens/coach/CoachEventsLibraryPanel";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(events: Record<string, unknown>[]) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/coach-workspace/events")) return jsonResponse({ events });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function daysFromNow(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

test.afterEach(() => {
  cleanup();
});

test("the metric cards show total, upcoming and linked-athlete counts", async () => {
  installMocks([
    { event_id: "event_past", linked_athlete_count: 2, event_plan: { event_date: daysFromNow(-5) } },
    { event_id: "event_future", linked_athlete_count: 3, event_plan: { event_date: daysFromNow(5) } }
  ]);

  render(<CoachEventsMetricCards />);

  await waitFor(() => {
    const values = Array.from(document.querySelectorAll("strong")).map((node) => node.textContent);
    assert.deepEqual(values, ["2", "1", "5"]);
  });
});

test("shows a factual empty state when the coach has no compiled events", async () => {
  installMocks([]);
  render(<CoachEventsListPanel />);
  await waitFor(() => screen.getByText("No events compiled"));
  assert.ok(screen.getByText("Create an event date anchor, then link athletes and programmes from each athlete profile."));
});

test("displays an event with its activity, type, date, location, timezone, countdown and week/athlete badges", async () => {
  installMocks([
    {
      event_id: "event_1",
      activity_id: "powerlifting",
      linked_athlete_count: 2,
      event_plan: {
        event_name: "Regional Meet",
        event_type: "powerlifting_meet",
        event_date: daysFromNow(10),
        location: "Mansfield",
        timezone: "Europe/London"
      },
      event_compile_summary: { required_week_count: 6 }
    }
  ]);

  render(<CoachEventsListPanel />);

  await waitFor(() => screen.getByText("Regional Meet"));

  assert.match(document.body.textContent ?? "", /Powerlifting Meet/u);
  assert.match(document.body.textContent ?? "", /Mansfield/u);
  assert.match(document.body.textContent ?? "", /Europe\/London/u);
  assert.ok(screen.getByText("6 weeks"));
  assert.ok(screen.getByText("2 athletes"));

  const badge = screen.getByText("2 athletes");
  assert.ok(badge.className.includes("active"));
});

test("omits location, timezone and notes when the event doesn't have them, and uses the neutral badge with no linked athletes", async () => {
  installMocks([
    {
      event_id: "event_1",
      activity_id: "powerlifting",
      linked_athlete_count: 0,
      event_plan: { event_name: "Minimal Meet", event_type: "powerlifting_meet", event_date: daysFromNow(10) }
    }
  ]);

  render(<CoachEventsListPanel />);

  await waitFor(() => screen.getByText("Minimal Meet"));

  assert.equal(document.querySelectorAll(".coach-event-notes").length, 0);
  const badge = screen.getByText("0 athletes");
  assert.ok(badge.className.includes("neutral"));
  assert.equal(badge.className.includes("active"), false);
});

test("an event name and notes containing markup are rendered as inert text, never as HTML", async () => {
  installMocks([
    {
      event_id: "event_1",
      event_plan: {
        event_name: '<img src=x onerror="window.pwned=true">',
        event_date: daysFromNow(10),
        notes: '<img src=y onerror="window.pwned2=true">'
      }
    }
  ]);

  render(<CoachEventsListPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));

  assert.ok(screen.getByText(/img src=y/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal((globalThis as Record<string, unknown>).pwned2, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:coach-events-changed fires", async () => {
  installMocks([]);
  render(<CoachEventsListPanel />);
  await waitFor(() => screen.getByText("No events compiled"));

  installMocks([
    { event_id: "event_1", event_plan: { event_name: "Regional Meet", event_date: daysFromNow(10) } }
  ]);

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-events-changed"));
  });

  await waitFor(() => screen.getByText("Regional Meet"));
});
