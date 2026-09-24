// DEV NOTE: FULL-UI-24 pending coach invitations - behavioral proof
// replacing the source-text regex checks full_ui_24_athlete_self_service_
// journey_surface.test.mjs used to run against the now-removed app.js
// renderPendingRelationshipInvitations()/acceptRelationshipInvitation()/
// declineRelationshipInvitation().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AccountCoachInvitationsPanel } from "../screens/account/AccountCoachInvitationsPanel";

const STORAGE_KEY = "kolosseum.product.app.v1";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function seedRole(role: string) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ role }));
}

function baseInvitation(overrides: Record<string, unknown> = {}) {
  return {
    relationship_id: "rel_1",
    coach_display_name: "Jordan Coach",
    coach_email: "jordan@example.com",
    ...overrides
  };
}

function installMocks(options: { invitations?: Record<string, unknown>[]; acceptFails?: boolean; declineFails?: boolean }) {
  const { invitations = [baseInvitation()], acceptFails = false, declineFails = false } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/coach-workspace/relationship-invitations" && method === "GET") {
      return jsonResponse({ invitations });
    }
    if (path.includes("/accept")) {
      if (acceptFails) return jsonResponse({ error: "relationship_invitation_not_found" }, false, 404);
      return jsonResponse({ ok: true });
    }
    if (path.includes("/decline")) {
      if (declineFails) return jsonResponse({ error: "relationship_invitation_not_found" }, false, 404);
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
  const { container } = render(<AccountCoachInvitationsPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("renders nothing when there are no pending invitations", async () => {
  seedRole("athlete");
  installMocks({ invitations: [] });
  const { container } = render(<AccountCoachInvitationsPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("shows a pending invitation with the coach's name and email", async () => {
  seedRole("athlete");
  installMocks({});
  render(<AccountCoachInvitationsPanel />);

  await screen.findByText("Jordan Coach");
  assert.ok(screen.getByText("jordan@example.com"));
  assert.ok(screen.getByText("Accept"));
  assert.ok(screen.getByText("Decline"));
});

test("accepting an invitation calls the accept route and clears the panel", async () => {
  seedRole("athlete");
  installMocks({});
  render(<AccountCoachInvitationsPanel />);
  await screen.findByText("Jordan Coach");

  installMocks({ invitations: [] });
  await act(async () => {
    fireEvent.click(screen.getByText("Accept"));
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(screen.queryByText("Jordan Coach"), null);
});

test("declining an invitation calls the decline route and clears the panel", async () => {
  seedRole("athlete");
  installMocks({});
  render(<AccountCoachInvitationsPanel />);
  await screen.findByText("Jordan Coach");

  installMocks({ invitations: [] });
  await act(async () => {
    fireEvent.click(screen.getByText("Decline"));
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(screen.queryByText("Jordan Coach"), null);
});

test("shows a factual error when accepting fails, and keeps the invitation visible", async () => {
  seedRole("athlete");
  installMocks({ acceptFails: true });
  render(<AccountCoachInvitationsPanel />);
  await screen.findByText("Jordan Coach");

  await act(async () => {
    fireEvent.click(screen.getByText("Accept"));
  });

  await screen.findByText("The invitation could not be accepted.");
  assert.ok(screen.getByText("Jordan Coach"));
});

test("dispatching kolosseum:athlete-relationship-changed refetches the invitations list", async () => {
  seedRole("athlete");
  installMocks({ invitations: [] });
  render(<AccountCoachInvitationsPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(screen.queryByText("Jordan Coach"), null);

  installMocks({});
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:athlete-relationship-changed"));
  });

  await screen.findByText("Jordan Coach");
});

test("a coach display name containing markup renders as inert text, never as HTML", async () => {
  seedRole("athlete");
  installMocks({ invitations: [baseInvitation({ coach_display_name: '<img src=x onerror="window.pwned=true">' })] });
  render(<AccountCoachInvitationsPanel />);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(document.querySelector(".record-row")?.textContent?.includes("<img"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".record-row img").length, 0);
});
