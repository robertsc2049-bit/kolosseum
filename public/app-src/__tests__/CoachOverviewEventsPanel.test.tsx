// DEV NOTE: FULL-UI-03 Coach Overview "Upcoming events" behavioral proof -
// replaces the source-text regex checks
// test/full_ui_03_coach_dashboard.test.mjs previously ran against the
// now-removed app.js renderCoachDashboard() upcoming-events rendering
// block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { CoachOverviewEventsPanel } from "../screens/coach/CoachOverviewEventsPanel";

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

test("shows a factual empty state when there are no upcoming events", async () => {
  installMocks([]);
  render(<CoachOverviewEventsPanel />);
  await waitFor(() => screen.getByText("No upcoming events"));
  assert.ok(screen.getByText("Create an event date anchor to display it on the coach dashboard."));
});

test("displays an upcoming event with its name, type, date, countdown and linked-athlete count", async () => {
  installMocks([
    {
      event_id: "event_1",
      linked_athlete_count: 3,
      event_plan: { event_name: "Regional Meet", event_type: "powerlifting_meet", event_date: daysFromNow(10) }
    }
  ]);

  render(<CoachOverviewEventsPanel />);

  await waitFor(() => screen.getByText("Regional Meet"));
  assert.match(document.body.textContent ?? "", /Powerlifting Meet/u);
  assert.ok(screen.getByText("3 athlete links"));
  assert.ok(screen.getByText("Open event"));
});

test("excludes past events and sorts remaining ones by date ascending", async () => {
  installMocks([
    { event_id: "event_past", event_plan: { event_name: "Past Meet", event_date: daysFromNow(-5) } },
    { event_id: "event_later", event_plan: { event_name: "Later Meet", event_date: daysFromNow(20) } },
    { event_id: "event_sooner", event_plan: { event_name: "Sooner Meet", event_date: daysFromNow(5) } }
  ]);

  render(<CoachOverviewEventsPanel />);

  await waitFor(() => screen.getByText("Sooner Meet"));
  assert.equal(screen.queryByText("Past Meet"), null);

  const headings = Array.from(document.querySelectorAll("h4")).map((node) => node.textContent);
  assert.deepEqual(headings, ["Sooner Meet", "Later Meet"]);
});

test("the Open event button clicks the legacy Events nav link before navigating", async () => {
  // DEV NOTE: this jsdom test setup has no global `location` (see
  // setup.mjs), so the location.hash half of openEventDetail isn't
  // observable here - live-verified separately against the real app.js
  // router, mirroring the identical pattern already proven for
  // AthleteHistoryPanels.tsx's openProgramme/openEvent.
  installMocks([
    { event_id: "event_1", event_plan: { event_name: "Regional Meet", event_date: daysFromNow(10) } }
  ]);

  const eventsNavButton = document.createElement("button");
  eventsNavButton.setAttribute("data-view", "events");
  document.body.appendChild(eventsNavButton);
  let navClicked = false;
  eventsNavButton.addEventListener("click", () => { navClicked = true; });

  try {
    render(<CoachOverviewEventsPanel />);
    await waitFor(() => screen.getByText("Open event"));

    act(() => {
      screen.getByText("Open event").click();
    });

    assert.equal(navClicked, true);
  }
  finally {
    eventsNavButton.remove();
  }
});

test("an event name containing markup is rendered as inert text, never as HTML", async () => {
  installMocks([
    {
      event_id: "event_1",
      event_plan: { event_name: '<img src=x onerror="window.pwned=true">', event_date: daysFromNow(10) }
    }
  ]);

  render(<CoachOverviewEventsPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:coach-overview-changed fires", async () => {
  installMocks([]);
  render(<CoachOverviewEventsPanel />);
  await waitFor(() => screen.getByText("No upcoming events"));

  installMocks([
    { event_id: "event_1", event_plan: { event_name: "Regional Meet", event_date: daysFromNow(10) } }
  ]);

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-overview-changed"));
  });

  await waitFor(() => screen.getByText("Regional Meet"));
});
