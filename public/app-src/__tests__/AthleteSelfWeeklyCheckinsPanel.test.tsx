// DEV NOTE: athlete's own weekly check-in behavioral proof - replaces the
// source-text regex checks against the now-removed app.js
// defaultWeeklyCheckinWeekStartDate()/renderWeeklyCheckinCard()/
// renderWeeklyCheckinList()/refreshWeeklyCheckins()/submitWeeklyCheckin()
// rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteSelfWeeklyCheckinsPanel } from "../screens/athlete/AthleteSelfWeeklyCheckinsPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  checkins?: Record<string, unknown>[];
  submitFails?: boolean;
}) {
  const { checkins = [], submitFails = false } = options;
  let currentCheckins = checkins;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/weekly-checkins") && method === "GET") return jsonResponse({ ok: true, checkins: currentCheckins });
    if (path.startsWith("/weekly-checkins") && method === "POST") {
      if (submitFails) return jsonResponse({ error: "submission_invalid" }, false, 400);
      const body = JSON.parse(String(init?.body ?? "{}"));
      const record = { ...body };
      currentCheckins = [...currentCheckins, record];
      return jsonResponse({ ok: true, checkin: record }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when no check-ins are recorded", async () => {
  installMocks({ checkins: [] });
  render(<AthleteSelfWeeklyCheckinsPanel />);
  await waitFor(() => screen.getByText("No weekly check-ins yet."));
});

test("renders an existing check-in with week, ratings and an optional note", async () => {
  installMocks({
    checkins: [
      { week_start_date: "2026-01-05", energy_level: 4, motivation_level: 3, sleep_quality: 5, note: "Felt good this week" }
    ]
  });

  render(<AthleteSelfWeeklyCheckinsPanel />);

  await waitFor(() => screen.getByText(/Week of/u));
  assert.match(document.body.textContent ?? "", /Energy 4\/5 · Motivation 3\/5 · Sleep 5\/5/u);
  assert.ok(screen.getByText("Felt good this week"));
});

test("omits the note paragraph when a check-in has none", async () => {
  installMocks({
    checkins: [{ week_start_date: "2026-01-05", energy_level: 4, motivation_level: 3, sleep_quality: 5 }]
  });

  render(<AthleteSelfWeeklyCheckinsPanel />);
  await waitFor(() => screen.getByText(/Week of/u));

  const card = document.querySelector(".record-card") as HTMLElement;
  assert.equal(card.querySelectorAll("p").length, 1);
});

test("the form defaults the week-starting field to the most recent Monday", async () => {
  installMocks({ checkins: [] });
  render(<AthleteSelfWeeklyCheckinsPanel />);
  await waitFor(() => screen.getByText("No weekly check-ins yet."));

  const weekInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  const parsed = new Date(`${weekInput.value}T00:00:00.000Z`);
  assert.equal(parsed.getUTCDay(), 1);
});

test("blocks submission client-side when a rating is missing, without calling the server", async () => {
  installMocks({ checkins: [] });
  render(<AthleteSelfWeeklyCheckinsPanel />);
  await waitFor(() => screen.getByText("No weekly check-ins yet."));

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => screen.getByText("Enter a week and all three ratings."));
});

test("submits a check-in, then resets the form and shows the new entry", async () => {
  installMocks({ checkins: [] });
  render(<AthleteSelfWeeklyCheckinsPanel />);
  await waitFor(() => screen.getByText("No weekly check-ins yet."));

  const numberInputs = document.querySelectorAll('input[type="number"]');
  fireEvent.change(numberInputs[0], { target: { value: "4" } });
  fireEvent.change(numberInputs[1], { target: { value: "3" } });
  fireEvent.change(numberInputs[2], { target: { value: "5" } });
  const noteInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(noteInput, { target: { value: "Good week" } });

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => screen.getByText("Check-in submitted."));
  assert.match(document.body.textContent ?? "", /Energy 4\/5 · Motivation 3\/5 · Sleep 5\/5/u);
  assert.equal((document.querySelectorAll('input[type="number"]')[0] as HTMLInputElement).value, "");
  assert.equal(noteInput.value, "");
});

test("shows a submit error and keeps the entered values when the server rejects the check-in", async () => {
  installMocks({ checkins: [], submitFails: true });
  render(<AthleteSelfWeeklyCheckinsPanel />);
  await waitFor(() => screen.getByText("No weekly check-ins yet."));

  const numberInputs = document.querySelectorAll('input[type="number"]');
  fireEvent.change(numberInputs[0], { target: { value: "4" } });
  fireEvent.change(numberInputs[1], { target: { value: "3" } });
  fireEvent.change(numberInputs[2], { target: { value: "5" } });

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => screen.getByText("Check-in could not be submitted."));
  assert.equal((document.querySelectorAll('input[type="number"]')[0] as HTMLInputElement).value, "4");
});

test("a note containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    checkins: [
      { week_start_date: "2026-01-05", energy_level: 4, motivation_level: 3, sleep_quality: 5, note: '<img src=x onerror="window.pwned=true">' }
    ]
  });

  render(<AthleteSelfWeeklyCheckinsPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({ checkins: [] });
  render(<AthleteSelfWeeklyCheckinsPanel />);
  await waitFor(() => screen.getByText("No weekly check-ins yet."));

  installMocks({ checkins: [{ week_start_date: "2026-01-05", energy_level: 4, motivation_level: 3, sleep_quality: 5 }] });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));
  });

  await waitFor(() => screen.getByText(/Week of/u));
});
