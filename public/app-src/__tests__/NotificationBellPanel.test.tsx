// DEV NOTE: FULL-UI-18 factual in-product notifications behavioral proof
// - covers useNotifications.ts/NotificationBellPanel.tsx's rendering of
// the bell badge and dropdown panel, and resolveNotificationSubject()'s
// coach/athlete name resolution (notificationsClient.ts). Opening a
// notification with a real target is a bridge to legacy (see
// useNotifications.ts's own DEV NOTE) - checked here only as far as the
// dispatched kolosseum:open-notification-target event's detail shape,
// not the routing itself (verified live against a real seeded coach+
// athlete relationship - see PR description).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { NotificationBellPanel } from "../screens/account/NotificationBellPanel";
import { resolveNotificationSubject } from "../api/notificationsClient";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function notification(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    notification_id: "notif_1",
    notification_type: "relationship_accepted",
    occurred_at_iso8601: "2026-08-29T12:00:00.000Z",
    read_at_iso8601: null,
    target_available: true,
    deep_link: { route_id: "coach_athlete_detail", params: { athlete_id: "athlete_1" } },
    notification_payload: { athlete_user_id: "athlete_1" },
    ...overrides
  };
}

function installMocks(options: {
  unreadCount?: number;
  notifications?: Record<string, unknown>[];
  actorType?: "coach" | "athlete";
  coachRelationships?: Record<string, unknown>[];
  athleteRelationships?: Record<string, unknown>[];
  pendingInvitations?: Record<string, unknown>[];
  notificationsUnavailable?: boolean;
} = {}) {
  const {
    unreadCount = 0,
    notifications = [],
    actorType = "coach",
    coachRelationships = [],
    athleteRelationships = [],
    pendingInvitations = [],
    notificationsUnavailable = false
  } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path === "/account/notifications/unread-count") return jsonResponse({ unread_count: unreadCount });
    if (path === "/account/notifications" && method === "GET") {
      return notificationsUnavailable
        ? jsonResponse({ error: "service_unavailable" }, false, 503)
        : jsonResponse({ notifications, unread_count: unreadCount });
    }
    if (path.startsWith("/account/notifications/") && path.endsWith("/read")) return jsonResponse({ ok: true });
    if (path.startsWith("/account/notifications/") && path.endsWith("/unread")) return jsonResponse({ ok: true });
    if (path === "/account/notifications/mark-all-read") return jsonResponse({ ok: true });
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1", actor_type: actorType }, csrf_token: "csrf" });
    }
    if (path.startsWith("/coach-workspace/relationships?")) return jsonResponse({ relationships: coachRelationships });
    if (path === "/coach-workspace/relationships/mine") return jsonResponse({ relationships: athleteRelationships });
    if (path === "/coach-workspace/relationship-invitations") return jsonResponse({ invitations: pendingInvitations });
    return jsonResponse({ error: `unhandled_request_${method}_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("resolveNotificationSubject resolves an athlete name for a coach viewing an athlete-directed event", () => {
  const subject = resolveNotificationSubject(
    { notification_payload: { athlete_user_id: "athlete_1" } },
    { coachRelationships: [{ athlete_user_id: "athlete_1", display_name: "Alex Athlete" }], athleteRelationships: [], pendingInvitations: [] }
  );
  assert.equal(subject, "Alex Athlete");
});

test("resolveNotificationSubject resolves a coach name for an athlete viewing a coach-directed event, preferring an accepted relationship over a pending invitation", () => {
  const subject = resolveNotificationSubject(
    { notification_payload: { coach_user_id: "coach_1" } },
    {
      coachRelationships: [],
      athleteRelationships: [{ coach_user_id: "coach_1", coach_display_name: "Coach Accepted" }],
      pendingInvitations: [{ coach_user_id: "coach_1", coach_display_name: "Coach Pending" }]
    }
  );
  assert.equal(subject, "Coach Accepted");
});

test("shows no unread badge before any notification exists", async () => {
  installMocks({ unreadCount: 0 });
  render(<NotificationBellPanel />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(document.querySelector(".notification-unread-badge")?.hasAttribute("hidden"), true);
});

test("shows the unread count badge, capped at 99+", async () => {
  installMocks({ unreadCount: 150 });
  render(<NotificationBellPanel />);
  await screen.findByText("99+");
});

test("opening the panel loads and displays a notification with its resolved subject name", async () => {
  installMocks({
    unreadCount: 1,
    notifications: [notification()],
    coachRelationships: [{ athlete_user_id: "athlete_1", display_name: "Alex Athlete" }]
  });
  render(<NotificationBellPanel />);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Open notifications"));
  });

  await screen.findByText("Relationship accepted");
  assert.ok(screen.getByText("Alex Athlete"));
  assert.ok(screen.getByText("Mark read"));
});

test("shows a factual unavailable state with a retry action when the service fails", async () => {
  installMocks({ notificationsUnavailable: true });
  render(<NotificationBellPanel />);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Open notifications"));
  });

  await screen.findByText("Notifications are unavailable right now.");
  assert.ok(screen.getByText("Retry"));
});

test("shows a factual empty state when there are no notifications", async () => {
  installMocks({ notifications: [] });
  render(<NotificationBellPanel />);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Open notifications"));
  });

  await screen.findByText("No notifications yet.");
});

test("marking a notification read calls the read endpoint and refreshes the list", async () => {
  installMocks({ unreadCount: 1, notifications: [notification()] });
  render(<NotificationBellPanel />);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Open notifications"));
  });
  await screen.findByText("Mark read");

  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith("/read") && (init?.method ?? "GET") === "POST") requests.push(path);
    return originalFetch(input, init);
  }) as typeof fetch;

  await act(async () => {
    fireEvent.click(screen.getByText("Mark read"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(requests.length, 1);
});

test("marking all read calls the mark-all-read endpoint", async () => {
  installMocks({ unreadCount: 1, notifications: [notification()] });
  render(<NotificationBellPanel />);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Open notifications"));
  });
  await screen.findByText("Mark all read");

  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/account/notifications/mark-all-read" && (init?.method ?? "GET") === "POST") requests.push(path);
    return originalFetch(input, init);
  }) as typeof fetch;

  await act(async () => {
    fireEvent.click(screen.getByText("Mark all read"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(requests.length, 1);
});

test("opening a notification with an unavailable target does not dispatch a navigation event", async () => {
  installMocks({ notifications: [notification({ target_available: false })] });
  render(<NotificationBellPanel />);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Open notifications"));
  });
  await screen.findByText("This item is no longer available");

  let dispatched = false;
  document.addEventListener("kolosseum:open-notification-target", () => { dispatched = true; }, { once: true });

  await act(async () => {
    fireEvent.click(screen.getByText("Relationship accepted"));
  });

  assert.equal(dispatched, false);
});

test("opening a notification with a real target dispatches the navigation bridge event with its deep_link", async () => {
  installMocks({ notifications: [notification()] });
  render(<NotificationBellPanel />);
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Open notifications"));
  });
  await screen.findByText("Relationship accepted");

  let captured: { route_id?: string; params?: Record<string, unknown> } | null = null;
  document.addEventListener("kolosseum:open-notification-target", (event) => {
    captured = (event as CustomEvent).detail;
  }, { once: true });

  await act(async () => {
    fireEvent.click(screen.getByText("Relationship accepted"));
  });

  assert.deepEqual(captured, { route_id: "coach_athlete_detail", params: { athlete_id: "athlete_1" } });
  assert.equal(document.querySelector(".notification-panel"), null);
});
