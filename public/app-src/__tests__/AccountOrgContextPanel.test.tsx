// DEV NOTE: Part O.7 coach-side org/team membership context - behavioral
// proof replacing the source-text regex checks
// full_ui_26_organisation_billing_surface.test.mjs used to run against the
// now-removed app.js refreshCoachOrgContext()/renderCoachOrgContext()/
// resolveOrgMembershipAction().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountOrgContextPanel } from "../screens/account/AccountOrgContextPanel";

const STORAGE_KEY = "kolosseum.product.app.v1";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function seedRole(role: string) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ role }));
}

function baseMembership(overrides: Record<string, unknown> = {}) {
  return {
    membership_id: "mem_1",
    org_id: "org_1",
    org_name: "Iron Athletics",
    visibility_mode: "shared",
    membership_status: "active",
    activated_at_iso8601: "2026-08-01T10:00:00.000Z",
    ...overrides
  };
}

function installMocks(options: {
  memberships?: Record<string, unknown>[];
  roster?: Record<string, unknown>[];
  actionFails?: boolean;
}) {
  const { memberships = [baseMembership()], roster = [], actionFails = false } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/coach-workspace/org-memberships") {
      return jsonResponse({ memberships });
    }
    if (path.includes("/roster")) {
      return jsonResponse({ roster });
    }
    if (path.includes("/org-memberships/") && (path.endsWith("/accept") || path.endsWith("/leave"))) {
      if (actionFails) return jsonResponse({ error: "membership_not_found" }, false, 404);
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
  const { container } = render(<AccountOrgContextPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("renders nothing when the coach has no organisations", async () => {
  seedRole("coach");
  installMocks({ memberships: [] });
  const { container } = render(<AccountOrgContextPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("shows an active shared-mode organisation with its fellow-coach roster", async () => {
  seedRole("coach");
  installMocks({ roster: [{ coach_user_id: "coach_2", coach_display_name: "Sam Coach", coach_email: "sam@example.com", activated_at_iso8601: "2026-08-05T10:00:00.000Z" }] });
  render(<AccountOrgContextPanel />);

  await screen.findByText("Iron Athletics");
  assert.ok(screen.getByText("Team"));
  assert.ok(screen.getByText(/Sam Coach/u));
});

test("an invited membership shows Accept invitation, not Leave organisation", async () => {
  seedRole("coach");
  installMocks({ memberships: [baseMembership({ membership_status: "invited", activated_at_iso8601: null, invited_at_iso8601: "2026-08-01T10:00:00.000Z" })] });
  render(<AccountOrgContextPanel />);

  await screen.findByText("Accept invitation");
  assert.equal(screen.queryByText("Leave organisation"), null);
});

test("never fetches the roster for a merely-invited membership", async () => {
  seedRole("coach");
  let rosterCalled = false;
  installMocks({ memberships: [baseMembership({ membership_status: "invited" })] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    if (String(input).includes("/roster")) rosterCalled = true;
    return originalFetch(input as never, init);
  }) as typeof fetch;

  render(<AccountOrgContextPanel />);
  await screen.findByText("Accept invitation");

  assert.equal(rosterCalled, false);
});

test("accepting an invitation calls the accept route and refreshes", async () => {
  seedRole("coach");
  installMocks({ memberships: [baseMembership({ membership_status: "invited" })] });
  render(<AccountOrgContextPanel />);
  await screen.findByText("Accept invitation");

  installMocks({});
  await act(async () => {
    fireEvent.click(screen.getByText("Accept invitation"));
  });

  await screen.findByText("Leave organisation");
});

test("leaving an organisation calls the leave route and refreshes", async () => {
  seedRole("coach");
  installMocks({});
  render(<AccountOrgContextPanel />);
  await screen.findByText("Leave organisation");

  installMocks({ memberships: [] });
  await act(async () => {
    fireEvent.click(screen.getByText("Leave organisation"));
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(screen.queryByText("Iron Athletics"), null);
});

test("shows a factual error when the accept/leave action fails", async () => {
  seedRole("coach");
  installMocks({ actionFails: true });
  render(<AccountOrgContextPanel />);
  await screen.findByText("Leave organisation");

  await act(async () => {
    fireEvent.click(screen.getByText("Leave organisation"));
  });

  await screen.findByText("Could not leave the organisation.");
});

test("an individual-mode (gym) membership shows no roster section", async () => {
  seedRole("coach");
  installMocks({ memberships: [baseMembership({ visibility_mode: "individual" })] });
  render(<AccountOrgContextPanel />);

  await screen.findByText("Gym");
  assert.equal(document.querySelector(".coach-org-context-entry .record-list"), null);
});

test("an organisation name and fellow-coach display name containing markup render as inert text, never as HTML", async () => {
  seedRole("coach");
  installMocks({
    memberships: [baseMembership({ org_name: '<img src=x onerror="window.pwned=true">' })],
    roster: [{ coach_user_id: "coach_2", coach_display_name: '<script>window.pwned=true</script>' }]
  });
  render(<AccountOrgContextPanel />);

  await waitFor(() => assert.ok(document.querySelector(".coach-org-context-entry")));
  assert.ok(document.querySelector(".coach-org-context-entry")?.textContent?.includes("<img"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".coach-org-context-entry img, .coach-org-context-entry script").length, 0);
});
