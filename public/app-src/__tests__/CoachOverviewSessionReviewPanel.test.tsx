// DEV NOTE: FULL-UI-03 Coach Overview "Open sessions"/"Completed since
// review" behavioral proof - replaces the source-text regex checks
// test/full_ui_03_coach_dashboard.test.mjs previously ran against the
// now-removed app.js renderCoachDashboard() open-sessions/review-queue
// rendering blocks.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachOverviewOpenSessionsPanel, CoachOverviewReviewQueuePanel } from "../screens/coach/CoachOverviewSessionReviewPanel";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: { records?: Record<string, unknown>[]; relationships?: Record<string, unknown>[] }) {
  const { records = [], relationships = [] } = options;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/coach-workspace/reviews")) return jsonResponse({ records });
    if (path.startsWith("/coach-workspace/relationships")) return jsonResponse({ relationships });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("Open sessions shows a factual empty state when nothing is open", async () => {
  installMocks({ records: [] });
  render(<CoachOverviewOpenSessionsPanel />);
  await screen.findByText("No open sessions");
  assert.ok(screen.getByText("No connected athlete currently has an open recorded session."));
});

test("Open sessions lists records with review_status open, with athlete name, status and event count", async () => {
  installMocks({
    records: [
      { artefact_id: "a1", athlete_user_id: "athlete_1", review_status: "open", session_status: "in_progress", runtime_event_count: 4, updated_at: "2026-08-20T10:00:00.000Z" },
      { artefact_id: "a2", athlete_user_id: "athlete_2", review_status: "unreviewed", session_status: "recorded", runtime_event_count: 2, updated_at: "2026-08-21T10:00:00.000Z" }
    ],
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex" }]
  });

  render(<CoachOverviewOpenSessionsPanel />);

  await screen.findByText("Alex");
  assert.match(document.body.textContent ?? "", /In Progress/u);
  assert.match(document.body.textContent ?? "", /4 recorded events/u);
  assert.ok(screen.getByText("Open live status"));
});

test("Open sessions falls back to 'Connected athlete' when no relationship name is found", async () => {
  installMocks({
    records: [{ artefact_id: "a1", athlete_user_id: "athlete_unknown", review_status: "open", session_status: "in_progress", runtime_event_count: 0, updated_at: "2026-08-20T10:00:00.000Z" }],
    relationships: []
  });

  render(<CoachOverviewOpenSessionsPanel />);
  await screen.findByText("Connected athlete");
});

test("Open live status dispatches kolosseum:open-session-review with the athlete id", async () => {
  installMocks({
    records: [{ artefact_id: "a1", athlete_user_id: "athlete_1", review_status: "open", session_status: "in_progress", runtime_event_count: 0, updated_at: "2026-08-20T10:00:00.000Z" }],
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex" }]
  });

  let received: { athlete_user_id?: string } | undefined;
  document.addEventListener("kolosseum:open-session-review", (event) => {
    received = (event as CustomEvent).detail;
  });

  render(<CoachOverviewOpenSessionsPanel />);
  await screen.findByText("Open live status");

  act(() => {
    screen.getByText("Open live status").click();
  });

  assert.deepEqual(received, { athlete_user_id: "athlete_1" });
});

test("Review queue shows a factual empty state when nothing is awaiting review", async () => {
  installMocks({ records: [] });
  render(<CoachOverviewReviewQueuePanel />);
  await screen.findByText("No completed session records");
  assert.ok(screen.getByText("Completed athlete sessions will appear here when factual artefacts are available."));
});

test("Review queue lists only records with awaiting_review true, excluding open and already-reviewed sessions", async () => {
  installMocks({
    records: [
      { artefact_id: "a1", athlete_user_id: "athlete_1", review_status: "open", awaiting_review: false, session_status: "in_progress", runtime_event_count: 1, updated_at: "2026-08-20T10:00:00.000Z" },
      { artefact_id: "a2", athlete_user_id: "athlete_2", review_status: "unreviewed", awaiting_review: true, session_status: "completed", runtime_event_count: 5, updated_at: "2026-08-21T10:00:00.000Z" },
      { artefact_id: "a3", athlete_user_id: "athlete_3", review_status: "reviewed", awaiting_review: false, session_status: "completed", runtime_event_count: 3, updated_at: "2026-08-19T10:00:00.000Z" }
    ],
    relationships: [{ athlete_user_id: "athlete_2", display_name: "Jordan" }]
  });

  render(<CoachOverviewReviewQueuePanel />);

  await screen.findByText("Jordan");
  assert.match(document.body.textContent ?? "", /5 recorded events/u);
  assert.ok(screen.getByText("Review record"));
});

test("Review record dispatches kolosseum:open-session-review with the athlete id", async () => {
  installMocks({
    records: [{ artefact_id: "a2", athlete_user_id: "athlete_2", review_status: "unreviewed", awaiting_review: true, session_status: "completed", runtime_event_count: 0, updated_at: "2026-08-21T10:00:00.000Z" }],
    relationships: [{ athlete_user_id: "athlete_2", display_name: "Jordan" }]
  });

  let received: { athlete_user_id?: string } | undefined;
  document.addEventListener("kolosseum:open-session-review", (event) => {
    received = (event as CustomEvent).detail;
  });

  render(<CoachOverviewReviewQueuePanel />);
  await screen.findByText("Review record");

  act(() => {
    screen.getByText("Review record").click();
  });

  assert.deepEqual(received, { athlete_user_id: "athlete_2" });
});

test("an athlete name containing markup is rendered as inert text, never as HTML", async () => {
  installMocks({
    records: [{ artefact_id: "a1", athlete_user_id: "athlete_1", review_status: "open", session_status: "in_progress", runtime_event_count: 0, updated_at: "2026-08-20T10:00:00.000Z" }],
    relationships: [{ athlete_user_id: "athlete_1", display_name: '<img src=x onerror="window.pwned=true">' }]
  });

  render(<CoachOverviewOpenSessionsPanel />);

  await screen.findByText(/img src=x/iu);

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:coach-overview-changed fires", async () => {
  installMocks({ records: [] });
  render(<CoachOverviewOpenSessionsPanel />);
  await screen.findByText("No open sessions");

  installMocks({
    records: [{ artefact_id: "a1", athlete_user_id: "athlete_1", review_status: "open", session_status: "in_progress", runtime_event_count: 0, updated_at: "2026-08-20T10:00:00.000Z" }],
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Alex" }]
  });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-overview-changed"));
  });

  await screen.findByText("Alex");
});
