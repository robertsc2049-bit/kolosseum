// Package memberships: a coach puts an athlete on a package from their
// check-ins, records a payment, and - payment due - cancels everything
// upcoming; what's used this period reads plainly.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachAthletePackageSection } from "../screens/coach/CoachAthletePackageSection";
import { CoachPaymentsPanel, money, paymentGroups } from "../screens/coach/CoachPaymentsPanel";
import { notificationTypeLabel } from "../api/notificationsClient";
import { dayLabel, paidLabel, paymentLine, usageLines } from "../utils/packages";

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

test("payments on the Athletes page: who's due, what's owed, and recording a payment from the list", async () => {
  const today = "2026-11-20";
  let lee = { ...membership({ membership_id: "pmem_lee", started_on: "2026-09-02", paid_until: "2026-10-01", next_paid_until: "2026-11-01", payment_due: true }), athlete_user_id: "ath_lee", athlete_display_name: "Lee Lapsed", owed_periods: 2, owed_minor: 16000, currency: "GBP" };
  const sam = { ...membership({ membership_id: "pmem_sam", paid_until: "2026-11-24" }), athlete_user_id: "ath_sam", athlete_display_name: "Sam Soon", owed_periods: 0, owed_minor: 0, currency: "GBP" };
  const kim = { ...membership({ membership_id: "pmem_kim", paid_until: "2027-01-01" }), athlete_user_id: "ath_kim", athlete_display_name: "Kim Paid", owed_periods: 0, owed_minor: 0, currency: "GBP" };
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/check-ins/athletes/ath_lee/package/payment") {
      lee = { ...lee, paid_until: "2026-11-01", next_paid_until: "2026-12-01", owed_periods: 1, owed_minor: 8000 };
      return jsonResponse({ ok: true, membership: lee, options: OPTIONS, recorded_payment_id: "ppay_lee" });
    }
    if (path === "/check-ins/athletes/ath_lee/package/payments/ppay_lee/undo") {
      lee = { ...lee, paid_until: "2026-10-01", next_paid_until: "2026-11-01", owed_periods: 2, owed_minor: 16000 };
      return jsonResponse({ ok: true, membership: lee, options: OPTIONS });
    }
    if (path === "/check-ins/package-members") {
      return jsonResponse({ ok: true, today, outlook_days: 30, members: [lee, sam, kim], totals: [{ currency: "GBP", owed_minor: lee.owed_minor, upcoming_minor: 8000 }] });
    }
    return jsonResponse({ error: "unhandled" }, 404);
  }) as typeof fetch;

  assert.deepEqual(Object.values(paymentGroups([lee, sam, kim], today)).map((list) => list.map((m) => m.athlete_display_name)), [["Lee Lapsed"], ["Sam Soon"], ["Kim Paid"]]);
  assert.equal(money(16000, "GBP"), "£160");
  render(<CoachPaymentsPanel />);
  await screen.findByText("1 payment due");
  screen.getByText(/Owed now: £160 · Due in the next 30 days: £80/u);
  screen.getByText(/£160 owed \(2 months\)/u);
  screen.getByText("Due in the next week");
  screen.getByText("Paid up (1)");

  let opened = "";
  const onOpen = (event: Event) => { opened = String((event as CustomEvent).detail.athlete_user_id); };
  document.addEventListener("kolosseum:open-athlete-profile-request", onOpen);
  fireEvent.click(screen.getByRole("button", { name: "Lee Lapsed" }));
  document.removeEventListener("kolosseum:open-athlete-profile-request", onOpen);
  assert.equal(opened, "ath_lee");

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: `Record payment - to ${dayLabel("2026-11-01")}: Lee Lapsed` }));
  });
  assert.deepEqual(calls.find((c) => c.path.endsWith("/payment"))?.body, {});
  await screen.findByText(`Lee Lapsed: paid until ${dayLabel("2026-11-01")}.`);
  await screen.findByText(/£80 owed$/u);
  assert.equal((screen.getByTestId("coach-payments") as HTMLDetailsElement).open, true, "stays open to show it went through");

  // Tapped by mistake: undo it.
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  });
  assert.ok(calls.some((c) => c.method === "POST" && c.path === "/check-ins/athletes/ath_lee/package/payments/ppay_lee/undo"));
  await screen.findByText("Lee Lapsed: payment undone.");
  await screen.findByText(/£160 owed \(2 months\)/u);
  assert.equal(screen.queryByRole("button", { name: "Undo" }), null);

  // A change made elsewhere (the athlete's profile) clears the old message.
  await act(async () => {
    document.dispatchEvent(new Event("kolosseum:athlete-directory-changed"));
  });
  assert.equal(screen.queryByText("Lee Lapsed: payment undone."), null);
});

