// DEV NOTE: FULL-UI-25 the athlete's own current/past coach relationships
// plus the embedded coach-messaging widget - behavioral proof replacing
// the source-text regex checks full_ui_25_relationship_lifecycle_surface.
// test.mjs used to run against the now-removed app.js
// renderAthleteRelationships()/renderAthleteOwnMessages()/
// confirmSendAthleteOwnMessage().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AccountCoachRelationshipPanel } from "../screens/account/AccountCoachRelationshipPanel";

const STORAGE_KEY = "kolosseum.product.app.v1";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

function seedRole(role: string) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ role }));
}

function baseRelationship(overrides: Record<string, unknown> = {}) {
  return {
    relationship_id: "rel_1",
    coach_user_id: "coach_1",
    coach_display_name: "Jordan Coach",
    coach_email: "jordan@example.com",
    relationship_state: "accepted",
    ...overrides
  };
}

function installMocks(options: {
  relationships?: Record<string, unknown>[];
  threads?: Record<string, unknown>[];
  messages?: Record<string, unknown>[];
  endFails?: boolean;
  sendFails?: boolean;
}) {
  const {
    relationships = [baseRelationship()],
    threads = [{ thread_id: "thread_1" }],
    messages = [],
    endFails = false,
    sendFails = false
  } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/coach-workspace/relationships/mine") {
      return jsonResponse({ relationships });
    }
    if (path === "/messages/athlete/threads" && method === "GET") {
      return jsonResponse({ threads });
    }
    if (path === "/messages/athlete/threads/thread_1") {
      return jsonResponse({ messages });
    }
    if (path.includes("/relationships/") && path.endsWith("/end")) {
      if (endFails) return jsonResponse({ error: "relationship_not_found" }, false, 404);
      return jsonResponse({ ok: true });
    }
    if (path.startsWith("/messages/athlete/coaches/")) {
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
  const { container } = render(<AccountCoachRelationshipPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("a coach session never requests the athlete-only relationships/mine endpoint", async () => {
  seedRole("coach");
  installMocks({});
  const requested: string[] = [];
  const mocked = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requested.push(String(input));
    return mocked(input, init);
  }) as typeof fetch;
  render(<AccountCoachRelationshipPanel />);
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:account-role-known"));
    document.dispatchEvent(new CustomEvent("kolosseum:athlete-relationship-changed"));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  assert.deepEqual(requested.filter((path) => path.includes("/relationships/mine")), []);
});

