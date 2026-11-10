// Other people's actions reaching an open app (utils/liveUpdates.ts): the
// always-mounted bell re-checks its unread count when the tab comes back
// (and every minute while visible). A rise fires
// kolosseum:notifications-arrived, and the panels that show other people's
// actions refetch - here, a coach's coaching requests arriving while the
// Athletes screen was already open (walkthrough 10).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { NotificationBellPanel } from "../screens/account/NotificationBellPanel";
import { CoachingRequestsPanel } from "../screens/coach/CoachingRequestsPanel";
import { NOTIFICATIONS_ARRIVED_EVENT } from "../utils/liveUpdates";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

const request = { request_id: "creq_1", athlete_display_name: "Alex Rowe", athlete_email: "alex@example.com", source: "share_link", note: "Flanker, club rugby.", requested_at: "2026-11-10T12:12:00.000Z" };

function installMocks() {
  const server = { unread: 0, requests: [] as Record<string, unknown>[], signedIn: true, unreadCalls: 0, dropNext: false };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/account/notifications/unread-count") {
      server.unreadCalls += 1;
      if (server.dropNext) {
        server.dropNext = false;
        throw new TypeError("Failed to fetch");
      }
      return server.signedIn ? jsonResponse({ unread_count: server.unread }) : jsonResponse({ error: "account_session_missing" }, 401);
    }
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1", actor_type: "coach" }, csrf_token: "csrf" });
    if (path === "/coach-workspace/coaching-requests") return jsonResponse({ ok: true, requests: server.requests });
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return server;
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

async function tabComesBack() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  await settle();
}

test.afterEach(() => cleanup());

test("a coaching request made while the coach's app is open shows up when the tab comes back", async () => {
  const server = installMocks();
  let arrived = 0;
  const onArrived = () => { arrived += 1; };
  document.addEventListener(NOTIFICATIONS_ARRIVED_EVENT, onArrived);
  try {
    render(<><NotificationBellPanel /><CoachingRequestsPanel /></>);
    await settle();
    assert.equal(screen.queryByText("Alex Rowe"), null, "no requests yet");

    // Nothing new: no refetch storm.
    await tabComesBack();
    assert.equal(arrived, 0);

    // The athlete asks while the coach has the app open.
    server.unread = 1;
    server.requests = [request];
    await tabComesBack();
    assert.equal(arrived, 1, "the rise is announced once");
    await screen.findByText("Alex Rowe");
    assert.ok(screen.getByText("They found you through your share link or at a gym where you coach. Invite them to add them to your roster."));
  }
  finally {
    document.removeEventListener(NOTIFICATIONS_ARRIVED_EVENT, onArrived);
  }
});

test("signed out, the bell stops re-checking until the next sign-in", async () => {
  const server = installMocks();
  server.signedIn = false;
  render(<NotificationBellPanel />);
  await settle();
  const callsAfterMount = server.unreadCalls;
  await tabComesBack();
  await tabComesBack();
  assert.equal(server.unreadCalls, callsAfterMount, "no repeated 401s while signed out");

  server.signedIn = true;
  server.unread = 2;
  await act(async () => { document.dispatchEvent(new CustomEvent("kolosseum:entry-auth-succeeded")); });
  await settle();
  assert.equal(server.unreadCalls, callsAfterMount + 1, "signing in checks again");
});

test("a dropped connection doesn't switch live updates off", async () => {
  const server = installMocks();
  let arrived = 0;
  const onArrived = () => { arrived += 1; };
  document.addEventListener(NOTIFICATIONS_ARRIVED_EVENT, onArrived);
  try {
    render(<NotificationBellPanel />);
    await settle();
    server.dropNext = true;
    await tabComesBack();
    server.unread = 1;
    await tabComesBack();
    assert.equal(arrived, 1, "the next check after the blip still works");
  }
  finally {
    document.removeEventListener(NOTIFICATIONS_ARRIVED_EVENT, onArrived);
  }
});
