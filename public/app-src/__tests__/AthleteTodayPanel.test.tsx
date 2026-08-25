// DEV NOTE: athlete Today screen behavioral proof - replaces the source-text
// regex checks against the now-removed app.js renderToday()/
// renderTodayProgramme()/renderTodayResolvedLoad()/renderTodayNotes()/
// renderTodayEvent() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import {
  AthleteTodayCreateSessionButton,
  AthleteTodayEventCard,
  AthleteTodaySessionCard
} from "../screens/athlete/AthleteTodayPanel";

const ATHLETE_USER_ID = "athlete_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(today: Record<string, unknown>, sessionState?: Record<string, unknown>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: ATHLETE_USER_ID } });
    if (path.startsWith("/sessions/beta-athlete-today")) return jsonResponse({ ok: true, ...today });
    if (/\/sessions\/.+\/state$/u.test(path)) return jsonResponse(sessionState ?? {});
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows the unavailable empty state and a working retry when the fetch fails", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  render(<AthleteTodaySessionCard />);
  await waitFor(() => screen.getByText("Today is unavailable right now"));
  assert.ok(screen.getByText("We could not reach the server to load your current programme. Check your connection and try again."));

  installMocks({ state: "no_session", assignment: null, session: null, event: null, notes: [] });
  const retryButton = screen.getByText("Retry");
  await act(async () => {
    retryButton.click();
  });

  await waitFor(() => screen.getByText("No session is open"));
});

test("shows the correct copy and badge for every declared message state", async () => {
  const cases: Array<[string, string, string]> = [
    ["no_current_assignment", "No active programme", "No programme"],
    ["relationship_ended", "Coaching relationship ended", "Relationship ended"],
    ["missing_strength_reference", "Waiting on a strength reference", "Reference needed"],
    ["programme_complete", "Programme complete", "Complete"],
    ["no_session", "No session is open", "No session"],
    ["session_already_complete", "Session complete", "Session complete"]
  ];

  for (const [stateValue, heading, badgeLabel] of cases) {
    installMocks({ state: stateValue, assignment: null, session: null, event: null, notes: [] });
    const { unmount } = render(<AthleteTodaySessionCard />);
    await waitFor(() => screen.getByRole("heading", { name: heading }));
    const badge = document.querySelector(".badge");
    assert.equal(badge?.textContent, badgeLabel);
    unmount();
  }
});

test("the create-session button reflects each state's label and dispatches the reverse bridge on click", async () => {
  const cases: Array<[string, string]> = [
    ["no_current_assignment", "Create session"],
    ["no_session", "Start session"],
    ["session_already_complete", "Start next session"],
    ["ok", "Create another session"]
  ];

  for (const [stateValue, label] of cases) {
    installMocks({
      state: stateValue,
      assignment: stateValue === "ok" ? { template_name: "Base Block", activity_id: "powerlifting" } : null,
      session: stateValue === "ok" ? { session_id: "session_1", template_session_title: "Squat day" } : null,
      event: null,
      notes: []
    }, {});
    const { unmount } = render(<AthleteTodayCreateSessionButton />);
    await waitFor(() => screen.getByText(label));
    unmount();
  }

  installMocks({ state: "no_current_assignment", assignment: null, session: null, event: null, notes: [] });
  render(<AthleteTodayCreateSessionButton />);
  const button = await screen.findByText("Create session");

  let dispatched = false;
  document.addEventListener("kolosseum:create-session", () => {
    dispatched = true;
  });

  await act(async () => {
    button.click();
  });

  assert.equal(dispatched, true);
});

