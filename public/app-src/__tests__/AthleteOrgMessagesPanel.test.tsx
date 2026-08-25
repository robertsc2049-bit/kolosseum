// DEV NOTE: Part O.8 coach read-only org-messages mirror behavioral proof -
// replaces the source-text regex checks in
// test/org_athlete_messaging_coach_visibility_surface.test.mjs previously
// run against the now-removed app.js refreshCoachAthleteOrgMessages/
// renderCoachAthleteOrgMessages functions.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteOrgMessagesPanel } from "../screens/coach/AthleteOrgMessagesPanel";

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

async function openPanel(threads: Record<string, unknown>[], messagesByThreadId: Record<string, Record<string, unknown>[]>) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.endsWith("/org-messages/threads")) return jsonResponse({ threads });
    const match = /\/org-messages\/threads\/([^/?]+)$/u.exec(path);
    if (match) return jsonResponse({ messages: messagesByThreadId[match[1]] ?? [] });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteOrgMessagesPanel />);

  act(() => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:coach-athlete-profile-opened", {
        detail: { athlete_user_id: "athlete_test123" }
      })
    );
  });
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the coach opens an athlete's profile", () => {
  installFetchMock(() => jsonResponse({}, false, 404));
  render(<AthleteOrgMessagesPanel />);
  assert.equal(document.body.textContent, "");
});

test("displays an org-owner message and an athlete-reply with the thread's org name and each message's date", async () => {
  await openPanel(
    [{ thread_id: "thread_1", org_name: "Ironclad Barbell" }],
    {
      thread_1: [
        {
          message_id: "msg_1",
          sender_role: "org_owner",
          body_text: "Reminder: gym closed Monday for maintenance.",
          created_at_iso8601: "2026-08-20T10:00:00.000Z"
        },
        {
          message_id: "msg_2",
          sender_role: "athlete",
          body_text: "Thanks for the heads up!",
          created_at_iso8601: "2026-08-21T10:00:00.000Z"
        }
      ]
    }
  );

  await waitFor(() => screen.getByText("Reminder: gym closed Monday for maintenance."));

  assert.ok(screen.getByText("Ironclad Barbell", { selector: "strong" }));
  assert.ok(screen.getAllByText("Ironclad Barbell").length >= 2);
  assert.ok(screen.getByText("Athlete"));
  assert.ok(screen.getByText("Thanks for the heads up!"));
  assert.match(document.body.textContent ?? "", /20 Aug 2026/u);
  assert.match(document.body.textContent ?? "", /21 Aug 2026/u);
});

test("renders an image attachment with its formatted size caption", async () => {
  await openPanel(
    [{ thread_id: "thread_1", org_name: "Ironclad Barbell" }],
    {
      thread_1: [
        {
          message_id: "msg_1",
          sender_role: "org_owner",
          body_text: "",
          created_at_iso8601: "2026-08-20T10:00:00.000Z",
          attachment: { media_type: "image", url: "https://cdn.example/photo.jpg", byte_size: 2048 }
        }
      ]
    }
  );

  await waitFor(() => screen.getByAltText("Attached photo"));
  assert.equal((screen.getByAltText("Attached photo") as HTMLImageElement).src, "https://cdn.example/photo.jpg");
  assert.ok(screen.getByText("2.0 KB"));
});

test("shows a factual empty state when the athlete's org has sent no messages yet", async () => {
  await openPanel([], {});
  await waitFor(() => screen.getByText("No team messages yet."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel(
    [{ thread_id: "thread_1", org_name: "Ironclad Barbell" }],
    { thread_1: [{ message_id: "msg_1", sender_role: "org_owner", body_text: "Hello team.", created_at_iso8601: "2026-08-20T10:00:00.000Z" }] }
  );
  await waitFor(() => screen.getByText("Hello team."));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText("Hello team."), null));
});

test("a message body containing markup is rendered as inert text, never as HTML", async () => {
  await openPanel(
    [{ thread_id: "thread_1", org_name: "Ironclad Barbell" }],
    {
      thread_1: [
        {
          message_id: "msg_1",
          sender_role: "org_owner",
          body_text: '<img src=x onerror="window.pwned=true">',
          created_at_iso8601: "2026-08-20T10:00:00.000Z"
        }
      ]
    }
  );

  await waitFor(() => screen.getByText(/img src=x/u));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img[src='x']").length, 0);
});

test("no send form is ever rendered - this panel is read-only", async () => {
  await openPanel(
    [{ thread_id: "thread_1", org_name: "Ironclad Barbell" }],
    { thread_1: [{ message_id: "msg_1", sender_role: "org_owner", body_text: "Hello team.", created_at_iso8601: "2026-08-20T10:00:00.000Z" }] }
  );
  await waitFor(() => screen.getByText("Hello team."));

  assert.equal(document.querySelectorAll("form").length, 0);
  assert.equal(document.querySelectorAll("button").length, 0);
});
