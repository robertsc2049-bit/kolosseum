// DEV NOTE: FULL-UI-02 account header card / account-code card behavioral
// proof - replaces the source-text regex checks against the now-removed
// app.js renderAccount() badge/avatar/code rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

import { AccountCodeCard, AccountIdentityHeaderCard } from "../screens/account/AccountIdentityHeaderPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function baseAccount(overrides: Record<string, unknown> = {}) {
  return {
    user_id: "athlete_test123",
    display_name: "Jordan Test",
    email: "jordan@example.com",
    actor_type: "athlete",
    account_state: "active",
    email_verified: false,
    ...overrides
  };
}

function installMocks(account: Record<string, unknown> | null) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) {
      return account ? jsonResponse({ account, terms: {}, consent_history: [], csrf_token: "csrf" }) : jsonResponse({ error: "unavailable" }, false, 500);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows the account's name, email, role, state and verification badges", async () => {
  installMocks(baseAccount());
  render(<AccountIdentityHeaderCard />);
  await screen.findByText("Jordan Test");
  assert.ok(screen.getByText("jordan@example.com"));
  assert.ok(screen.getByText("Athlete"));
  assert.ok(screen.getByText("Active"));
  assert.ok(screen.getByText("Email not verified"));
});

test("shows a coach role and a verified email", async () => {
  installMocks(baseAccount({ actor_type: "coach", email_verified: true }));
  render(<AccountIdentityHeaderCard />);
  await screen.findByText("Jordan Test");
  assert.ok(screen.getByText("Coach"));
  assert.ok(screen.getByText("Email verified"));
});

test("shows a suspended account state with the correct badge class", async () => {
  installMocks(baseAccount({ account_state: "suspended" }));
  render(<AccountIdentityHeaderCard />);
  const badge = await screen.findByText("Suspended");
  assert.ok(badge.className.includes("warning"));
});

test("the account code card shows the account's user id and copies it", async () => {
  installMocks(baseAccount());
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText: async () => {} },
    configurable: true
  });

  render(<AccountCodeCard />);
  await screen.findByText("athlete_test123");

  await act(async () => {
    screen.getByText("Copy code").click();
  });

  await screen.findByText("Account code copied.");
});

test("refetches when kolosseum:account-identity-updated fires", async () => {
  installMocks(baseAccount({ display_name: "Original Name" }));
  render(<AccountIdentityHeaderCard />);
  await screen.findByText("Original Name");

  installMocks(baseAccount({ display_name: "Updated Name" }));
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:account-identity-updated"));
  });

  await screen.findByText("Updated Name");
});

test("refetches when kolosseum:account-detail-refreshed fires", async () => {
  installMocks(baseAccount({ display_name: "Original Name" }));
  render(<AccountIdentityHeaderCard />);
  await screen.findByText("Original Name");

  installMocks(baseAccount({ display_name: "Refreshed Name" }));
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:account-detail-refreshed"));
  });

  await screen.findByText("Refreshed Name");
});

// One login, both roles (AccountRoleSwitch).
test("a coach with one role is offered an athlete side; adding it posts the role and reopens the app at the athlete home", async () => {
  const posts: Array<{ path: string; body: unknown }> = [];
  let reloadedAt = "";
  const originalReplace = window.history.replaceState.bind(window.history);
  window.history.replaceState = ((_data: unknown, _unused: string, url?: string | URL | null) => { reloadedAt = String(url ?? ""); }) as typeof window.history.replaceState;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: baseAccount({ actor_type: "coach", roles: ["coach"] }), terms: {}, consent_history: [], csrf_token: "csrf" });
    if (path === "/account/roles") {
      posts.push({ path, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
      return jsonResponse({ account: baseAccount({ actor_type: "athlete", roles: ["coach", "athlete"], actor_home_route: "#/athlete/today" }), csrf_token: "csrf" }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
  try {
    render(<AccountIdentityHeaderCard />);
    const add = await screen.findByText("Also train as an athlete");
    await act(async () => { add.click(); });
    assert.deepEqual(posts, [{ path: "/account/roles", body: { role: "athlete" } }]);
    assert.equal(reloadedAt, "/app/#/athlete/today");
  }
  finally {
    window.history.replaceState = originalReplace;
  }
});

test("an account with both roles shows which it's in and switches to the other", async () => {
  installMocks(baseAccount({ actor_type: "athlete", roles: ["coach", "athlete"] }));
  render(<AccountIdentityHeaderCard />);
  assert.ok(await screen.findByText("Switch to coaching"));
  assert.ok(screen.getByText("Coach and athlete · now athlete"));
  assert.equal(screen.queryByText("Also coach athletes"), null);
});
