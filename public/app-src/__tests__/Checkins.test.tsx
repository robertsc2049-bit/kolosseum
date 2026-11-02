// Check-in calls: the coach's call settings, booking from an athlete's
// profile, and the athlete's card on Today (join, add to calendar, confirm,
// ask to move).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachCallSettingsPanel } from "../screens/account/CoachCallSettingsPanel";
import { AthleteCheckinsCard } from "../screens/athlete/AthleteCheckinsCard";
import { CoachAthleteCheckinsPanel } from "../screens/coach/CoachAthleteCheckinsPanel";
import { checkinCalendarFile } from "../utils/checkins";

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
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "u1" }, csrf_token: "csrf-abc" });
    return handler(method, path, body) ?? jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return calls;
}

const TEAMS = "https://teams.microsoft.com/l/meetup-join/abc";
const CHECKIN = {
  checkin_id: "chk_1", series_id: null, starts_at: "2099-11-04T18:00:00.000Z", duration_minutes: 30, call_method: "whatsapp",
  note: "Review the block", status: "scheduled", athlete_message: null, whatsapp_url: "https://wa.me/447700900123",
  coach_user_id: "coach_1", coach_display_name: "Chris Roberts", coach_business_name: "Old Tyme Strength"
};

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("a coach saves their WhatsApp number and Teams link; a bad number is explained", async () => {
  let saved = { whatsapp_number: null as string | null, teams_link: null as string | null };
  const calls = installFetch((method, path, body) => {
    if (path !== "/check-ins/call-settings") return null;
    if (method === "PUT") {
      if (String(body?.whatsapp_number).startsWith("07")) return jsonResponse({ ok: false, error: "checkin_whatsapp_number_invalid" }, 422);
      saved = { whatsapp_number: String(body?.whatsapp_number).replace(/\D/g, ""), teams_link: String(body?.teams_link) };
    }
    return jsonResponse({ ok: true, call_settings: saved });
  });
  render(<CoachCallSettingsPanel />);
  const number = await screen.findByLabelText("WhatsApp number (with country code)");
  fireEvent.change(number, { target: { value: "07700 900123" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
  await screen.findByText("Enter your WhatsApp number with the country code, e.g. +44 7700 900123.");
  fireEvent.change(number, { target: { value: "+44 7700 900123" } });
  fireEvent.change(screen.getByLabelText("Teams meeting link"), { target: { value: TEAMS } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
  await screen.findByText("Saved.");
  assert.equal((number as HTMLInputElement).value, "+447700900123");
  assert.deepEqual(calls.filter((c) => c.method === "PUT").at(-1)?.body, { whatsapp_number: "+44 7700 900123", teams_link: TEAMS });
});

function openProfile(athleteUserId: string) {
  document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-opened", { detail: { athlete_user_id: athleteUserId } }));
}

test("a coach books a weekly run of Teams calls from the athlete's profile", async () => {
  let checkins: Record<string, unknown>[] = [];
  const calls = installFetch((method, path, body) => {
    if (path === "/check-ins/athletes/ath_1") return jsonResponse({ ok: true, call_settings: { whatsapp_number: null, teams_link: TEAMS }, checkins });
    if (path === "/check-ins" && method === "POST") {
      checkins = [{ ...CHECKIN, call_method: "teams", whatsapp_url: undefined, teams_link: TEAMS, series_id: "cser_1", starts_at: body?.starts_at }];
      return jsonResponse({ ok: true, call_settings: { whatsapp_number: null, teams_link: TEAMS }, checkins }, 201);
    }
    return null;
  });
  render(<CoachAthleteCheckinsPanel />);
  await act(async () => openProfile("ath_1"));
  await screen.findByText("No check-ins booked.");
  fireEvent.click(screen.getByRole("button", { name: "Book a check-in" }));
  screen.getByText("Add your WhatsApp number under Account → Branding first.");
  assert.equal((screen.getByRole("button", { name: "Book" }) as HTMLButtonElement).disabled, true, "no WhatsApp number yet");
  fireEvent.change(screen.getByLabelText("How"), { target: { value: "teams" } });
  fireEvent.change(screen.getByLabelText("Date and time"), { target: { value: "2099-11-04T18:00" } });
  fireEvent.change(screen.getByLabelText("Repeat"), { target: { value: "weekly" } });
  fireEvent.change(screen.getByLabelText("How many calls"), { target: { value: "4" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Book" }));
  });
  await screen.findByText("Waiting for them to confirm");
  const post = calls.find((c) => c.method === "POST" && c.path === "/check-ins");
  assert.deepEqual(post?.body, { athlete_user_id: "ath_1", starts_at: new Date("2099-11-04T18:00").toISOString(), duration_minutes: 30, call_method: "teams", repeat: "weekly", occurrences: 4 });
  assert.equal(screen.getByRole("link", { name: "Join on Teams" }).getAttribute("href"), TEAMS);
  screen.getByRole("button", { name: "Cancel this and later" });
});

test("the coach sees when an athlete asked to move a call, and why", async () => {
  installFetch((_method, path) => (path === "/check-ins/athletes/ath_1"
    ? jsonResponse({ ok: true, call_settings: {}, checkins: [{ ...CHECKIN, status: "move_requested", athlete_message: "Any evening after 6?" }] })
    : null));
  render(<CoachAthleteCheckinsPanel />);
  await act(async () => openProfile("ath_1"));
  await screen.findByText("Asked to move it");
  screen.getByText("“Any evening after 6?”");
});

test("the athlete joins on WhatsApp, confirms, or asks to move with a message", async () => {
  window.localStorage.setItem("kolosseum.product.app.v1", JSON.stringify({ role: "athlete" }));
  let current: Record<string, unknown> = CHECKIN;
  const calls = installFetch((method, path, body) => {
    if (path === "/check-ins/mine") return jsonResponse({ ok: true, checkins: [current] });
    if (path === "/check-ins/chk_1/respond" && method === "POST") {
      current = { ...current, status: body?.response === "confirm" ? "confirmed" : "move_requested" };
      return jsonResponse({ ok: true, checkins: [current] });
    }
    return null;
  });
  render(<AthleteCheckinsCard />);
  await screen.findByText("WhatsApp call with Chris Roberts · Old Tyme Strength · 30 min");
  assert.equal(screen.getByRole("link", { name: "Open WhatsApp" }).getAttribute("href"), "https://wa.me/447700900123");
  screen.getByText("Can you make it?");

  fireEvent.click(screen.getByRole("button", { name: "Ask to move" }));
  assert.equal((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled, true, "a reason is needed");
  fireEvent.change(screen.getByLabelText("When suits you better?"), { target: { value: "Saturday morning" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
  await screen.findByText("You asked to move it - your coach will pick a new time");
  assert.deepEqual(calls.find((c) => c.method === "POST")?.body, { response: "move", message: "Saturday morning" });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  });
  await screen.findByText("You confirmed");
  assert.equal(screen.queryByRole("button", { name: "Confirm" }), null);
});

test("coaches see no athlete check-in card", async () => {
  window.localStorage.setItem("kolosseum.product.app.v1", JSON.stringify({ role: "coach" }));
  const calls = installFetch(() => null);
  render(<AthleteCheckinsCard />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(screen.queryByTestId("athlete-checkins"), null);
  assert.equal(calls.length, 0);
});

test("the calendar file has the time, length, join link and a 15-minute reminder", () => {
  const file = checkinCalendarFile({ ...CHECKIN, note: "Block review; next steps, maybe" }, "Check-in with Chris Roberts");
  assert.ok(file.includes("DTSTART:20991104T180000Z\r\n"));
  assert.ok(file.includes("DTEND:20991104T183000Z\r\n"));
  assert.ok(file.includes("URL:https://wa.me/447700900123\r\n"));
  assert.ok(file.includes("DESCRIPTION:WhatsApp call\\nhttps://wa.me/447700900123\\nBlock review\\; next steps\\, maybe\r\n"));
  assert.ok(file.includes("TRIGGER:-PT15M"));
  assert.ok(file.startsWith("BEGIN:VCALENDAR\r\n") && file.endsWith("END:VCALENDAR\r\n"));
});