test("recorded payments read plainly, with amounts only for the coach", () => {
  const at = "2026-11-03T10:00:00Z";
  const on = new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  assert.equal(paymentLine({ recorded_at: at, paid_until_from: "2026-11-22", paid_until_to: "2026-12-22", periods: 1, amount_minor: 8000, currency: "GBP" }, "monthly"), `${on} - paid up to ${dayLabel("2026-12-22")} (1 month) · £80`);
  assert.equal(paymentLine({ recorded_at: at, paid_until_from: null, paid_until_to: "2026-11-15", periods: 2 }, "weekly"), `${on} - paid up to ${dayLabel("2026-11-15")} (2 weeks)`);
  assert.equal(paymentLine({ recorded_at: at, paid_until_from: "2026-12-22", paid_until_to: "2026-11-22", periods: -1, amount_minor: -8000, currency: "GBP" }, "monthly"), `${on} - paid-up date moved back to ${dayLabel("2026-11-22")}`);
  assert.equal(paymentLine({ recorded_at: at, paid_in_full: true, periods: 1 }, "one_off"), `${on} - paid in full`);
});

test("an athlete says they've paid: the coach sees it, and can say it hasn't arrived", async () => {
  const claimed = { ...membership({ membership_id: "pmem_kim", payment_due: true, paid_until: "2026-10-31" }), athlete_user_id: "ath_kim", athlete_display_name: "Kim Paid", owed_periods: 1, owed_minor: 8000, currency: "GBP",
    payment_claim: { claimed_at: "2026-11-03T10:00:00Z", note: "Bank transfer Friday" } };
  const calls: Call[] = [];
  let members = [claimed];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: null });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/check-ins/athletes/ath_kim/package/claim/decline") {
      members = [{ ...claimed, payment_claim: null }];
      return jsonResponse({ ok: true, membership: members[0], options: OPTIONS });
    }
    if (path === "/check-ins/package-members") return jsonResponse({ ok: true, today: "2026-11-03", outlook_days: 30, members, totals: [] });
    return jsonResponse({ error: "unhandled" }, 404);
  }) as typeof fetch;

  render(<CoachPaymentsPanel />);
  await screen.findByText("1 payment due - 1 says they've paid");
  const on = new Date("2026-11-03T10:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short" });
  screen.getByText(`Says they've paid (${on}): Bank transfer Friday`);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Not received: Kim Paid" }));
  });
  assert.ok(calls.some((c) => c.method === "POST" && c.path === "/check-ins/athletes/ath_kim/package/claim/decline"));
  await screen.findByText("Kim Paid has been told it hasn't arrived yet.");
  assert.equal(screen.queryByText(/Says they've paid/), null);
  assert.equal(notificationTypeLabel({ notification_type: "athlete_package_payment_claimed", notification_payload: { package_name: "Online coaching" } }), "Says they've paid for Online coaching - confirm it");
  assert.equal(notificationTypeLabel({ notification_type: "package_payment_claim_declined", notification_payload: { package_name: "Online coaching" } }), "Your coach hasn't received your payment for Online coaching yet");
  // The athlete's receipt once the coach records it.
  assert.equal(notificationTypeLabel({ notification_type: "package_payment_recorded", notification_payload: { package_name: "Online coaching", paid_until: "2026-12-23", paid_in_full: false } }), `Payment recorded for Online coaching - paid up to ${dayLabel("2026-12-23")}`);
  assert.equal(notificationTypeLabel({ notification_type: "package_payment_recorded", notification_payload: { package_name: "PT block", paid_until: null, paid_in_full: true } }), "Payment recorded for PT block - paid in full");
});
