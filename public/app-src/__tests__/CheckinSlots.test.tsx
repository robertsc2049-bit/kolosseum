// Check-in slots: a coach sets their hours and days off; an athlete books an
// open slot from Today and can cancel a call they booked.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachAvailabilityPanel } from "../screens/account/CoachAvailabilityPanel";
import { AthleteCheckinsCard } from "../screens/athlete/AthleteCheckinsCard";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

type Call = { method: string; path: string; body: Record<string, unknown> | null };
type Handler = (method: string, path: string, body: Record<string, unknown> | null) => Response | null;

function installFetch(handler: Handler) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "u1" }, csrf_token: "csrf" });
    return handler(method, path, body) ?? jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("a coach adds weekly hours in their own time zone, and a day off", async () => {
  let availability: Record<string, unknown> = { ok: true, blocks: [], days_off: [], booking_notice_hours: 12, booking_window_days: 28 };
  const calls = installFetch((method, path, body) => {
    if (path === "/check-ins/availability") return jsonResponse(availability);
    if (path === "/check-ins/availability/blocks" && method === "POST") {
      availability = { ...availability, blocks: [{ block_id: "b1", repeats_weekly: true, weekday: body?.weekday, start: body?.start, end: body?.end, slot_minutes: body?.slot_minutes, call_method: body?.call_method }] };
      return jsonResponse(availability, 201);
    }
    if (path === "/check-ins/availability/days-off" && method === "POST") {
      availability = { ...availability, days_off: [{ day_off_id: "d1", from_date: body?.from_date, to_date: body?.to_date, note: body?.note ?? null }] };
      return jsonResponse(availability, 201);
    }
    return null;
  });
  render(<CoachAvailabilityPanel />);
  await screen.findByText("No hours set - athletes can't book a call yet.");
  screen.getByText((text) => text.includes("at least 12 hours ahead, up to 4 weeks out"));
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "18:00" } });
  fireEvent.change(screen.getByLabelText("To"), { target: { value: "19:30" } });
  fireEvent.change(screen.getByLabelText("How"), { target: { value: "teams" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add these hours" }));
  });
  await screen.findByText("Every Tuesday, 18:00-19:30");
  screen.getByText("30-minute teams calls");
  const post = calls.find((c) => c.method === "POST" && c.path === "/check-ins/availability/blocks");
  assert.equal(post?.body?.repeats_weekly, true);
  assert.equal(post?.body?.weekday, 2);
  assert.equal(post?.body?.time_zone, Intl.DateTimeFormat().resolvedOptions().timeZone);

  fireEvent.change(screen.getByLabelText("First day off"), { target: { value: "2099-12-24" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add days off" }));
  });
  assert.deepEqual(calls.find((c) => c.path === "/check-ins/availability/days-off")?.body, { from_date: "2099-12-24", to_date: "2099-12-24" });
});

const SLOTS = [
  { starts_at: "2099-11-10T18:00:00.000Z", duration_minutes: 30, call_method: "whatsapp" },
  { starts_at: "2099-11-10T18:30:00.000Z", duration_minutes: 30, call_method: "whatsapp" },
  { starts_at: "2099-11-12T09:00:00.000Z", duration_minutes: 60, call_method: "in_person" }
];

