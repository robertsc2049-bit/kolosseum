// Kolosseum programmes for an athlete without a coach: start one that suits
// them, see their progress, switch (with a confirmation) or stop.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteProgrammeCard } from "../screens/athlete/AthleteProgrammeCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const fullBody = { listing_id: "programme_full_body", title: "Beginner full-body", summary: "Three full-body days on the main lifts.", levels: ["beginner"], activity_ids: [], days_per_week: 3, sport_specific: false };
const rugby = { listing_id: "programme_rugby", title: "Rugby off-season strength", summary: "Build strength before pre-season.", levels: ["beginner", "amateur"], activity_ids: ["rugby_union"], days_per_week: 3, sport_specific: true };

function installMocks(initial: Record<string, unknown>) {
  const puts: unknown[] = [];
  let state = initial;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/programmes") return jsonResponse(state);
    if (path === "/account/onboarding/programme" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      puts.push(body);
      const chosen = [fullBody, rugby].find((o) => o.listing_id === body.listing_id);
      state = { ...state, current: chosen ? { run_id: "run_2", listing_id: chosen.listing_id, title: chosen.title, sessions_done: 0, sessions_total: 6 } : null };
      return jsonResponse(state);
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return puts;
}

test.afterEach(() => cleanup());

test("a beginner rugby player sees their sport's programme first, then a general one, and starts one", async () => {
  const puts = installMocks({ current: null, options: [rugby, fullBody] });
  render(<AthleteProgrammeCard />);
  await screen.findByText("Choose your programme");
  const titles = [...document.querySelectorAll(".programme-option strong")].map((el) => el.textContent);
  assert.deepEqual(titles, ["Rugby off-season strength", "Beginner full-body"]);
  assert.ok(screen.getByText("Rugby Union"));
  assert.ok(screen.getByText("Any sport"));
  assert.ok(screen.getAllByText("3 days a week · Beginner, Amateur")[0]);
  await act(async () => {
    fireEvent.click(screen.getByText("Start Rugby off-season strength"));
  });
  await waitFor(() => assert.deepEqual(puts, [{ listing_id: "programme_rugby" }]));
  await screen.findByText("0 of 6 sessions done. Your sessions follow this programme in order.");
});

test("switching programme mid-way asks first, because progress on the current one ends", async () => {
  const puts = installMocks({ current: { run_id: "run_1", listing_id: "programme_rugby", title: "Rugby off-season strength", sessions_done: 4, sessions_total: 12 }, options: [rugby, fullBody] });
  render(<AthleteProgrammeCard />);
  await screen.findByText("4 of 12 sessions done. Your sessions follow this programme in order.");
  fireEvent.click(screen.getByText("Switch programme"));
  fireEvent.click(screen.getByText("Start Beginner full-body"));
  assert.ok(screen.getByText("Switch to Beginner full-body? Your progress on Rugby off-season strength ends."));
  assert.equal(puts.length, 0, "nothing changes until they confirm");
  await act(async () => {
    fireEvent.click(screen.getByText("Switch"));
  });
  await waitFor(() => assert.deepEqual(puts, [{ listing_id: "programme_full_body" }]));
});

test("stopping a programme asks first", async () => {
  const puts = installMocks({ current: { run_id: "run_1", listing_id: "programme_full_body", title: "Beginner full-body", sessions_done: 1, sessions_total: 6 }, options: [fullBody] });
  render(<AthleteProgrammeCard />);
  await screen.findByText("Beginner full-body");
  fireEvent.click(screen.getByText("Stop programme"));
  assert.ok(screen.getByText("Stop this programme? You'll choose what to train next before your next session."));
  await act(async () => {
    fireEvent.click(screen.getAllByText("Stop programme")[0]);
  });
  await waitFor(() => assert.deepEqual(puts, [{ listing_id: null }]));
});

test("with no programmes for their level yet, the athlete is told they're on their generated programme", async () => {
  installMocks({ current: null, options: [] });
  render(<AthleteProgrammeCard />);
  await screen.findByText(/no Kolosseum programmes for your level yet/u);
});
