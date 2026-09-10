// DEV NOTE: FULL-UI-17 review queue behavioral proof - replaces the
// source-text regex checks against the now-removed app.js
// renderCoachReviewWorkspace()/renderCoachReviewDetail()/
// setCoachSessionReview()/recordCoachNote() rendering block. Card titles
// are queried via document.querySelectorAll(".review-record-card h3")
// rather than screen.getByText(), since the auto-selected record's title
// is also rendered in the detail pane - the same card/detail ambiguity
// CoachVideoFeedbackQueuePanel.test.tsx already works around.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CoachReviewPanel } from "../screens/coach/CoachReviewPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function baseRecord(overrides: Record<string, unknown> = {}) {
  return {
    session_id: "session_1",
    artefact_id: "beta_e2e_artefact_session_1",
    athlete_user_id: "athlete_1",
    block_id: "block_1",
    session_title: "Upper body strength",
    session_status: "recorded",
    runtime_event_count: 12,
    planned_work_item_count: 5,
    exercise_ids: ["bench_press", "overhead_press"],
    assignment_id: "assignment_1",
    assignment_provenance: { template_id: "template_1", template_name: "Strength block", template_version: 2, activity_id: "powerlifting" },
    event_provenance: null,
    review_status: "unreviewed",
    notes: [],
    note_count: 0,
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
    ...overrides
  };
}

function installMocks(options: {
  records?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  markFails?: boolean;
  noteFails?: boolean;
  onNoteSubmit?: (body: Record<string, unknown>) => void;
  summariesBySessionId?: Record<string, Record<string, unknown>>;
}) {
  const {
    records = [baseRecord()],
    relationships = [{ athlete_user_id: "athlete_1", display_name: "Jordan Athlete", relationship: { relationship_id: "rel_1" } }],
    markFails = false,
    noteFails = false,
    onNoteSubmit,
    summariesBySessionId = {}
  } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc", bootstrap: { coach_profile: { coach_user_id: "coach_1" } } });
    }
    if (path.startsWith("/coach-workspace/reviews")) {
      return jsonResponse({ records });
    }
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ relationships });
    }
    if (path.startsWith("/coach-workspace/session-review/")) {
      if (markFails) return jsonResponse({ error: "session_review_stale" }, false, 409);
      return jsonResponse({ ok: true, review: { review_status: "reviewed" } }, true, 201);
    }
    if (path === "/sessions/beta-coach-notes") {
      if (noteFails) return jsonResponse({ error: "coach_note_text_required" }, false, 400);
      if (onNoteSubmit && typeof init?.body === "string") onNoteSubmit(JSON.parse(init.body));
      return jsonResponse({ ok: true, coach_note: { note_id: "note_1" } }, true, 201);
    }
    const summaryMatch = /^\/sessions\/([^/]+)\/summary$/u.exec(path);
    if (summaryMatch) {
      const summary = summariesBySessionId[summaryMatch[1]];
      return summary ? jsonResponse(summary) : jsonResponse({ error: "not_found" }, false, 404);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function cardTitles(): string[] {
  return [...document.querySelectorAll(".review-record-card h3")].map((el) => el.textContent ?? "");
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when there are no matching review records", async () => {
  installMocks({ records: [] });
  render(<CoachReviewPanel />);

  await waitFor(() => screen.getByText("No matching review records"));
});

test("loads and displays a review record with the resolved athlete name and status badge", async () => {
  installMocks({});
  render(<CoachReviewPanel />);

  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));
  assert.ok(document.querySelector(".review-record-card")?.textContent?.includes("Jordan Athlete"));
  assert.ok(screen.getAllByText("Awaiting review").length > 0);
});

test("search filters the list by athlete name and session title", async () => {
  installMocks({
    records: [
      baseRecord({ session_id: "s1", session_title: "Upper body strength" }),
      baseRecord({ session_id: "s2", session_title: "Lower body power", athlete_user_id: "athlete_2" })
    ],
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Athlete", relationship: { relationship_id: "rel_1" } },
      { athlete_user_id: "athlete_2", display_name: "Sam Athlete", relationship: { relationship_id: "rel_2" } }
    ]
  });
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles().sort(), ["Lower body power", "Upper body strength"]));

  fireEvent.change(screen.getByPlaceholderText("Athlete, session or programme"), { target: { value: "lower" } });

  await waitFor(() => assert.deepEqual(cardTitles(), ["Lower body power"]));
});

test("the status filter defaults to awaiting review and can show all records", async () => {
  installMocks({
    records: [
      baseRecord({ session_id: "s1", review_status: "unreviewed" }),
      baseRecord({ session_id: "s2", session_title: "Reviewed session", review_status: "reviewed" })
    ]
  });
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  fireEvent.change(screen.getByDisplayValue("Awaiting review"), { target: { value: "all" } });

  await waitFor(() => assert.deepEqual(cardTitles().sort(), ["Reviewed session", "Upper body strength"]));
});

test("the kolosseum:open-session-review bridge event preselects the athlete filter", async () => {
  installMocks({
    records: [
      baseRecord({ session_id: "s1", athlete_user_id: "athlete_1" }),
      baseRecord({ session_id: "s2", session_title: "Athlete two session", athlete_user_id: "athlete_2" })
    ],
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Athlete", relationship: { relationship_id: "rel_1" } },
      { athlete_user_id: "athlete_2", display_name: "Sam Athlete", relationship: { relationship_id: "rel_2" } }
    ]
  });
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles().sort(), ["Athlete two session", "Upper body strength"]));

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:open-session-review", { detail: { athlete_user_id: "athlete_2" } }));
  });

  await waitFor(() => assert.deepEqual(cardTitles(), ["Athlete two session"]));
});

