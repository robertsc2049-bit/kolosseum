// DEV NOTE: behavioral proof replacing the source-text regex checks that
// used to run against app.js's (removed) refreshCoachAthleteMessages()/
// renderCoachAthleteMessages()/openComposeAthleteMessagePanel()/
// closeComposeAthleteMessagePanel()/confirmSendAthleteMessage().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachAthleteMessagePanel } from "../screens/coach/CoachAthleteMessagePanel";

const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: {
  threads?: Record<string, unknown>[];
  messages?: Record<string, unknown>[];
  sendFails?: boolean;
} = {}) {
  const { threads = [{ thread_id: "thread_1", athlete_user_id: "athlete_1" }], messages = [], sendFails = false } = options;
  const calls: Array<{ path: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, init });

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/messages/coach/threads") {
      return jsonResponse({ threads });
    }
    if (path === "/messages/coach/threads/thread_1") {
      return jsonResponse({ messages });
    }
    if (path === "/messages/coach/athletes/athlete_1/send") {
      if (sendFails) return jsonResponse({ error: "message_send_failed" }, false, 400);
      return jsonResponse({ ok: true }, true, 201);
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;

  return calls;
}

function openProfile(athleteUserId = "athlete_1") {
  return act(async () => {
    document.dispatchEvent(new CustomEvent(OPENED_EVENT, { detail: { athlete_user_id: athleteUserId } }));
  });
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until an athlete profile opens", () => {
  installMocks();
  const { container } = render(<CoachAthleteMessagePanel />);
  assert.equal(container.innerHTML, "");
});

test("shows a factual empty state when there is no message thread yet", async () => {
  installMocks({ threads: [] });
  render(<CoachAthleteMessagePanel />);
  await openProfile();

  await screen.findByText("No messages yet.");
});

test("loads and displays message history with the correct sender badges", async () => {
  installMocks({
    messages: [
      { message_id: "m1", sender_role: "coach", body_text: "How did the session go?", created_at_iso8601: "2026-08-20T10:00:00.000Z" },
      { message_id: "m2", sender_role: "athlete", body_text: "Great, hit a new PR!", created_at_iso8601: "2026-08-20T11:00:00.000Z" }
    ]
  });
  render(<CoachAthleteMessagePanel />);
  await openProfile();

  await screen.findByText("How did the session go?");
  assert.ok(screen.getByText("Great, hit a new PR!"));
  const badges = screen.getAllByText(/^(You|Athlete)$/u);
  assert.deepEqual(badges.map((entry) => entry.textContent), ["You", "Athlete"]);
});

test("opening a thread dispatches a directory refresh so the unread badge updates", async () => {
  installMocks({ messages: [{ message_id: "m1", sender_role: "athlete", body_text: "Hi", created_at_iso8601: "2026-08-20T10:00:00.000Z" }] });
  let refreshed = false;
  document.addEventListener("kolosseum:athlete-directory-changed", () => { refreshed = true; });

  render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("Hi");

  assert.equal(refreshed, true);
});

test("clicking Send message reveals the compose form", async () => {
  installMocks();
  render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("No messages yet.");

  assert.equal(screen.queryByText("Send"), null);
  fireEvent.click(screen.getByText("Send message"));
  assert.ok(screen.getByText("Send"));
  assert.ok(screen.getByText("Cancel"));
});

test("Cancel hides the compose form again", async () => {
  installMocks();
  render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("No messages yet.");

  fireEvent.click(screen.getByText("Send message"));
  fireEvent.click(screen.getByText("Cancel"));
  assert.equal(screen.queryByText("Send"), null);
});

test("sending a message posts the CSRF-guarded request, closes the compose form, and refetches", async () => {
  const calls = installMocks();
  render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("No messages yet.");

  fireEvent.click(screen.getByText("Send message"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great work today." } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  assert.equal(screen.queryByText("Cancel"), null);
  const sendCall = calls.find((entry) => entry.path === "/messages/coach/athletes/athlete_1/send");
  assert.ok(sendCall);
  assert.equal((sendCall?.init?.headers as Record<string, string>)?.["x-kolosseum-csrf"], "csrf-abc");
  const body = JSON.parse(String(sendCall?.init?.body));
  assert.equal(body.body_text, "Great work today.");
});

test("an empty message with no attachment shows a validation error and never sends", async () => {
  const calls = installMocks();
  render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("No messages yet.");

  fireEvent.click(screen.getByText("Send message"));
  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  await screen.findByText("Enter a message or attach a photo/video before sending.");
  assert.equal(calls.some((entry) => entry.path === "/messages/coach/athletes/athlete_1/send"), false);
});

test("a failed send shows a factual error", async () => {
  installMocks({ sendFails: true });
  render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("No messages yet.");

  fireEvent.click(screen.getByText("Send message"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  await screen.findByText("message_send_failed");
});

test("a live-pushed message for the currently-open thread is appended without a manual refresh", async () => {
  installMocks();
  render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("No messages yet.");

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-message-received", {
      detail: {
        thread: { thread_id: "thread_1" },
        message: { message_id: "m_live", sender_role: "athlete", body_text: "Live push", created_at_iso8601: "2026-08-20T12:00:00.000Z" }
      }
    }));
  });

  await screen.findByText("Live push");
});

test("a live push for a different thread is ignored", async () => {
  installMocks();
  render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("No messages yet.");

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-message-received", {
      detail: {
        thread: { thread_id: "some_other_thread" },
        message: { message_id: "m_other", sender_role: "athlete", body_text: "Not for this thread", created_at_iso8601: "2026-08-20T12:00:00.000Z" }
      }
    }));
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(screen.queryByText("Not for this thread"), null);
});

test("a message body containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    messages: [{ message_id: "m1", sender_role: "athlete", body_text: '<img src=x onerror="window.pwned=true">', created_at_iso8601: "2026-08-20T10:00:00.000Z" }]
  });
  render(<CoachAthleteMessagePanel />);
  await openProfile();

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(document.querySelector(".review-note-card")?.textContent?.includes("<img"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".review-note-card img").length, 0);
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  installMocks();
  const { container } = render(<CoachAthleteMessagePanel />);
  await openProfile();
  await screen.findByText("No messages yet.");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(CLOSED_EVENT));
  });

  assert.equal(container.innerHTML, "");
});
