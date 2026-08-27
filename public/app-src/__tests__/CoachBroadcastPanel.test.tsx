// DEV NOTE: behavioral proof replacing the source-text regex checks that
// used to run against app.js's (removed) confirmSendCoachBroadcast()/
// broadcastAthleteName()/refreshBroadcastReadStatus()/
// renderBroadcastReadStatus().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachBroadcastPanel } from "../screens/coach/CoachBroadcastPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: {
  sentCount?: number;
  readStatus?: { sent_count: number; read_count: number; athletes: Array<{ athlete_user_id: string; read: boolean }> };
} = {}) {
  const { sentCount = 2, readStatus } = options;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/messages/coach/broadcast") {
      return jsonResponse({ ok: true, broadcast_id: "broadcast_1", sent_count: sentCount }, true, 201);
    }
    if (path === "/messages/coach/broadcasts/broadcast_1/read-status") {
      return jsonResponse(readStatus ?? {
        sent_count: sentCount,
        read_count: 1,
        athletes: [
          { athlete_user_id: "athlete_1", read: true },
          { athlete_user_id: "athlete_2", read: false }
        ]
      });
    }
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({
        relationships: [
          { athlete_user_id: "athlete_1", display_name: "Jordan Athlete" },
          { athlete_user_id: "athlete_2", display_name: "Sam Athlete" }
        ]
      });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("sending a broadcast shows the sent summary and resolved read-status list", async () => {
  installMocks();
  render(<CoachBroadcastPanel />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great work this week." } });

  await act(async () => {
    fireEvent.click(screen.getByText("Send to all athletes"));
  });

  await screen.findByText("Sent to 2 athletes.");
  await screen.findByText("Read by 1 of 2 athletes.");
  assert.ok(screen.getByText("Jordan Athlete"));
  assert.ok(screen.getByText("Sam Athlete"));
});

test("a broadcast with no accepted athletes shows the empty-send message and no read-status panel", async () => {
  installMocks({ sentCount: 0 });
  render(<CoachBroadcastPanel />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Send to all athletes"));
  });

  await screen.findByText("No accepted athletes to send to yet.");
  assert.equal(screen.queryByText(/Read by/u), null);
});

test("the Refresh button re-fetches the read status", async () => {
  installMocks();
  render(<CoachBroadcastPanel />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great work this week." } });
  await act(async () => {
    fireEvent.click(screen.getByText("Send to all athletes"));
  });
  await screen.findByText("Read by 1 of 2 athletes.");

  installMocks({ readStatus: { sent_count: 2, read_count: 2, athletes: [
    { athlete_user_id: "athlete_1", read: true },
    { athlete_user_id: "athlete_2", read: true }
  ] } });

  await act(async () => {
    fireEvent.click(screen.getByText("Refresh"));
  });

  await screen.findByText("Read by 2 of 2 athletes.");
});