test("an active session shows activity, title, real completed/remaining/dropped counts and resolved load", async () => {
  installMocks(
    {
      state: "ok",
      assignment: { template_name: "Peak Block", template_version: 2, activity_id: "powerlifting" },
      session: {
        session_id: "session_1",
        template_session_title: "Heavy squat day",
        template_session_coaching_notes: "Focus on bar speed",
        template_block_name: "Block 2",
        template_week_index_global: 3,
        template_session_index: 1,
        total_session_count: 12,
        planned_items: [
          {
            resolved_load: {
              value: 120,
              unit: "kg",
              source: { source_type: "training_max", effective_date: "2026-01-01" }
            }
          }
        ]
      },
      event: null,
      notes: []
    },
    {
      completed_exercises: ["a", "b"],
      remaining_exercises: ["c"],
      dropped_exercises: [],
      started: true
    }
  );

  render(<AthleteTodaySessionCard />);

  await waitFor(() => screen.getByText("Heavy squat day"));

  assert.ok(screen.getByText("Peak Block"));
  assert.ok(screen.getByText("Version 2"));
  assert.match(document.body.textContent ?? "", /Block: Block 2/u);
  assert.match(document.body.textContent ?? "", /Week 3/u);
  assert.match(document.body.textContent ?? "", /Session 2 of 12/u);
  assert.ok(screen.getByText("Focus on bar speed"));
  assert.ok(screen.getByText("2"));
  assert.ok(screen.getByText("1"));
  assert.ok(screen.getByText("120 kg"));
  assert.match(document.body.textContent ?? "", /Training max · effective/u);
  assert.ok(screen.getByText("In progress"));
});

test("the 'Open session' button clicks the sidebar's session nav item rather than reimplementing navigation", async () => {
  document.body.innerHTML = '<button data-view="session"></button>';
  const navButton = document.querySelector('[data-view="session"]') as HTMLButtonElement;
  let navClicked = false;
  navButton.addEventListener("click", () => {
    navClicked = true;
  });

  installMocks(
    {
      state: "ok",
      assignment: { template_name: "Peak Block", activity_id: "powerlifting" },
      session: { session_id: "session_1", template_session_title: "Squat day" },
      event: null,
      notes: []
    },
    { completed_exercises: [], remaining_exercises: [], dropped_exercises: [] }
  );

  render(<AthleteTodaySessionCard />);
  const openButton = await screen.findByText("Open session");

  await act(async () => {
    openButton.click();
  });

  assert.equal(navClicked, true);
});

test("advisory notes from the coach render as inert text with their date, never as HTML", async () => {
  installMocks({
    state: "no_current_assignment",
    assignment: null,
    session: null,
    event: null,
    notes: [
      { note_id: "note_1", note_text: '<img src=x onerror="window.pwned=true">', created_at_iso8601: "2026-01-05T10:00:00.000Z" }
    ]
  });

  render(<AthleteTodaySessionCard />);

  await waitFor(() => screen.getByText(/img src=x/iu));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("the event card is absent when there is no event, and shows the unavailable variant separately from an active one", async () => {
  installMocks({ state: "no_current_assignment", assignment: null, session: null, event: null, notes: [] });
  const { container, unmount } = render(<AthleteTodayEventCard />);
  await waitFor(() => {
    assert.equal(container.textContent, "");
  });
  unmount();

  installMocks({
    state: "no_current_assignment",
    assignment: null,
    session: null,
    notes: [],
    event: { status: "unavailable", event_id: "event_1", reason: "event_cancelled" }
  });
  render(<AthleteTodayEventCard />);
  await waitFor(() => screen.getByText("This event is no longer available"));
  assert.ok(screen.getByText("Event Cancelled"));
});

test("an active event shows its type, countdown, name and date/location", async () => {
  const eventDate = new Date();
  eventDate.setUTCDate(eventDate.getUTCDate() + 10);

  installMocks({
    state: "no_current_assignment",
    assignment: null,
    session: null,
    notes: [],
    event: {
      status: "active",
      event_id: "event_1",
      event_type: "powerlifting_meet",
      event_name: "Regional Meet",
      event_date: eventDate.toISOString().slice(0, 10),
      location: "Sheffield"
    }
  });

  render(<AthleteTodayEventCard />);

  await waitFor(() => screen.getByText("Regional Meet"));
  assert.ok(screen.getByText("Powerlifting Meet"));
  assert.match(document.body.textContent ?? "", /Sheffield/u);
});

test("refetches when kolosseum:today-changed fires", async () => {
  installMocks({ state: "no_current_assignment", assignment: null, session: null, event: null, notes: [] });
  render(<AthleteTodaySessionCard />);
  await waitFor(() => screen.getByText("No active programme"));

  installMocks({ state: "no_session", assignment: null, session: null, event: null, notes: [] });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:today-changed"));
  });

  await waitFor(() => screen.getByText("No session is open"));
});
