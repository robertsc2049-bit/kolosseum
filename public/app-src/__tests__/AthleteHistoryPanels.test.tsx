// DEV NOTE: coach_athlete_detail current-programme/current-event and
// assignment/strength/bodyweight/event-link history behavioral proof -
// replaces the source-text regex checks
// test/full_ui_04b_coach_athlete_detail.test.mjs previously ran against
// the now-removed app.js rendering blocks (inside renderAthleteDetail) for
// these six capabilities. Session history stays legacy - see
// AthleteHistoryPanels.tsx's DEV NOTE for why - and is still covered by
// that same test file's other assertions.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import {
  AthleteAssignmentHistoryList,
  AthleteBodyweightHistoryList,
  AthleteCurrentEventCard,
  AthleteCurrentProgrammeCard,
  AthleteEventLinkHistoryList,
  AthleteStrengthHistoryList
} from "../screens/coach/AthleteHistoryPanels";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installFetchMock(handler: (call: FetchCall) => Response) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler({ input, init })) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

const COACH_USER_ID = "coach_test123";

function installStandardMocks(detail: Record<string, unknown>, extras: Partial<{
  templates: Record<string, unknown>[];
  events: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
}> = {}) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/coach-workspace/athlete-detail")) return jsonResponse({ detail });
    if (path.startsWith("/templates/exercises")) return jsonResponse({ exercises: extras.exercises ?? [] });
    if (path.startsWith("/templates")) return jsonResponse({ templates: extras.templates ?? [] });
    if (path.startsWith("/coach-workspace/events")) return jsonResponse({ events: extras.events ?? [] });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });
}

function openProfile() {
  act(() => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:coach-athlete-profile-opened", {
        detail: { athlete_user_id: "athlete_test123" }
      })
    );
  });
}

function closeProfile() {
  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });
}

test.afterEach(() => {
  cleanup();
  closeProfile();
});

test("current-programme and current-event cards render nothing until the coach opens an athlete's profile", () => {
  installFetchMock(() => jsonResponse({}, false, 404));
  render(<AthleteCurrentProgrammeCard />);
  render(<AthleteCurrentEventCard />);
  assert.equal(document.body.textContent, "");
});

test("displays the current programme with its version and date, resolving the template name from the templates list", async () => {
  installStandardMocks(
    {
      current_assignment: { template_id: "template_1", template_version: 2, created_at_iso8601: "2026-08-01T00:00:00.000Z" }
    },
    { templates: [{ template_id: "template_1", template_name: "Upper Body Strength Block" }] }
  );
  render(<AthleteCurrentProgrammeCard />);
  openProfile();

  await waitFor(() => screen.getByText("Upper Body Strength Block"));
  assert.match(document.body.textContent ?? "", /Version 2/u);
  assert.ok(screen.getByText("Open programme"));
});

test("falls back to the raw template id when no matching template is found", async () => {
  installStandardMocks({
    current_assignment: { template_id: "template_missing", template_version: 1, created_at_iso8601: "2026-08-01T00:00:00.000Z" }
  });
  render(<AthleteCurrentProgrammeCard />);
  openProfile();

  await waitFor(() => screen.getByText("template_missing"));
});

test("shows a factual empty state when the athlete has no current programme assignment", async () => {
  installStandardMocks({});
  render(<AthleteCurrentProgrammeCard />);
  openProfile();

  await waitFor(() => screen.getByText("No programme assignment"));
});

test("displays the current event link with its date and countdown, resolving the event name from the events list", async () => {
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().slice(0, 10);
  installStandardMocks(
    { current_event_link: { event_id: "event_1" } },
    { events: [{ event_id: "event_1", event_plan: { event_name: "Regional Meet", event_date: futureDate } }] }
  );
  render(<AthleteCurrentEventCard />);
  openProfile();

  await waitFor(() => screen.getByText("Regional Meet"));
  assert.ok(screen.getByText("Open event"));
});

test("shows a factual empty state when the current assignment has no event link", async () => {
  installStandardMocks({});
  render(<AthleteCurrentEventCard />);
  openProfile();

  await waitFor(() => screen.getByText("No event link"));
});

