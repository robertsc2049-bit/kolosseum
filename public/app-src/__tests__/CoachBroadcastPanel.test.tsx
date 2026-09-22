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
  onBroadcastRequest?: (body: Record<string, unknown>) => void;
  broadcastDelayMs?: number;
} = {}) {
  const { sentCount = 2, readStatus, onBroadcastRequest, broadcastDelayMs = 0 } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/messages/coach/broadcast") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      onBroadcastRequest?.(body);
      if (broadcastDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, broadcastDelayMs));
      return jsonResponse({ ok: true, broadcast_id: String(body.client_request_id ?? "broadcast_1"), sent_count: sentCount }, true, 201);
    }
    if (path.startsWith("/messages/coach/broadcasts/") && path.endsWith("/read-status")) {
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

// Regression test: two genuinely-parallel POSTs to /messages/coach/broadcast
// (a fast double-click before the button's disabled={submitting} takes
// effect, or a network-level retry) used to each generate their own random
// broadcast_id server-side, so every connected athlete received the SAME
// message TWICE - live-reproduced and confirmed fixed against a real
// server. useCoachBroadcast.ts now generates client_request_id once per
// compose session (not inside send() itself), so both overlapping calls
// send the identical id and the server's per-thread idempotency collapses
// them into a single delivery.
test("a fast double-click sends the same client_request_id for both requests, not two different ones", async () => {
  const bodies: Record<string, unknown>[] = [];
  installMocks({ onBroadcastRequest: (body) => bodies.push(body), broadcastDelayMs: 20 });
  render(<CoachBroadcastPanel />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great work this week." } });

  await act(async () => {
    fireEvent.click(screen.getByText("Send to all athletes"));
    fireEvent.click(screen.getByText("Send to all athletes"));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  assert.equal(bodies.length, 2);
  assert.ok(bodies[0].client_request_id);
  assert.equal(bodies[0].client_request_id, bodies[1].client_request_id);
});

test("sending a second, separate broadcast after a successful one uses a fresh client_request_id", async () => {
  const bodies: Record<string, unknown>[] = [];
  installMocks({ onBroadcastRequest: (body) => bodies.push(body) });
  render(<CoachBroadcastPanel />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "First message." } });
  await act(async () => {
    fireEvent.click(screen.getByText("Send to all athletes"));
  });
  await screen.findByText("Sent to 2 athletes.");

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Second, unrelated message." } });
  await act(async () => {
    fireEvent.click(screen.getByText("Send to all athletes"));
  });
  await screen.findByText("Sent to 2 athletes.");

  assert.equal(bodies.length, 2);
  assert.ok(bodies[0].client_request_id);
  assert.ok(bodies[1].client_request_id);
  assert.notEqual(bodies[0].client_request_id, bodies[1].client_request_id);
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
