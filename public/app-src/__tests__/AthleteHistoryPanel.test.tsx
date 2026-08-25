// DEV NOTE: athlete training history behavioral proof - replaces the
// source-text regex checks against the now-removed app.js
// populateHistoryFilterOptions()/applyHistoryFilters()/clearHistoryFilters()/
// renderHistoryList()/historyRecordCard()/openHistoryDetail()/
// renderHistoryDetail()/renderVideoSubmissionCard() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { AthleteHistoryPanel } from "../screens/athlete/AthleteHistoryPanel";

const ATHLETE_USER_ID = "athlete_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  sessions?: Record<string, unknown>[];
  filteredSessions?: Record<string, unknown>[];
  detail?: Record<string, unknown>;
  submissions?: Record<string, unknown>[];
  historyFails?: boolean;
}) {
  const { sessions = [], filteredSessions, detail, submissions = [], historyFails = false } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: ATHLETE_USER_ID } });
    if (path.startsWith("/sessions/beta-athlete-history-detail")) {
      return detail ? jsonResponse(detail) : jsonResponse({ error: "not_found" }, false, 404);
    }
    if (path.startsWith("/sessions/beta-athlete-history")) {
      if (historyFails) return jsonResponse({ error: "service_unavailable" }, false, 500);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const hasFilters = ["status", "date_from", "date_to", "activity_id", "template_id", "event_id"].some((key) => body[key]);
      return jsonResponse({ ok: true, sessions: hasFilters && filteredSessions ? filteredSessions : sessions });
    }
    if (path.startsWith("/video-feedback/submissions")) return jsonResponse({ ok: true, submissions });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when no sessions are recorded", async () => {
  installMocks({ sessions: [] });
  render(<AthleteHistoryPanel />);
  await waitFor(() => screen.getByText("No sessions recorded"));
  assert.ok(screen.getByText("Your persisted session history will appear here."));
});

test("shows the unavailable panel with a working retry on fetch failure", async () => {
  installMocks({ historyFails: true });
  render(<AthleteHistoryPanel />);
  await waitFor(() => screen.getByText("History could not be loaded"));

  installMocks({ sessions: [{ session_id: "s1", execution_status: "completed", completed_count: 3, created_at: "2026-01-05T10:00:00.000Z" }] });
  const retryButton = screen.getByText("Retry");
  await act(async () => {
    retryButton.click();
  });

  await waitFor(() => screen.getByText("Training session"));
});

test("renders a session card with programme/event name, date, status and completed/dropped counts", async () => {
  installMocks({
    sessions: [
      {
        session_id: "s1",
        execution_status: "partial",
        completed_count: 4,
        dropped_count: 1,
        created_at: "2026-01-05T10:00:00.000Z",
        provenance: {
          programme: { template_id: "t1", template_name: "Peak Block" },
          event: { event_id: "e1", event_name: "Regional Meet" }
        }
      }
    ]
  });

  render(<AthleteHistoryPanel />);

  await waitFor(() => document.querySelector(".record-card"));
  const card = document.querySelector(".record-card") as HTMLElement;
  assert.equal(within(card).getByRole("heading").textContent, "Peak Block");
  assert.match(card.textContent ?? "", /Regional Meet/u);
  assert.ok(within(card).getByText("4 completed"));
  assert.ok(within(card).getByText("1 dropped"));
  const badges = card.querySelectorAll(".badge");
  assert.equal(badges[0].textContent, "Partial");
});

test("the activity/programme/event filter dropdowns are populated from the fetched sessions", async () => {
  installMocks({
    sessions: [
      {
        session_id: "s1",
        activity_id: "powerlifting",
        execution_status: "completed",
        created_at: "2026-01-05T10:00:00.000Z",
        provenance: {
          programme: { template_id: "t1", template_name: "Peak Block" },
          event: { event_id: "e1", event_name: "Regional Meet" }
        }
      }
    ]
  });

  render(<AthleteHistoryPanel />);
  await waitFor(() => screen.getByText("Powerlifting"));

  const programmeSelect = screen.getByDisplayValue("All programmes");
  assert.ok(within(programmeSelect as HTMLElement).getByText("Peak Block"));
  const eventSelect = screen.getByDisplayValue("All events");
  assert.ok(within(eventSelect as HTMLElement).getByText("Regional Meet"));
});

test("apply filters sends a real server round-trip with the selected values, and shows the filtered result", async () => {
  installMocks({
    sessions: [
      { session_id: "s1", execution_status: "completed", created_at: "2026-01-01T10:00:00.000Z" },
      { session_id: "s2", execution_status: "partial", created_at: "2026-01-02T10:00:00.000Z" }
    ],
    filteredSessions: [
      { session_id: "s1", execution_status: "completed", created_at: "2026-01-01T10:00:00.000Z" }
    ]
  });

  render(<AthleteHistoryPanel />);
  await waitFor(() => screen.getAllByText("Training session").length === 2);

  const statusSelect = screen.getByDisplayValue("All statuses");
  fireEvent.change(statusSelect, { target: { value: "completed" } });

  const applyButton = screen.getByText("Apply filters");
  await act(async () => {
    applyButton.click();
  });

  await waitFor(() => {
    const cards = document.querySelectorAll(".record-card");
    assert.equal(cards.length, 1);
  });
});

