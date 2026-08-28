// DEV NOTE: FULL-UI-03 Coach Overview metric strip behavioral proof -
// replaces the source-text regex checks test/full_ui_03_coach_dashboard.
// test.mjs previously ran against the now-removed app.js
// renderCoachDashboard()/renderCoachWorkspace() metric-writing block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { CoachOverviewMetricsPanel } from "../screens/coach/CoachOverviewMetricsPanel";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: {
  relationships?: Record<string, unknown>[];
  assignments?: Record<string, unknown>[];
  reviews?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
} = {}) {
  const { relationships = [], assignments = [], reviews = [], events = [] } = options;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships });
    if (path.startsWith("/coach-workspace/assignments")) return jsonResponse({ assignments });
    if (path.startsWith("/coach-workspace/reviews")) return jsonResponse({ records: reviews });
    if (path.startsWith("/coach-workspace/events")) return jsonResponse({ events });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows zero counts with no data", async () => {
  installMocks();
  render(<CoachOverviewMetricsPanel />);
  await screen.findByText("Connected athletes");
  const strongs = [...document.querySelectorAll(".metric-card strong")].map((el) => el.textContent);
  assert.deepEqual(strongs, ["0", "0", "0", "0", "0", "0"]);
});

test("counts connected athletes, excluding pending invitations and expired relationships", async () => {
  installMocks({
    relationships: [
      { athlete_user_id: "a1", relationship_state: "accepted" },
      { athlete_user_id: "a2", relationship_state: "accepted", relationship_expired: true },
      { athlete_user_id: "a3", relationship_state: "invited" }
    ]
  });
  render(<CoachOverviewMetricsPanel />);
  await screen.findByText("Connected athletes");
  const athleteCount = document.querySelector(".metric-card strong");
  assert.equal(athleteCount?.textContent, "1");
});

test("counts total assignments, session records, open sessions and awaiting review", async () => {
  installMocks({
    assignments: [{ assignment_id: "1" }, { assignment_id: "2" }],
    reviews: [
      { session_id: "s1", review_status: "open" },
      { session_id: "s2", review_status: "reviewed", awaiting_review: false },
      { session_id: "s3", review_status: "unreviewed", awaiting_review: true }
    ]
  });
  render(<CoachOverviewMetricsPanel />);
  await screen.findByText("Connected athletes");
  const values = [...document.querySelectorAll(".metric-card strong")].map((el) => el.textContent);
  assert.deepEqual(values, ["0", "2", "3", "1", "1", "0"]);
});

test("counts only events on or after today as upcoming", async () => {
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  installMocks({
    events: [
      { event_id: "e1", event_plan: { event_date: future } },
      { event_id: "e2", event_plan: { event_date: past } }
    ]
  });
  render(<CoachOverviewMetricsPanel />);
  await screen.findByText("Connected athletes");
  const upcoming = [...document.querySelectorAll(".metric-card strong")].at(-1);
  assert.equal(upcoming?.textContent, "1");
});

test("refetches when kolosseum:coach-overview-changed fires", async () => {
  installMocks();
  render(<CoachOverviewMetricsPanel />);
  await screen.findByText("Connected athletes");

  installMocks({ assignments: [{ assignment_id: "1" }] });
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-overview-changed"));
  });

  await screen.findByText("1");
});