test("an athlete with nothing booked books an open slot from Today", async () => {
  window.localStorage.setItem("kolosseum.product.app.v1", JSON.stringify({ role: "athlete" }));
  let mine: Record<string, unknown>[] = [];
  let coach: Record<string, unknown> = { coach_user_id: "coach_1", coach_display_name: "Chris Roberts", coach_business_name: "Old Tyme Strength", booked_upcoming_at: null, slots: SLOTS };
  const calls = installFetch((method, path, body) => {
    if (path === "/check-ins/mine") return jsonResponse({ ok: true, checkins: mine });
    if (path === "/check-ins/slots") return jsonResponse({ ok: true, coaches: [coach] });
    if (path === "/check-ins/book" && method === "POST") {
      mine = [{ checkin_id: "chk_1", starts_at: body?.starts_at, duration_minutes: 30, call_method: "whatsapp", status: "confirmed", booked_by: "athlete", whatsapp_url: "https://wa.me/447700900123", coach_display_name: "Chris Roberts", note: body?.note ?? null }];
      coach = { ...coach, booked_upcoming_at: body?.starts_at };
      return jsonResponse({ ok: true, checkins: mine }, 201);
    }
    return null;
  });
  render(<AthleteCheckinsCard />);
  await screen.findByText("Nothing booked. Your coach has open slots.");
  fireEvent.click(screen.getByRole("button", { name: "Book a check-in" }));
  const slotButtons = screen.getAllByRole("button", { pressed: false }).filter((b) => b.classList.contains("choice-chip"));
  assert.equal(slotButtons.length, 3, "every open slot offered");
  fireEvent.click(slotButtons[1]);
  fireEvent.change(screen.getByLabelText("What do you want to talk about? (optional)"), { target: { value: "My squat" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Book this call" }));
  });
  await screen.findByText("You booked this");
  assert.deepEqual(calls.find((c) => c.path === "/check-ins/book")?.body, { coach_user_id: "coach_1", starts_at: "2099-11-10T18:30:00.000Z", note: "My squat" });
  screen.getByRole("button", { name: "Cancel this call" });
  assert.equal(screen.queryByRole("button", { name: "Ask to move" }), null, "their own booking: cancel, not ask to move");
  assert.equal(screen.queryByRole("button", { name: "Book a check-in" }), null, "one at a time");
});

test("a slot someone else just took says so", async () => {
  window.localStorage.setItem("kolosseum.product.app.v1", JSON.stringify({ role: "athlete" }));
  installFetch((method, path) => {
    if (path === "/check-ins/mine") return jsonResponse({ ok: true, checkins: [] });
    if (path === "/check-ins/slots") return jsonResponse({ ok: true, coaches: [{ coach_user_id: "coach_1", coach_display_name: "Chris Roberts", booked_upcoming_at: null, slots: SLOTS }] });
    if (path === "/check-ins/book" && method === "POST") return jsonResponse({ ok: false, error: "booking_slot_taken" }, 409);
    return null;
  });
  render(<AthleteCheckinsCard />);
  await screen.findByText("Nothing booked. Your coach has open slots.");
  fireEvent.click(screen.getByRole("button", { name: "Book a check-in" }));
  fireEvent.click(screen.getAllByRole("button").filter((b) => b.classList.contains("choice-chip"))[0]);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Book this call" }));
  });
  await screen.findByText("Someone's just taken that slot - pick another.");
});

test("an athlete cancels a call they booked", async () => {
  window.localStorage.setItem("kolosseum.product.app.v1", JSON.stringify({ role: "athlete" }));
  let mine: Record<string, unknown>[] = [{ checkin_id: "chk_1", starts_at: SLOTS[0].starts_at, duration_minutes: 30, call_method: "whatsapp", status: "confirmed", booked_by: "athlete", coach_display_name: "Chris Roberts" }];
  const calls = installFetch((method, path) => {
    if (path === "/check-ins/mine") return jsonResponse({ ok: true, checkins: mine });
    if (path === "/check-ins/slots") return jsonResponse({ ok: true, coaches: [] });
    if (path === "/check-ins/chk_1/cancel-mine" && method === "POST") { mine = []; return jsonResponse({ ok: true, checkins: [] }); }
    return null;
  });
  render(<AthleteCheckinsCard />);
  await screen.findByText("You booked this");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Cancel this call" }));
  });
  assert.ok(calls.some((c) => c.path === "/check-ins/chk_1/cancel-mine"));
  assert.equal(screen.queryByTestId("athlete-checkins"), null, "nothing booked and no slots: the card goes");
});
