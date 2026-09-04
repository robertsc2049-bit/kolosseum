// DEV NOTE: coach_athlete_detail current-programme/current-event and
// assignment/strength/bodyweight/event-link/session history behavioral
// proof - replaces the source-text regex checks
// test/full_ui_04b_coach_athlete_detail.test.mjs previously ran against
// the now-removed app.js rendering blocks (inside renderAthleteDetail) for
// these seven capabilities.
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
  AthleteSessionHistoryList,
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

test("shows a factual empty state when the athlete has no session history", async () => {
  installStandardMocks({ session_history: [] });
  render(<AthleteSessionHistoryList />);
  openProfile();
  await waitFor(() => screen.getByText("No session history"));
});

test("displays a session with its recorded event count and every bespoke fact - skip reasons, substitutions, RPE reports and split/return decision", async () => {
  installStandardMocks({
    session_history: [
      {
        session_id: "session_1",
        artefact_id: "artefact_1",
        updated_at: "2026-08-01T00:00:00.000Z",
        runtime_event_count: 12,
        session_status: "completed",
        pain_reported: true,
        split_entered: true,
        skip_reasons: ["equipment_unavailable"],
        substitutions: [{ exercise_id: "back_squat", substituted_exercise_id: "leg_press" }],
        rpe_reports: [{ exercise_id: "bench_press", rpe_value: 8 }],
        borg_reports: [{ exercise_id: "deadlift", borg_value: 15 }],
        cr10_reports: [{ exercise_id: "overhead_press", cr10_value: 7.5 }],
        split_return_decision: "continue_remaining_work"
      }
    ]
  });
  render(<AthleteSessionHistoryList />);
  openProfile();

  await waitFor(() => screen.getByText("Training session"));

  assert.match(document.body.textContent ?? "", /12\s*recorded events/u);
  assert.ok(screen.getByText("Completed"));
  assert.ok(screen.getByText("Pain reported"));
  assert.ok(screen.getByText("Split session"));
  assert.match(document.body.textContent ?? "", /Skipped: Equipment Unavailable/u);
  assert.match(document.body.textContent ?? "", /Substituted: Back Squat → Leg Press/u);
  assert.match(document.body.textContent ?? "", /RPE: Bench Press 8/u);
  assert.match(document.body.textContent ?? "", /Borg: Deadlift 15/u);
  assert.match(document.body.textContent ?? "", /CR10: Overhead Press 7\.5/u);
  assert.match(document.body.textContent ?? "", /Return decision: Continue Remaining Work/u);
  assert.ok(screen.getByText("Review"));
  assert.ok(screen.getByText("Add note"));
});

test("the Review button dispatches kolosseum:open-session-review with the open athlete's id", async () => {
  installStandardMocks({
    session_history: [{ session_id: "session_1", artefact_id: "artefact_1", updated_at: "2026-08-01T00:00:00.000Z", runtime_event_count: 1 }]
  });
  render(<AthleteSessionHistoryList />);
  openProfile();
  await waitFor(() => screen.getByText("Review"));

  let received: unknown;
  document.addEventListener("kolosseum:open-session-review", (event) => {
    received = (event as CustomEvent).detail;
  });

  act(() => {
    screen.getByText("Review").click();
  });

  assert.deepEqual(received, { athlete_user_id: "athlete_test123" });
});

test("the Add note button dispatches kolosseum:open-session-note-form with the session and artefact id", async () => {
  installStandardMocks({
    session_history: [{ session_id: "session_1", artefact_id: "artefact_1", updated_at: "2026-08-01T00:00:00.000Z", runtime_event_count: 1 }]
  });
  render(<AthleteSessionHistoryList />);
  openProfile();
  await waitFor(() => screen.getByText("Add note"));

  let received: unknown;
  document.addEventListener("kolosseum:open-session-note-form", (event) => {
    received = (event as CustomEvent).detail;
  });

  act(() => {
    screen.getByText("Add note").click();
  });

  assert.deepEqual(received, { session_id: "session_1", artefact_id: "artefact_1" });
});

test("a skip reason containing markup is rendered as inert text, never as HTML", async () => {
  installStandardMocks({
    session_history: [
      {
        session_id: "session_1",
        artefact_id: "artefact_1",
        updated_at: "2026-08-01T00:00:00.000Z",
        runtime_event_count: 1,
        skip_reasons: ['<img src=x onerror="window.pwned=true">']
      }
    ]
  });
  render(<AthleteSessionHistoryList />);
  openProfile();

  await waitFor(() => screen.getByText(/img src=x/iu));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});