test("clear filters resets to the last unfiltered fetch without a new request", async () => {
  installMocks({
    sessions: [
      { session_id: "s1", execution_status: "completed", created_at: "2026-01-01T10:00:00.000Z" },
      { session_id: "s2", execution_status: "partial", created_at: "2026-01-02T10:00:00.000Z" }
    ],
    filteredSessions: [
      { session_id: "s1", execution_status: "completed", created_at: "2026-01-01T10:00:00.000Z" }
    ]
  });

  render(<AthleteHistoryPanel />);
  await waitFor(() => {
    assert.equal(document.querySelectorAll(".record-card").length, 2);
  });

  const statusSelect = screen.getByDisplayValue("All statuses");
  fireEvent.change(statusSelect, { target: { value: "completed" } });
  await act(async () => {
    screen.getByText("Apply filters").click();
  });
  await waitFor(() => {
    assert.equal(document.querySelectorAll(".record-card").length, 1);
  });

  await act(async () => {
    screen.getByText("Clear filters").click();
  });

  assert.equal(document.querySelectorAll(".record-card").length, 2);
  assert.equal((screen.getByDisplayValue("All statuses") as HTMLSelectElement).value, "");
});

test("opening a session shows its detail: facts, exercises, and a continue-session button that dispatches the reverse bridge", async () => {
  installMocks({
    sessions: [{ session_id: "s1", execution_status: "in_progress", created_at: "2026-01-05T10:00:00.000Z" }],
    detail: {
      session_id: "s1",
      execution_status: "in_progress",
      created_at: "2026-01-05T10:00:00.000Z",
      split_entered: true,
      split_return_decision: "continue",
      exercises: [
        { exercise_id: "ex1", planned: { display_name: "Back Squat" }, recorded_state: "completed" },
        { exercise_id: "ex2", planned: { display_name: "Bench Press" }, recorded_state: "remaining" }
      ],
      provenance: {
        programme: { template_name: "Peak Block", template_version: 2 },
        assignment: { assignment_id: "assign_1" },
        event: { event_name: "Regional Meet" }
      },
      split_return_events: []
    }
  });

  render(<AthleteHistoryPanel />);
  await waitFor(() => screen.getByText("Training session"));

  await act(async () => {
    document.querySelector(".record-card")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  await waitFor(() => screen.getByText("Back Squat"));
  assert.ok(screen.getByText("Bench Press"));
  assert.ok(screen.getByText("Peak Block (v2)"));
  assert.ok(screen.getByText("assign_1"));
  assert.ok(screen.getByText("Regional Meet"));
  assert.ok(screen.getByText("Yes"));

  let dispatchedSessionId: string | undefined;
  document.addEventListener("kolosseum:continue-history-session", (event) => {
    dispatchedSessionId = (event as CustomEvent<{ session_id?: string }>).detail?.session_id;
  });

  const continueButton = screen.getByText("Continue session");
  await act(async () => {
    continueButton.click();
  });

  assert.equal(dispatchedSessionId, "s1");

  const closeButton = screen.getByText("Close detail");
  await act(async () => {
    closeButton.click();
  });

  assert.equal(screen.queryByText("Back Squat"), null);
});

test("video feedback submissions render in the detail panel, inert to markup", async () => {
  installMocks({
    sessions: [{ session_id: "s1", execution_status: "completed", created_at: "2026-01-05T10:00:00.000Z" }],
    detail: {
      session_id: "s1",
      execution_status: "completed",
      created_at: "2026-01-05T10:00:00.000Z",
      exercises: [],
      provenance: {}
    },
    submissions: [
      {
        submission_id: "sub1",
        exercise_label: '<img src=x onerror="window.pwned=true">',
        review_status: "reviewed",
        url: "https://example.com/video.mp4",
        caption: "Good depth",
        feedback: [{ feedback_text: "Nice work" }]
      }
    ]
  });

  render(<AthleteHistoryPanel />);
  await waitFor(() => screen.getByText("Training session"));

  await act(async () => {
    document.querySelector(".record-card")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.ok(screen.getByText("Reviewed"));
  assert.ok(screen.getByText("Good depth"));
  assert.ok(screen.getByText("Coach: Nice work"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({ sessions: [] });
  render(<AthleteHistoryPanel />);
  await waitFor(() => screen.getByText("No sessions recorded"));

  installMocks({ sessions: [{ session_id: "s1", execution_status: "completed", created_at: "2026-01-05T10:00:00.000Z" }] });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));
  });

  await waitFor(() => screen.getByText("Training session"));
});

test("kolosseum:history-detail-route opens the matching session's detail directly", async () => {
  installMocks({
    sessions: [{ session_id: "s1", execution_status: "completed", created_at: "2026-01-05T10:00:00.000Z" }],
    detail: {
      session_id: "s1",
      execution_status: "completed",
      created_at: "2026-01-05T10:00:00.000Z",
      exercises: [],
      provenance: {}
    }
  });

  render(<AthleteHistoryPanel />);
  await waitFor(() => screen.getByText("Training session"));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:history-detail-route", { detail: { session_id: "s1" } }));
  });

  await waitFor(() => screen.getByText("Session detail"));
});
