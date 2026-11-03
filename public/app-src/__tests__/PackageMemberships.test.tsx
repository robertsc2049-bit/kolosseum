// Package memberships: a coach puts an athlete on a package from their
// check-ins, records a payment, and - payment due - cancels everything
// upcoming; what's used this period reads plainly.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachAthletePackageSection } from "../screens/coach/CoachAthletePackageSection";
import { notificationTypeLabel } from "../api/notificationsClient";
import { dayLabel, paidLabel, usageLines } from "../utils/packages";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

type Call = { method: string; path: string; body: Record<string, unknown> | null };

const OPTIONS = [
  { package_id: "pkg_online", name: "Online coaching", price_label: "£80 a month", billing: "monthly", includes_summary: ["Programming"], gym_name: null },
  { package_id: "pkg_pt", name: "PT block", price_label: "£120", billing: "one_off", includes_summary: ["4 in-person sessions"], gym_name: "Forge" }
];

function membership(overrides: Record<string, unknown> = {}) {
  return {
    membership_id: "pmem_1",
    package: { package_id: "pkg_online", name: "Online coaching", price_label: "£80 a month", billing: "monthly", includes_summary: ["Programming"], gym_name: null },
    started_on: "2026-11-02", paid_until: "2026-12-01", paid_in_full: false, next_paid_until: "2027-01-01", payment_due: false, period_start: "2026-11-02", period_end: "2026-12-01",
    usage: { checkin_calls: { used: 1, included: 2 }, in_person_sessions: { used: 0, included: 0 } },
    ...overrides
  };
}

function installFetch() {
  const calls: Call[] = [];
  let current: Record<string, unknown> | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    const base = "/check-ins/athletes/ath_1/package";
    if (path === base && method === "PUT") current = membership({ paid_until: null, payment_due: true });
    else if (path === `${base}/payment`) current = membership();
    else if (path === `${base}/cancel-upcoming`) return jsonResponse({ ok: true, membership: current, options: OPTIONS, cancelled_count: 3 });
    else if (path === `${base}/end`) current = null;
    else if (path !== base) return jsonResponse({ error: "unhandled" }, 404);
    return jsonResponse({ ok: true, membership: current, options: OPTIONS });
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => cleanup());

test("a coach puts an athlete on a package, cancels what's booked while payment is due, then records the payment", async () => {
  const calls = installFetch();
  let reloaded = 0;
  render(<CoachAthletePackageSection athleteUserId="ath_1" upcomingCount={3} onCheckinsChanged={() => { reloaded += 1; }} />);
  await screen.findByText("Not on a package.");
  fireEvent.click(screen.getByRole("button", { name: "Put them on a package" }));
  fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2026-11-02" } });
  fireEvent.click(screen.getByLabelText("They've paid for the first month"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
  assert.deepEqual(calls.find((c) => c.method === "PUT")?.body, { package_id: "pkg_online", started_on: "2026-11-02", paid_now: false });
  await screen.findByText("Payment due");
  screen.getByText("They can't book your open slots until you record a payment.");

  fireEvent.click(screen.getByRole("button", { name: "Cancel upcoming sessions and check-ins" }));
  screen.getByText("Cancel the 3 upcoming calls and sessions with them? They'll be told.");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel them" }));
  });
  await screen.findByText("Cancelled 3 upcoming calls and sessions.");
  assert.equal(reloaded, 1);

  fireEvent.click(screen.getByRole("button", { name: "Record a payment" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Record payment - paid until/ }));
  });
  assert.deepEqual(calls.find((c) => c.path.endsWith("/payment"))?.body, {});
  await screen.findByText(/^Paid until/u);
  screen.getByText("1 of 2 check-in calls this month");
  screen.getByText(/^This month: /);
  assert.equal(screen.queryByRole("button", { name: "Cancel upcoming sessions and check-ins" }), null);

  fireEvent.click(screen.getByRole("button", { name: "End package" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Yes, end it" }));
  });
  await screen.findByText("Not on a package.");
});

test("a one-off package switches to paid in full; usage lines say what's left", () => {
  const oneOff = membership({ package: { ...OPTIONS[1], billing: "one_off" }, paid_until: null, paid_in_full: true, usage: { checkin_calls: { used: 0, included: 0 }, in_person_sessions: { used: 3, included: 4 } } });
  assert.equal(paidLabel(oneOff), "Paid in full");
  assert.deepEqual(usageLines(oneOff), ["3 of 4 in-person sessions so far"]);
  assert.equal(paidLabel(membership({ payment_due: true, paid_until: null })), "Payment due");
  assert.deepEqual(usageLines(membership({ usage: { checkin_calls: { used: 1, included: 0 }, in_person_sessions: { used: 0, included: 0 } } })), ["1 check-in call this month"]);
  assert.deepEqual(usageLines(membership({ usage: { checkin_calls: { used: 0, included: 2 }, in_person_sessions: { used: 3, included: 1 } } })), ["0 of 2 check-in calls this month", "3 in-person sessions this month - 1 included"]);
});

test("nothing booked: no cancel button even while payment is due", async () => {
  installFetch();
  render(<CoachAthletePackageSection athleteUserId="ath_1" upcomingCount={0} onCheckinsChanged={() => undefined} />);
  fireEvent.click(await screen.findByRole("button", { name: "Put them on a package" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
  await screen.findByText("Payment due");
  assert.equal(screen.queryByRole("button", { name: "Cancel upcoming sessions and check-ins" }), null);
});

test("payment reminders in the bell name the package and the paid-up date", () => {
  const label = (type: string, payload: Record<string, unknown>) => notificationTypeLabel({ notification_type: type, notification_payload: payload });
  // Dates follow the viewer's locale ("1 Dec" / "Dec 1").
  assert.equal(label("package_payment_upcoming", { package_name: "Online coaching", paid_until: "2026-12-01" }), `Online coaching is paid up to ${dayLabel("2026-12-01")} - payment due soon`);
  assert.match(label("package_payment_due", { package_name: "Online coaching", paid_until: null }), /^Payment due for Online coaching$/);
  assert.equal(label("athlete_package_payment_due", { package_name: "PT block", paid_until: "2026-11-30" }), `Payment due for PT block - was paid up to ${dayLabel("2026-11-30")}`);
  assert.equal(label("package_payment_due", {}), "Package payment due");
});
