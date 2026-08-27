// DEV NOTE: Part D.4/O.6 athlete's own org-owner<->athlete team messaging -
// behavioral proof replacing the source-text regex checks
// full_ui_26_organisation_billing_surface.test.mjs used to run against the
// now-removed app.js refreshAthleteOrgMessages()/
// combinedAthleteOrgEntries()/renderAthleteOrgMessages()/
// confirmSendAthleteOrgMessage().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountOrgMessagesPanel } from "../screens/account/AccountOrgMessagesPanel";

const STORAGE_KEY = "kolosseum.product.app.v1";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function seedRole(role: string) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ role }));
}

function installMocks(options: {
  threads?: Record<string, unknown>[];
  contexts?: Record<string, unknown>[];
  threadMessages?: Record<string, Record<string, unknown>[]>;
  sendFails?: boolean;
}) {
  const { threads = [], contexts = [{ org_id: "org_1", org_name: "Iron Athletics", visibility_mode: "shared" }], threadMessages = {}, sendFails = false } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/messages/athlete/org-messages/threads") {
      return jsonResponse({ threads });
    }
    if (path === "/coach-workspace/org-context/mine") {
      return jsonResponse({ contexts });
    }
    const threadMatch = path.match(/\/messages\/athlete\/org-messages\/threads\/(.+)$/u);
    if (threadMatch) {
      return jsonResponse({ messages: threadMessages[threadMatch[1]] ?? [] });
    }
    if (path.startsWith("/messages/athlete/org-messages/organisations/")) {
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

test("renders nothing for a coach account", async () => {
  seedRole("coach");
  installMocks({});
  const { container } = render(<AccountOrgMessagesPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("renders nothing when there is no org context at all", async () => {
  seedRole("athlete");
  installMocks({ contexts: [] });
  const { container } = render(<AccountOrgMessagesPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("shows a shared-mode org before any message has ever been sent, with a working reply form", async () => {
  seedRole("athlete");
  installMocks({});
  render(<AccountOrgMessagesPanel />);

  await screen.findByText("Iron Athletics");
  assert.ok(screen.getByText("No messages yet."));
  assert.ok(screen.getByText("Reply to Iron Athletics"));
});

test("an individual-mode org shows no send form", async () => {
  seedRole("athlete");
  installMocks({ contexts: [{ org_id: "org_1", org_name: "Solo Gym", visibility_mode: "individual" }] });
  render(<AccountOrgMessagesPanel />);

  await screen.findByText("Solo Gym");
  assert.ok(screen.getByText("Your coach's independent gym - no team messaging."));
  assert.equal(screen.queryByRole("textbox"), null);
});

test("shows prior messages for a thread that already exists", async () => {
  seedRole("athlete");
  installMocks({
    threads: [{ thread_id: "thread_1", org_id: "org_1", org_name: "Iron Athletics" }],
    threadMessages: { thread_1: [{ message_id: "m1", sender_role: "org_owner", body_text: "Welcome to the team", created_at_iso8601: "2026-08-20T10:00:00.000Z" }] }
  });
  render(<AccountOrgMessagesPanel />);

  await screen.findByText("Welcome to the team");
});

test("sending a reply posts to the org route", async () => {
  seedRole("athlete");
  let sentBody: unknown = null;
  installMocks({});
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const path = String(input);
    if (path.startsWith("/messages/athlete/org-messages/organisations/")) {
      sentBody = JSON.parse(String(init?.body));
      return jsonResponse({ ok: true });
    }
    return originalFetch(input as never, init);
  }) as typeof fetch;

  render(<AccountOrgMessagesPanel />);
  await screen.findByText("Iron Athletics");

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Thanks for having me" } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  assert.equal((sentBody as { body_text?: string } | null)?.body_text, "Thanks for having me");
});

test("shows a factual error when sending fails", async () => {
  seedRole("athlete");
  installMocks({ sendFails: true });
  render(<AccountOrgMessagesPanel />);
  await screen.findByText("Iron Athletics");

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hi" } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  await screen.findByText("message_send_failed");
});

test("a live-pushed message for a brand new org thread creates a new entry", async () => {
  seedRole("athlete");
  installMocks({ contexts: [] });
  render(<AccountOrgMessagesPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:athlete-org-message-received", {
      detail: {
        thread: { thread_id: "thread_new", org_id: "org_2", org_name: "New Org" },
        message: { message_id: "m_live", sender_role: "org_owner", body_text: "Hello", created_at_iso8601: "2026-08-20T11:00:00.000Z" }
      }
    }));
  });

  await waitFor(() => assert.ok(screen.getAllByText("New Org").length > 0));
  assert.ok(screen.getByText("Hello"));
});

test("an org name containing markup renders as inert text, never as HTML", async () => {
  seedRole("athlete");
  installMocks({ contexts: [{ org_id: "org_1", org_name: '<img src=x onerror="window.pwned=true">', visibility_mode: "shared" }] });
  render(<AccountOrgMessagesPanel />);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(document.querySelector(".org-message-thread")?.textContent?.includes("<img"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".org-message-thread img").length, 0);
});
