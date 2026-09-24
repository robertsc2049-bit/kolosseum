// DEV NOTE: Part O.9 coach's own org-owner<->coach team messaging -
// behavioral proof mirroring AccountOrgMessagesPanel.test.tsx (the
// athlete-side org_owner<->athlete original) as closely as the underlying
// data allows.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountOrgContextPanel } from "../screens/account/AccountOrgContextPanel";
import { CoachOrgMessagesPanel } from "../screens/account/CoachOrgMessagesPanel";

const STORAGE_KEY = "kolosseum.product.app.v1";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function seedRole(role: string) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ role }));
}

function installMocks(options: {
  threads?: Record<string, unknown>[];
  memberships?: Record<string, unknown>[];
  threadMessages?: Record<string, Record<string, unknown>[]>;
  sendFails?: boolean;
}) {
  const {
    threads = [],
    memberships = [{ org_id: "org_1", org_name: "Iron Athletics", visibility_mode: "shared", membership_status: "active" }],
    threadMessages = {},
    sendFails = false
  } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/coach-workspace/org-messages/threads") {
      return jsonResponse({ threads });
    }
    if (path === "/coach-workspace/org-memberships") {
      return jsonResponse({ memberships });
    }
    const threadMatch = path.match(/\/coach-workspace\/org-messages\/threads\/(.+)$/u);
    if (threadMatch) {
      return jsonResponse({ messages: threadMessages[threadMatch[1]] ?? [] });
    }
    if (path.startsWith("/coach-workspace/org-messages/organisations/")) {
      if (sendFails) return jsonResponse({ error: "message_send_failed" }, false, 400);
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("renders nothing for an athlete account", async () => {
  seedRole("athlete");
  installMocks({});
  const { container } = render(<CoachOrgMessagesPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("renders nothing when there is no org membership at all", async () => {
  seedRole("coach");
  installMocks({ memberships: [] });
  const { container } = render(<CoachOrgMessagesPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("shows a shared-mode active-membership org before any message has ever been sent, with a working reply form", async () => {
  seedRole("coach");
  installMocks({});
  render(<CoachOrgMessagesPanel />);

  await screen.findByText("Iron Athletics");
  assert.ok(screen.getByText("No messages yet."));
  assert.ok(screen.getByText("Reply to Iron Athletics"));
});

test("an individual-mode (gym) org shows no send form", async () => {
  seedRole("coach");
  installMocks({ memberships: [{ org_id: "org_1", org_name: "Solo Gym", visibility_mode: "individual", membership_status: "active" }] });
  render(<CoachOrgMessagesPanel />);

  await screen.findByText("Solo Gym");
  assert.ok(screen.getByText("Independent gym - no organisation messaging."));
  assert.equal(screen.queryByRole("textbox"), null);
});

test("an invited (not yet accepted) membership shows no send form, with copy distinct from 'no longer active' (never joined vs. left)", async () => {
  seedRole("coach");
  installMocks({ memberships: [{ org_id: "org_1", org_name: "Pending Gym", visibility_mode: "shared", membership_status: "invited" }] });
  render(<CoachOrgMessagesPanel />);

  await screen.findByText("Pending Gym");
  assert.ok(screen.getByText("Accept this organisation's invitation from your Account page to message them."));
  assert.equal(screen.queryByText("You're no longer an active member of this organisation."), null);
  assert.equal(screen.queryByRole("textbox"), null);
});

test("a removed membership (was active, no longer is) still shows the 'no longer an active member' copy", async () => {
  seedRole("coach");
  installMocks({ memberships: [{ org_id: "org_1", org_name: "Old Gym", visibility_mode: "shared", membership_status: "removed" }] });
  render(<CoachOrgMessagesPanel />);

  await screen.findByText("Old Gym");
  assert.ok(screen.getByText("You're no longer an active member of this organisation."));
  assert.equal(screen.queryByRole("textbox"), null);
});

test("shows prior messages for a thread that already exists", async () => {
  seedRole("coach");
  installMocks({
    threads: [{ thread_id: "thread_1", org_id: "org_1" }],
    threadMessages: { thread_1: [{ message_id: "m1", sender_role: "org_owner", body_text: "Welcome coach", created_at_iso8601: "2026-08-20T10:00:00.000Z" }] }
  });
  render(<CoachOrgMessagesPanel />);

  await screen.findByText("Welcome coach");
});

test("sending a reply posts to the coach org-messages route", async () => {
  seedRole("coach");
  let sentBody: unknown = null;
  installMocks({});
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const path = String(input);
    if (path.startsWith("/coach-workspace/org-messages/organisations/")) {
      sentBody = JSON.parse(String(init?.body));
      return jsonResponse({ ok: true });
    }
    return originalFetch(input as never, init);
  }) as typeof fetch;

  render(<CoachOrgMessagesPanel />);
  await screen.findByText("Iron Athletics");

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Thanks, will do" } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  assert.equal((sentBody as { body_text?: string } | null)?.body_text, "Thanks, will do");
});

test("shows a factual error when sending fails", async () => {
  seedRole("coach");
  installMocks({ sendFails: true });
  render(<CoachOrgMessagesPanel />);
  await screen.findByText("Iron Athletics");

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hi" } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  await screen.findByText("That request could not be completed. Try again, or report this problem if it continues.");
});

test("a live-pushed message for a brand new org thread creates a new entry", async () => {
  seedRole("coach");
  installMocks({ memberships: [] });
  render(<CoachOrgMessagesPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-org-message-received", {
      detail: {
        thread: { thread_id: "thread_new", org_id: "org_2" },
        message: { message_id: "m_live", sender_role: "org_owner", body_text: "Hello coach", created_at_iso8601: "2026-08-20T11:00:00.000Z" }
      }
    }));
  });

  await waitFor(() => assert.ok(screen.getByText("Hello coach")));
});

test("an org name containing markup renders as inert text, never as HTML", async () => {
  seedRole("coach");
  installMocks({ memberships: [{ org_id: "org_1", org_name: '<img src=x onerror="window.pwned=true">', visibility_mode: "shared", membership_status: "active" }] });
  render(<CoachOrgMessagesPanel />);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(document.querySelector(".org-message-thread")?.textContent?.includes("<img"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".org-message-thread img").length, 0);
});

// DEV NOTE: reproduces a real bug found live - accepting an org invitation
// (AccountOrgContextPanel/useAccountOrgContext.ts) correctly refreshed its
// own membership list, but the sibling CoachOrgMessagesPanel - an
// independently-mounted panel with its own copy of the same
// membership_status, per main.tsx's "several panels always mounted"
// architecture - kept showing stale "not yet accepted" copy until the next
// sign-in/page load, since nothing told it the membership had changed.
test("accepting an invitation in AccountOrgContextPanel is reflected immediately in the sibling CoachOrgMessagesPanel, with no reload needed", async () => {
  seedRole("coach");
  let membershipStatus = "invited";
  const calls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push(path);
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/coach-workspace/org-memberships") {
      return jsonResponse({ memberships: [{ membership_id: "mem_1", org_id: "org_1", org_name: "Iron Athletics", visibility_mode: "shared", membership_status: membershipStatus }] });
    }
    if (path === "/coach-workspace/org-messages/threads") {
      return jsonResponse({ threads: [] });
    }
    if (path.includes("/roster")) {
      return jsonResponse({ roster: [] });
    }
    if (path.includes("/org-memberships/") && path.endsWith("/accept")) {
      membershipStatus = "active";
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;

  render(
    <>
      <AccountOrgContextPanel />
      <CoachOrgMessagesPanel />
    </>
  );

  await screen.findByText("Accept invitation");
  await screen.findByText("Accept this organisation's invitation from your Account page to message them.");

  await act(async () => {
    fireEvent.click(screen.getByText("Accept invitation"));
  });

  await screen.findByText("Leave organisation");

  await waitFor(() => assert.ok(screen.getByText("Reply to Iron Athletics")), { timeout: 2000 });
  assert.equal(screen.queryByText("Accept this organisation's invitation from your Account page to message them."), null);
});