test("displays assignment history with activity, date and version, and a factual empty state when there is none", async () => {
  installStandardMocks(
    {
      assignment_history: [
        { assignment_id: "assign_1", template_id: "template_1", template_version: 3, activity_id: "powerlifting", created_at_iso8601: "2026-08-01T00:00:00.000Z" }
      ]
    },
    { templates: [{ template_id: "template_1", template_name: "Base Block" }] }
  );
  render(<AthleteAssignmentHistoryList />);
  openProfile();

  await waitFor(() => screen.getByText("Base Block"));
  assert.match(document.body.textContent ?? "", /Powerlifting/u);
  assert.match(document.body.textContent ?? "", /Version 3/u);

  cleanup();
  closeProfile();
  installStandardMocks({ assignment_history: [] });
  render(<AthleteAssignmentHistoryList />);
  openProfile();
  await waitFor(() => screen.getByText("No assignment history"));
});

test("displays strength history with a per-benchmark exercise name and summary", async () => {
  installStandardMocks(
    {
      strength_profile_history: [
        {
          profile_id: "profile_1",
          preferred_weight_unit: "kg",
          created_at_iso8601: "2026-08-01T00:00:00.000Z",
          benchmarks: [{ exercise_id: "back_squat", value: 140, unit: "kg", basis: "tested_1rm", effective_date: "2026-07-01" }]
        }
      ]
    },
    { exercises: [{ exercise_id: "back_squat", display_name: "Back Squat" }] }
  );
  render(<AthleteStrengthHistoryList />);
  openProfile();

  await waitFor(() => screen.getByText("1 strength reference"));
  assert.match(document.body.textContent ?? "", /Back Squat: Tested 1RM · 140 kg · Effective 2026-07-01/u);
});

test("shows a factual empty state when the athlete has no bodyweight history", async () => {
  installStandardMocks({ bodyweight_history: [] });
  render(<AthleteBodyweightHistoryList />);
  openProfile();
  await waitFor(() => screen.getByText("No bodyweight history"));
});

test("displays a bodyweight record with its value, unit and date", async () => {
  installStandardMocks({
    bodyweight_history: [{ record_id: "bw_1", bodyweight: 82.5, unit: "kg", effective_at: "2026-08-01T00:00:00.000Z" }]
  });
  render(<AthleteBodyweightHistoryList />);
  openProfile();

  await waitFor(() => screen.getByText("82.5 kg"));
  assert.ok(screen.getByText("Factual recorded bodyweight"));
});

test("displays event-link history with the linked event name and link state", async () => {
  installStandardMocks(
    {
      event_link_history: [
        { link_id: "link_1", event_id: "event_1", link_state: "linked", lifecycle_action: "linked", created_at_iso8601: "2026-08-01T00:00:00.000Z" }
      ]
    },
    { events: [{ event_id: "event_1", event_plan: { event_name: "Regional Meet" } }] }
  );
  render(<AthleteEventLinkHistoryList />);
  openProfile();

  await waitFor(() => screen.getByText("Regional Meet"));
  assert.match(document.body.textContent ?? "", /Linked/u);
});

test("closing the profile clears all history panels back to rendering nothing", async () => {
  installStandardMocks({
    current_assignment: { template_id: "template_1", template_version: 1, created_at_iso8601: "2026-08-01T00:00:00.000Z" }
  });
  render(<AthleteCurrentProgrammeCard />);
  openProfile();
  await waitFor(() => screen.getByText("template_1"));

  closeProfile();
  await waitFor(() => assert.equal(screen.queryByText("template_1"), null));
});

test("an activity id and template id containing markup are rendered as inert text, never as HTML", async () => {
  installStandardMocks({
    assignment_history: [
      {
        assignment_id: "assign_1",
        template_id: '<img src=x onerror="window.pwned=true">',
        template_version: 1,
        activity_id: "powerlifting",
        created_at_iso8601: "2026-08-01T00:00:00.000Z"
      }
    ]
  });
  render(<AthleteAssignmentHistoryList />);
  openProfile();

  await waitFor(() => screen.getByText(/img src=x/u));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});