test("renders nothing when there are no relationships at all", async () => {
  seedRole("athlete");
  installMocks({ relationships: [] });
  const { container } = render(<AccountCoachRelationshipPanel />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(container.innerHTML, "");
});

test("shows the current coach and a working messaging widget", async () => {
  seedRole("athlete");
  installMocks({ messages: [{ message_id: "m1", sender_role: "coach", body_text: "Welcome!", created_at_iso8601: "2026-08-20T10:00:00.000Z" }] });
  render(<AccountCoachRelationshipPanel />);

  await screen.findByText("Jordan Coach");
  assert.ok(screen.getByText("jordan@example.com"));
  await screen.findByText("Welcome!");
});

test("the current coach shows with their coaching business name", async () => {
  seedRole("athlete");
  installMocks({ relationships: [baseRelationship({ coach_display_name: "Chris Roberts", coach_business_name: "Old Tyme Strength" })] });
  render(<AccountCoachRelationshipPanel />);

  await screen.findByText("Chris Roberts · Old Tyme Strength");
});

test("the current coach's card says which gyms they coach at", async () => {
  seedRole("athlete");
  installMocks({ relationships: [baseRelationship({ coach_gyms: [{ gym_name: "Iron Temple", area: "Leeds", on_kolosseum: true }, { gym_name: "Garage Gym", area: "", on_kolosseum: false }] })] });
  render(<AccountCoachRelationshipPanel />);

  await screen.findByText("Coaches at Iron Temple, Leeds; Garage Gym");
});

test("shows past relationships separately from the current one", async () => {
  seedRole("athlete");
  installMocks({
    relationships: [
      baseRelationship(),
      baseRelationship({ relationship_id: "rel_2", coach_display_name: "Prior Coach", relationship_state: "ended" })
    ]
  });
  render(<AccountCoachRelationshipPanel />);

  await screen.findByText("Jordan Coach");
  assert.ok(screen.getByText("Past relationships"));
  assert.ok(screen.getByText("Prior Coach"));
  assert.ok(screen.getByText("Ended"));
});

test("ending a relationship requires confirmation and calls the end route", async () => {
  seedRole("athlete");
  installMocks({});
  render(<AccountCoachRelationshipPanel />);
  await screen.findByText("Jordan Coach");

  const originalConfirm = window.confirm;
  window.confirm = () => true;
  try {
    installMocks({ relationships: [] });
    await act(async () => {
      fireEvent.click(screen.getByText("End relationship"));
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(screen.queryByText("Jordan Coach"), null);
  }
  finally {
    window.confirm = originalConfirm;
  }
});

test("declining the end-relationship confirmation does not call the end route", async () => {
  seedRole("athlete");
  installMocks({});
  render(<AccountCoachRelationshipPanel />);
  await screen.findByText("Jordan Coach");

  const originalConfirm = window.confirm;
  let confirmCalled = false;
  window.confirm = () => {
    confirmCalled = true;
    return false;
  };
  try {
    fireEvent.click(screen.getByText("End relationship"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(confirmCalled);
    assert.ok(screen.getByText("Jordan Coach"));
  }
  finally {
    window.confirm = originalConfirm;
  }
});

test("sending a message posts to the coach thread and appends nothing extra until a refetch", async () => {
  seedRole("athlete");
  let sentBody: unknown = null;
  installMocks({});
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const path = String(input);
    if (path.startsWith("/messages/athlete/coaches/")) {
      sentBody = JSON.parse(String(init?.body));
      return jsonResponse({ ok: true });
    }
    return originalFetch(input as never, init);
  }) as typeof fetch;

  render(<AccountCoachRelationshipPanel />);
  await screen.findByText("Jordan Coach");

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello coach" } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  assert.equal((sentBody as { body_text?: string } | null)?.body_text, "Hello coach");
});

test("shows a factual error when sending fails without free text", async () => {
  seedRole("athlete");
  installMocks({ sendFails: true });
  render(<AccountCoachRelationshipPanel />);
  await screen.findByText("Jordan Coach");

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello coach" } });
  await act(async () => {
    fireEvent.submit(screen.getByText("Send").closest("form")!);
  });

  await screen.findByText("That request could not be completed. Try again, or report this problem if it continues.");
});

test("a live-pushed message for the current thread is appended without a manual refresh", async () => {
  seedRole("athlete");
  installMocks({});
  render(<AccountCoachRelationshipPanel />);
  await screen.findByText("Jordan Coach");

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:athlete-coach-message-received", {
      detail: {
        thread: { thread_id: "thread_1" },
        message: { message_id: "m_live", sender_role: "coach", body_text: "Live push", created_at_iso8601: "2026-08-20T11:00:00.000Z" }
      }
    }));
  });

  await screen.findByText("Live push");
});

test("a coach display name and tagline containing markup render as inert text, never as HTML", async () => {
  seedRole("athlete");
  installMocks({
    relationships: [baseRelationship({ coach_display_name: '<img src=x onerror="window.pwned=true">', coach_brand_tagline: "<script>window.pwned=true</script>" })]
  });
  render(<AccountCoachRelationshipPanel />);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(document.querySelector(".record-row")?.textContent?.includes("<img"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".record-row img, .record-row script").length, 0);
});

