// DEV NOTE: FULL-UI-03 Coach Overview "Connected athletes" behavioral
// proof - replaces the source-text regex checks
// test/full_ui_03_coach_dashboard.test.mjs previously ran against the
// now-removed app.js renderCoachDashboard()/renderCoachWorkspace()
// connected-athletes rendering block and coachAthleteCard().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { CoachOverviewAthletesPanel } from "../screens/coach/CoachOverviewAthletesPanel";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function profileWithCurrentCount(count: number): Record<string, unknown> {
  const benchmarks = Array.from({ length: count }, (_, index) => ({
    exercise_id: `exercise_${index}`,
    benchmark_id: `ref_${index}`,
    source_value: 100,
    source_unit: "kg",
    source_type: "tested_1rm",
    effective_date: "2026-08-01"
  }));
  return { benchmarks };
}

function installMocks(options: {
  relationships?: Record<string, unknown>[];
  assignments?: Record<string, unknown>[];
  profilesByAthlete?: Record<string, Record<string, unknown> | null>;
}) {
  const { relationships = [], assignments = [], profilesByAthlete = {} } = options;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships });
    if (path.startsWith("/coach-workspace/assignments")) return jsonResponse({ assignments });
    if (path.startsWith("/coach-workspace/athlete-strength-profile")) {
      const athleteUserId = new URL(path, "http://localhost").searchParams.get("athlete_user_id") ?? "";
      const profile = Object.prototype.hasOwnProperty.call(profilesByAthlete, athleteUserId) ? profilesByAthlete[athleteUserId] : null;
      return jsonResponse({ profile });
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when there are no connected athletes", async () => {
  installMocks({ relationships: [] });
  render(<CoachOverviewAthletesPanel />);
  await screen.findByText("No connected athletes");
  assert.ok(screen.getByText("Connect an athlete to begin programme assignment and session review."));
  assert.ok(screen.getByText("No pending athlete invitations."));
});

test("summarizes pending invitations separately from accepted athletes", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" },
      { athlete_user_id: "athlete_2", display_name: "Pending Pat", relationship_state: "invited" }
    ]
  });

  render(<CoachOverviewAthletesPanel />);

  await screen.findByText("1 pending athlete invitation awaiting acceptance.");
  await screen.findByText("Alex");
  assert.equal(screen.queryByText("Pending Pat"), null);
});

test("shows an athlete's activity, assignment count and strength-reference count", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", activity_id: "rugby_union", relationship_state: "accepted" }],
    assignments: [
      { athlete_user_id: "athlete_1", template_id: "t1" },
      { athlete_user_id: "athlete_1", template_id: "t2" }
    ],
    profilesByAthlete: { athlete_1: profileWithCurrentCount(3) }
  });

  render(<CoachOverviewAthletesPanel />);

  await screen.findByText("Alex");
  assert.match(document.body.textContent ?? "", /Rugby Union/u);
  assert.ok(screen.getByText("3 strength references"));
  assert.ok(screen.getByText("2 assignments"));
});

test("shows 'Profile not recorded' when the athlete has no strength profile yet", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" }],
    assignments: [],
    profilesByAthlete: { athlete_1: null }
  });

  render(<CoachOverviewAthletesPanel />);

  await screen.findByText("Alex");
  assert.ok(screen.getByText("Profile not recorded"));
  assert.ok(screen.getByText("0 assignments"));
});

test("a failed strength-profile fetch for one athlete degrades gracefully rather than breaking the whole card", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" }],
    assignments: []
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/coach-workspace/athlete-strength-profile")) {
      return jsonResponse({ error: "not_found" }, false, 404);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  render(<CoachOverviewAthletesPanel />);

  await screen.findByText("Alex");
  assert.ok(screen.getByText("Profile not recorded"));
});

test("caps the displayed list at 6 athletes", async () => {
  const relationships = Array.from({ length: 8 }, (_, index) => ({
    athlete_user_id: `athlete_${index}`,
    display_name: `Athlete ${index}`,
    relationship_state: "accepted"
  }));
  installMocks({ relationships, assignments: [] });

  render(<CoachOverviewAthletesPanel />);

  await screen.findByText("Athlete 0");
  assert.equal(document.querySelectorAll(".athlete-record-card").length, 6);
});

test("Open profile dispatches kolosseum:open-athlete-profile-request with the athlete id", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" }],
    assignments: []
  });

  let received: { athlete_user_id?: string } | undefined;
  document.addEventListener("kolosseum:open-athlete-profile-request", (event) => {
    received = (event as CustomEvent).detail;
  });

  render(<CoachOverviewAthletesPanel />);
  await screen.findByText("Open profile");

  act(() => {
    screen.getByText("Open profile").click();
  });

  assert.deepEqual(received, { athlete_user_id: "athlete_1" });
});

test("an athlete name containing markup is rendered as inert text, never as HTML", async () => {
  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: '<img src=x onerror="window.pwned=true">', relationship_state: "accepted" }],
    assignments: []
  });

  render(<CoachOverviewAthletesPanel />);

  await screen.findByText(/img src=x/iu);

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:coach-overview-changed fires", async () => {
  installMocks({ relationships: [] });
  render(<CoachOverviewAthletesPanel />);
  await screen.findByText("No connected athletes");

  installMocks({
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex", relationship_state: "accepted" }],
    assignments: []
  });

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-overview-changed"));
  });

  await screen.findByText("Alex");
});