test("the kolosseum:open-session-review bridge dispatches a not-found event for an unknown athlete", async () => {
  installMocks({});
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  let notFoundFired = false;
  document.addEventListener("kolosseum:coach-review-athlete-not-found", () => {
    notFoundFired = true;
  });

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:open-session-review", { detail: { athlete_user_id: "athlete_unknown" } }));
  });

  await waitFor(() => assert.ok(notFoundFired));
});

test("marking a session reviewed asks for confirmation and refreshes the record", async () => {
  installMocks({});
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  const originalConfirm = window.confirm;
  window.confirm = () => true;
  try {
    installMocks({ records: [baseRecord({ review_status: "reviewed" })] });
    fireEvent.click(screen.getAllByText("Mark reviewed")[0]);
    await waitFor(() => assert.ok(screen.getAllByText("Reviewed").length > 0));
  }
  finally {
    window.confirm = originalConfirm;
  }
});

test("declining the confirmation does not submit the review status change", async () => {
  installMocks({});
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  const originalConfirm = window.confirm;
  let confirmCalled = false;
  window.confirm = () => {
    confirmCalled = true;
    return false;
  };
  try {
    fireEvent.click(screen.getAllByText("Mark reviewed")[0]);
    await waitFor(() => assert.ok(confirmCalled));
    assert.ok(screen.getAllByText("Awaiting review").length > 0);
  }
  finally {
    window.confirm = originalConfirm;
  }
});

test("adding a note requires an accepted relationship, submits, and clears the form on success", async () => {
  installMocks({});
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  fireEvent.click(screen.getAllByText("Add note")[0]);
  await waitFor(() => screen.getByText("Add note for Jordan Athlete"));

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great effort today." } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  await waitFor(() => assert.equal(screen.queryByText("Add note for Jordan Athlete"), null));
});

test("a note can be scoped to a specific exercise on the session", async () => {
  let postedBody: Record<string, unknown> | null = null;
  installMocks({ onNoteSubmit: (body) => { postedBody = body; } });
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  fireEvent.click(screen.getAllByText("Add note")[0]);
  await waitFor(() => screen.getByText("Add note for Jordan Athlete"));

  fireEvent.change(screen.getByText("Exercise").closest("label")!.querySelector("select")!, { target: { value: "overhead_press" } });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Depth was shallow on the last set." } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  await waitFor(() => assert.equal(postedBody?.exercise_id, "overhead_press"));
});

test("a whole-session note (no exercise selected) posts a null exercise_id", async () => {
  let postedBody: Record<string, unknown> | null = null;
  installMocks({ onNoteSubmit: (body) => { postedBody = body; } });
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  fireEvent.click(screen.getAllByText("Add note")[0]);
  await waitFor(() => screen.getByText("Add note for Jordan Athlete"));

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great effort today." } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  await waitFor(() => assert.equal(postedBody?.exercise_id, null));
});

test("shows an error when the note fails to submit", async () => {
  installMocks({ noteFails: true });
  render(<CoachReviewPanel />);
  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  fireEvent.click(screen.getAllByText("Add note")[0]);
  await waitFor(() => screen.getByText("Add note for Jordan Athlete"));

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Record note").closest("form")!);
  });

  await waitFor(() => screen.getByText("The note could not be recorded."));
});

test("an athlete name and session title containing markup render as inert text, never as HTML", async () => {
  installMocks({
    records: [baseRecord({ session_title: '<img src=x onerror="window.pwned=true">' })],
    relationships: [{ athlete_user_id: "athlete_1", display_name: '<img src=y onerror="window.pwned=true">', relationship: { relationship_id: "rel_1" } }]
  });
  render(<CoachReviewPanel />);

  await waitFor(() => assert.equal(cardTitles().length, 1));
  assert.ok(document.querySelector(".review-record-card")?.textContent?.includes('<img src=y onerror="window.pwned=true">'));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".review-record-card img").length, 0);
});

test("the open review record's detail shows the neutral session summary facts fetched from GET /sessions/:sessionId/summary", async () => {
  installMocks({
    summariesBySessionId: {
      session_1: {
        session_id: "session_1",
        run_id: "session_1",
        status: "completed",
        prescribed_items_total: 5,
        prescribed_items_completed: 4,
        prescribed_items_skipped: 1,
        prescribed_items_remaining: 0,
        extra_work_event_count: 2,
        split_event_count: 3,
        return_continue_count: 7,
        return_skip_count: 1,
        runtime_event_count: 12,
        started_at_utc: "2026-08-20T09:00:00.000Z",
        completed_at_utc: "2026-08-20T10:00:00.000Z"
      }
    }
  });
  render(<CoachReviewPanel />);

  await waitFor(() => assert.deepEqual(cardTitles(), ["Upper body strength"]));

  const factGrids = await waitFor(() => {
    const grids = document.querySelectorAll(".review-detail .review-fact-grid");
    assert.equal(grids.length, 3, "expected the session facts grid, the new neutral session summary grid, then the provenance grid");
    return grids;
  });

  const summaryFacts = Array.from(factGrids[1].querySelectorAll("dd")).map((el) => el.textContent);
  assert.deepEqual(summaryFacts, ["4", "1", "0", "3", "7", "1"]);
});