test("payment due: the athlete tells their coach they've paid, then waits for them to confirm", async () => {
  seedRole("athlete");
  const myPackage = {
    membership_id: "pmem_1", package: { name: "Online coaching", price_label: "£80 a month", billing: "monthly", includes_summary: [] },
    started_on: "2026-10-01", paid_until: "2026-10-31", paid_in_full: false, payment_due: true, period_start: "2026-11-01", period_end: "2026-11-30",
    usage: {}, payments: [], payment_claim: null, payment_claim_declined_at: null, can_claim_payment: true
  };
  installMocks({ relationships: [baseRelationship({ my_package: myPackage })] });
  const mocked = globalThis.fetch;
  const posts: { path: string; body: unknown }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/check-ins/coaches/coach_1/package/paid") {
      posts.push({ path, body: JSON.parse(String(init?.body)) });
      return jsonResponse({ ok: true, membership: { ...myPackage, can_claim_payment: false, payment_claim: { claimed_at: "2026-11-03T10:00:00Z", note: "Bank transfer" } } });
    }
    return mocked(input, init);
  }) as typeof fetch;
  render(<AccountCoachRelationshipPanel />);

  fireEvent.click(await screen.findByRole("button", { name: "I've paid" }));
  fireEvent.change(screen.getByLabelText("How did you pay? (optional)"), { target: { value: "Bank transfer" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Tell Jordan Coach" }));
  });
  assert.deepEqual(posts, [{ path: "/check-ins/coaches/coach_1/package/paid", body: { note: "Bank transfer" } }]);
  await screen.findByText("You told Jordan Coach you've paid - waiting for them to confirm.");
  assert.equal(screen.queryByRole("button", { name: "I've paid" }), null);
});

test("the coach hasn't received it: the athlete is told and can say they've paid again", async () => {
  seedRole("athlete");
  installMocks({ relationships: [baseRelationship({ my_package: {
    membership_id: "pmem_1", package: { name: "Online coaching", billing: "monthly" }, started_on: "2026-10-01", paid_until: "2026-10-31",
    payment_due: true, usage: {}, payments: [], payment_claim: null, payment_claim_declined_at: "2026-11-03T12:00:00Z", can_claim_payment: true
  } })] });
  render(<AccountCoachRelationshipPanel />);
  await screen.findByText("Jordan Coach hasn't received your payment yet - check with them.");
  screen.getByRole("button", { name: "I've paid" });
});

test("payment due shows on My coach's heading, and a payment notification opens My coach at the package", async () => {
  seedRole("athlete");
  installMocks({ relationships: [baseRelationship({ my_package: {
    membership_id: "pmem_1", package: { name: "Online coaching", billing: "monthly" }, started_on: "2026-10-01", paid_until: "2026-10-31",
    payment_due: true, usage: {}, payments: [], payment_claim: null, payment_claim_declined_at: null, can_claim_payment: true
  } })] });
  const { container } = render(<AccountCoachRelationshipPanel />);
  await screen.findByRole("button", { name: "I've paid" });
  const heading = screen.getByRole("heading", { name: /My coach/ });
  assert.equal(heading.querySelector(".badge")?.textContent, "Payment due");

  // Collapsed, as Account is on a phone (app.js adds the toggle).
  const panel = container.querySelector("article.panel") as HTMLElement;
  panel.dataset.collapsible = "2";
  panel.dataset.collapsed = "true";
  const toggle = document.createElement("button");
  toggle.className = "section-toggle";
  toggle.addEventListener("click", () => { panel.dataset.collapsed = "false"; });
  heading.append(toggle);
  window.scrollTo = (() => undefined) as typeof window.scrollTo;
  document.dispatchEvent(new CustomEvent("kolosseum:open-notification-target", { detail: { route_id: "account_settings", params: {}, notification_type: "relationship_accepted" } }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(panel.dataset.collapsed, "true", "other notifications leave it alone");
  document.dispatchEvent(new CustomEvent("kolosseum:open-notification-target", { detail: { route_id: "account_settings", params: {}, notification_type: "package_payment_due" } }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(panel.dataset.collapsed, "false");
});

test("no payment due, no badge on My coach", async () => {
  seedRole("athlete");
  installMocks({ relationships: [baseRelationship({ my_package: {
    membership_id: "pmem_1", package: { name: "Online coaching", billing: "monthly" }, started_on: "2026-10-01", paid_until: "2026-11-30",
    payment_due: false, usage: {}, payments: [], payment_claim: null, payment_claim_declined_at: null, can_claim_payment: false
  } })] });
  render(<AccountCoachRelationshipPanel />);
  await screen.findByText("Paid until 30 Nov");
  assert.equal(screen.getByRole("heading", { name: /My coach/ }).querySelector(".badge"), null);
});
