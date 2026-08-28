// DEV NOTE: Today "Recent activity" preview behavioral proof - replaces the
// source-text regex checks against the now-removed app.js recordCard()/
// bindSessionCards()/renderTodayRecent() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { AthleteTodayHistoryCountBadge, AthleteTodayRecentActivityList } from "../screens/athlete/AthleteTodayRecentActivityPanel";

const ATHLETE_USER_ID = "athlete_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(sessions: Record<string, unknown>[]) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: ATHLETE_USER_ID } });
    if (path.startsWith("/sessions/beta-athlete-history")) return jsonResponse({ ok: true, sessions });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when there are no recent sessions", async () => {
  installMocks([]);
  render(<AthleteTodayRecentActivityList />);
  await screen.findByText("No recent sessions are recorded.");
});

test("shows the total session count", async () => {
  installMocks([
    { session_id: "s1", status: "completed", created_at: "2026-01-01T10:00:00.000Z" },
    { session_id: "s2", status: "completed", created_at: "2026-01-02T10:00:00.000Z" }
  ]);
  render(<AthleteTodayHistoryCountBadge />);
  await screen.findByText("2");
});

test("shows a session's status and event count", async () => {
  installMocks([
    { session_id: "s1", status: "in_progress", runtime_event_count: 3, updated_at: "2026-01-05T10:00:00.000Z" }
  ]);
  render(<AthleteTodayRecentActivityList />);
  await screen.findByText("Training session");
  assert.ok(screen.getByText("In Progress"));
  assert.ok(screen.getByText("3 events"));
});

test("caps the preview at the 4 most recent sessions, newest first", async () => {
  const sessions = Array.from({ length: 6 }, (_, index) => ({
    session_id: `s${index}`,
    status: "recorded",
    runtime_event_count: index,
    created_at: `2026-01-0${index + 1}T10:00:00.000Z`
  }));
  installMocks(sessions);
  render(<AthleteTodayRecentActivityList />);
  await screen.findByText("5 events");
  assert.equal(document.querySelectorAll(".record-card").length, 4);
  assert.equal(screen.queryByText("0 events"), null);
  assert.equal(screen.queryByText("1 events"), null);
});

test("clicking a session card dispatches kolosseum:continue-history-session with the session id", async () => {
  installMocks([{ session_id: "s1", status: "completed", runtime_event_count: 5, created_at: "2026-01-05T10:00:00.000Z" }]);

  let received: { session_id?: string } | undefined;
  document.addEventListener("kolosseum:continue-history-session", (event) => {
    received = (event as CustomEvent).detail;
  });

  render(<AthleteTodayRecentActivityList />);
  await screen.findByText("Training session");

  act(() => {
    document.querySelector(".record-card")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  assert.deepEqual(received, { session_id: "s1" });
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks([]);
  render(<AthleteTodayRecentActivityList />);
  await screen.findByText("No recent sessions are recorded.");

  installMocks([{ session_id: "s1", status: "completed", runtime_event_count: 1, created_at: "2026-01-05T10:00:00.000Z" }]);

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));
  });

  await screen.findByText("Training session");
});
