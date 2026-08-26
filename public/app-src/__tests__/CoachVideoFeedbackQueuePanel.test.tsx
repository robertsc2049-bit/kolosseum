// DEV NOTE: coach video-feedback queue behavioral proof - replaces the
// source-text regex checks against the now-removed app.js
// videoFeedbackQueueCard()/renderVideoFeedbackDetail()/
// filteredVideoFeedbackQueue()/refreshVideoFeedbackQueue()/
// submitVideoFeedback() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CoachVideoFeedbackQueuePanel } from "../screens/coach/CoachVideoFeedbackQueuePanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  submissions?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  replyFails?: boolean;
}) {
  const { submissions = [], relationships = [], replyFails = false } = options;
  let currentSubmissions = submissions;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path.startsWith("/coach-workspace/video-feedback/queue") && method === "GET") {
      return jsonResponse({ ok: true, submissions: currentSubmissions });
    }
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ ok: true, relationships });
    }
    if (path.match(/\/coach-workspace\/video-feedback\/submissions\/.+\/feedback$/u) && method === "POST") {
      if (replyFails) return jsonResponse({ error: "feedback_text_required" }, false, 400);
      const submissionId = decodeURIComponent(path.split("/")[4]);
      currentSubmissions = currentSubmissions.filter((s) => s.submission_id !== submissionId);
      return jsonResponse({ ok: true, submission: { submission_id: submissionId, review_status: "reviewed" } }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function cardHeading(index = 0): string | null | undefined {
  return document.querySelectorAll(".record-card h3")[index]?.textContent;
}

function detailHeading(): string | null | undefined {
  return document.querySelector(".review-detail h3")?.textContent;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when no submissions are pending", async () => {
  installMocks({});
  render(<CoachVideoFeedbackQueuePanel />);
  await waitFor(() => screen.getByText("No pending video submissions"));
  assert.ok(screen.getByText("No pending video submissions."));
});

test("renders a queue card with exercise, athlete name and date, and auto-selects the first submission's detail", async () => {
  installMocks({
    submissions: [
      { submission_id: "sub_1", exercise_label: "Back Squat", athlete_user_id: "athlete_1", created_at: "2026-08-20T10:00:00.000Z", url: "/sub_1/media", caption: "Depth check" }
    ],
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Jordan Lee" }]
  });

  render(<CoachVideoFeedbackQueuePanel />);
  await waitFor(() => assert.equal(cardHeading(), "Back Squat"));

  assert.ok(screen.getByText("Jordan Lee"));
  assert.ok(screen.getByText("1 video submission awaiting review."));
  assert.equal(detailHeading(), "Back Squat");
  assert.ok(screen.getByText("Depth check"));
  assert.ok(document.querySelector("video source"));
});

test("falls back to the raw athlete_user_id when no relationship record resolves a display name", async () => {
  installMocks({
    submissions: [
      { submission_id: "sub_1", exercise_label: "Deadlift", athlete_user_id: "athlete_unknown", created_at: "2026-08-20T10:00:00.000Z", url: "/sub_1/media" }
    ],
    relationships: []
  });

  render(<CoachVideoFeedbackQueuePanel />);
  await waitFor(() => assert.equal(cardHeading(), "Deadlift"));
  assert.ok(document.querySelector(".record-card")?.textContent?.includes("athlete_unknown"));
});

test("distinguishes zero pending submissions from zero search matches", async () => {
  installMocks({
    submissions: [
      { submission_id: "sub_1", exercise_label: "Bench Press", athlete_user_id: "athlete_1", created_at: "2026-08-20T10:00:00.000Z", url: "/sub_1/media" }
    ],
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Jordan Lee" }]
  });

  render(<CoachVideoFeedbackQueuePanel />);
  await waitFor(() => assert.equal(cardHeading(), "Bench Press"));

  const search = screen.getByPlaceholderText("Athlete or exercise");
  fireEvent.change(search, { target: { value: "nonexistent" } });

  await waitFor(() => screen.getByText("No submissions match"));
  assert.equal(screen.queryByText("No pending video submissions"), null);
});

test("search filters by both exercise label and resolved athlete name", async () => {
  installMocks({
    submissions: [
      { submission_id: "sub_1", exercise_label: "Bench Press", athlete_user_id: "athlete_1", created_at: "2026-08-20T10:00:00.000Z", url: "/sub_1/media" },
      { submission_id: "sub_2", exercise_label: "Overhead Press", athlete_user_id: "athlete_2", created_at: "2026-08-21T10:00:00.000Z", url: "/sub_2/media" }
    ],
    relationships: [
      { athlete_user_id: "athlete_1", display_name: "Jordan Lee" },
      { athlete_user_id: "athlete_2", display_name: "Sam Patel" }
    ]
  });

  render(<CoachVideoFeedbackQueuePanel />);
  await waitFor(() => assert.equal(document.querySelectorAll(".record-card").length, 2));

  const search = screen.getByPlaceholderText("Athlete or exercise");
  fireEvent.change(search, { target: { value: "sam" } });

  await waitFor(() => {
    assert.equal(document.querySelectorAll(".record-card").length, 1);
    assert.equal(cardHeading(), "Overhead Press");
  });
});

test("clicking another card selects its detail", async () => {
  installMocks({
    submissions: [
      { submission_id: "sub_1", exercise_label: "Bench Press", athlete_user_id: "athlete_1", created_at: "2026-08-20T10:00:00.000Z", url: "/sub_1/media" },
      { submission_id: "sub_2", exercise_label: "Overhead Press", athlete_user_id: "athlete_2", created_at: "2026-08-21T10:00:00.000Z", url: "/sub_2/media" }
    ],
    relationships: []
  });

  render(<CoachVideoFeedbackQueuePanel />);
  await waitFor(() => assert.equal(document.querySelectorAll(".record-card").length, 2));
  assert.equal(detailHeading(), "Bench Press");

  const secondCard = document.querySelectorAll(".record-card")[1] as HTMLElement;
  fireEvent.click(secondCard);

  await waitFor(() => assert.equal(detailHeading(), "Overhead Press"));
});

test("sending feedback removes the submission from the queue", async () => {
  installMocks({
    submissions: [
      { submission_id: "sub_1", exercise_label: "Bench Press", athlete_user_id: "athlete_1", created_at: "2026-08-20T10:00:00.000Z", url: "/sub_1/media" }
    ],
    relationships: [{ athlete_user_id: "athlete_1", display_name: "Jordan Lee" }]
  });

  render(<CoachVideoFeedbackQueuePanel />);
  await waitFor(() => assert.equal(cardHeading(), "Bench Press"));

  const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: "Great depth, watch the knee cave." } });

  const sendButton = screen.getByText("Send feedback");
  fireEvent.click(sendButton);

  await waitFor(() => screen.getByText("No pending video submissions"));
});

test("shows a submit error when the server rejects the feedback", async () => {
  installMocks({
    submissions: [
      { submission_id: "sub_1", exercise_label: "Bench Press", athlete_user_id: "athlete_1", created_at: "2026-08-20T10:00:00.000Z", url: "/sub_1/media" }
    ],
    relationships: [],
    replyFails: true
  });

  render(<CoachVideoFeedbackQueuePanel />);
  await waitFor(() => assert.equal(cardHeading(), "Bench Press"));

  const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: "Feedback text" } });
  fireEvent.click(screen.getByText("Send feedback"));

  await waitFor(() => screen.getByText("Feedback could not be sent."));
});

test("an exercise label containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    submissions: [
      { submission_id: "sub_1", exercise_label: '<img src=x onerror="window.pwned=true">', athlete_user_id: "athlete_1", created_at: "2026-08-20T10:00:00.000Z", url: "/sub_1/media" }
    ],
    relationships: []
  });

  render(<CoachVideoFeedbackQueuePanel />);

  await waitFor(() => assert.match(cardHeading() ?? "", /img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".record-card img").length, 0);
});
