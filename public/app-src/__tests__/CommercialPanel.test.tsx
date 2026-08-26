// DEV NOTE: FULL-UI-08 commercial/billing behavioral proof - replaces the
// source-text regex checks against the now-retired commercial_ui.js.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CommercialPanel } from "../screens/account/CommercialPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function baseCommercial(overrides: Record<string, unknown> = {}) {
  return {
    factual_state: "active_subscriber",
    subscription_state: "active",
    product_access_state: "access_active",
    billing_status: "payment_confirmed",
    plan_id: "coach_monthly",
    seat_limit: 10,
    occupied_seat_count: 3,
    available_seat_count: 7,
    checkout_available: false,
    checkout_redirect_available: false,
    portal_available: false,
    entitlement_error: null,
    ...overrides
  };
}

function installMocks(options: {
  commercial?: Record<string, unknown>;
  history?: Record<string, unknown>[];
  checkoutResponse?: Record<string, unknown>;
  portalResponse?: Record<string, unknown>;
  checkoutFails?: string | boolean;
}) {
  const {
    commercial = baseCommercial(),
    history = [],
    checkoutResponse = { checkout_url: null },
    portalResponse = { portal_url: null },
    checkoutFails = false
  } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/account/commercial" && method === "GET") {
      return jsonResponse({ commercial, history });
    }
    if (path === "/account/commercial/checkout") {
      if (checkoutFails) {
        const code = typeof checkoutFails === "string" ? checkoutFails : "commercial_request_failed";
        return jsonResponse({ error: code }, false, 409);
      }
      return jsonResponse(checkoutResponse, true, 201);
    }
    if (path === "/account/commercial/portal") {
      return jsonResponse(portalResponse, true, 201);
    }
    if (path === "/account/commercial/payment-return") {
      return jsonResponse({ ok: true }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

test("loads and displays factual subscription, access, billing and seat state", async () => {
  installMocks({});
  render(<CommercialPanel />);

  await waitFor(() => screen.getByText("Active Subscriber"));
  assert.ok(screen.getByText("coach_monthly"));
  assert.ok(screen.getByText("10"));
  assert.ok(screen.getByText("3"));
  assert.ok(screen.getByText("7"));
});

test("shows a factual empty state when there is no commercial record history", async () => {
  installMocks({ history: [] });
  render(<CommercialPanel />);

  await waitFor(() => screen.getByText("No commercial account records."));
});

test("renders each history record's humanised type, date and state", async () => {
  installMocks({
    history: [
      { record_type: "commercial_checkout_requested", billing_status: "provider_checkout_created", effective_at_iso8601: "2026-08-20T10:00:00.000Z" }
    ]
  });
  render(<CommercialPanel />);

  await waitFor(() => screen.getByText("Commercial Checkout Requested"));
  assert.ok(document.body.textContent?.includes("Provider Checkout Created"));
});

test("the checkout button is disabled and reads Prepare checkout until the server marks checkout as available", async () => {
  installMocks({ commercial: baseCommercial({ checkout_available: false }) });
  render(<CommercialPanel />);

  await waitFor(() => screen.getByText("Prepare checkout"));
  assert.equal((screen.getByText("Prepare checkout") as HTMLButtonElement).disabled, true);
});

test("the checkout button enables and reads Open checkout once a redirect is available", async () => {
  installMocks({ commercial: baseCommercial({ checkout_available: true, checkout_redirect_available: true }) });
  render(<CommercialPanel />);

  await waitFor(() => screen.getByText("Open checkout"));
  assert.equal((screen.getByText("Open checkout") as HTMLButtonElement).disabled, false);
});

test("the billing portal button is disabled until the server marks the portal as available", async () => {
  installMocks({ commercial: baseCommercial({ portal_available: false }) });
  render(<CommercialPanel />);

  await waitFor(() => screen.getByText("Open billing portal"));
  assert.equal((screen.getByText("Open billing portal") as HTMLButtonElement).disabled, true);
});

test("requesting the billing portal with no portal_url shows the provider-inert result message", async () => {
  installMocks({ commercial: baseCommercial({ portal_available: true }), portalResponse: { portal_url: null } });
  render(<CommercialPanel />);
  await waitFor(() => screen.getByText("Open billing portal"));

  await act(async () => {
    fireEvent.click(screen.getByText("Open billing portal"));
  });

  await waitFor(() => screen.getByText("Portal request recorded. No live provider call was performed."));
});

test("requesting checkout with no checkout_url shows the provider-inert result message", async () => {
  installMocks({ commercial: baseCommercial({ checkout_available: true }), checkoutResponse: { checkout_url: null } });
  render(<CommercialPanel />);
  await waitFor(() => screen.getByText("Prepare checkout"));

  await act(async () => {
    fireEvent.click(screen.getByText("Prepare checkout"));
  });

  await waitFor(() => screen.getByText("Checkout request recorded. No live provider call was performed."));
});

test("requesting checkout with a real checkout_url shows the redirect confirmation before navigating away", async () => {
  // jsdom's Location.assign cannot be stubbed (non-configurable), so this
  // confirms the pre-redirect state React controls; useCommercialAccount.ts's
  // source is checked directly (in the governing surface test) for the
  // actual window.location.assign(checkoutUrl) call.
  installMocks({ commercial: baseCommercial({ checkout_available: true }), checkoutResponse: { checkout_url: "https://provider.example/checkout/abc" } });
  render(<CommercialPanel />);
  await waitFor(() => screen.getByText("Prepare checkout"));

  fireEvent.click(screen.getByText("Prepare checkout"));

  await waitFor(() => screen.getByText("Checkout request recorded. Opening the configured provider page."));
});

test("shows a mapped error with the missing configuration list when checkout is rejected as unconfigured", async () => {
  installMocks({ commercial: baseCommercial({ checkout_available: true }) });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    if (path === "/account/commercial" && method === "GET") return jsonResponse({ commercial: baseCommercial({ checkout_available: true }), history: [] });
    if (path === "/account/commercial/checkout") {
      return jsonResponse({ error: "commercial_configuration_missing", details: { missing_configuration: ["STRIPE_SECRET_KEY"] } }, false, 409);
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;

  render(<CommercialPanel />);
  await waitFor(() => screen.getByText("Prepare checkout"));

  await act(async () => {
    fireEvent.click(screen.getByText("Prepare checkout"));
  });

  await waitFor(() => screen.getByText("Controlled-launch checkout is not configured on this server. Missing: STRIPE_SECRET_KEY."));
});

test("an entitlement error is shown as a factual notice, distinct from the general result message", async () => {
  installMocks({ commercial: baseCommercial({ entitlement_error: { code: "commercial_seat_limit_reached", message: "" } }) });
  render(<CommercialPanel />);

  await waitFor(() => screen.getByText("Commercial Seat Limit Reached"));
});

test("a payment return in the URL records the outcome, shows the confirmation-pending notice, and strips the query params", async () => {
  window.history.pushState(null, "", "/app/?checkout_return=success&provider_session_id=sess_123");
  installMocks({});

  render(<CommercialPanel />);

  await waitFor(() => screen.getByText("Checkout return recorded. Trusted provider confirmation is still required."));
  assert.equal(window.location.search, "");
});

test("a commercial record type containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    history: [
      { record_type: '<img src=x onerror="window.pwned=true">', billing_status: "recorded", effective_at_iso8601: "2026-08-20T10:00:00.000Z" }
    ]
  });
  render(<CommercialPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".commercial-history-record img").length, 0);
});
