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

test("a rugby player who's finished their programme is offered the one their coach says comes next, and starts it without a warning - nothing is lost", async () => {
  const puts = installMocks({
    current: {
      run_id: "run_1", listing_id: "programme_full_body", title: "Beginner full-body", sessions_done: 12, sessions_total: 12, finished: true,
      next: { ...rugby, suits_level: true }, can_repeat: true
    },
    options: [rugby, fullBody]
  });
  render(<AthleteProgrammeCard />);
  await screen.findByText("Finished - all 12 sessions done. Choose what to train next.");
  assert.equal(screen.queryByText("Stop programme"), null, "nothing to stop");
  const next = screen.getByTestId("programme-next");
  assert.ok(next.textContent?.includes("Rugby off-season strength"));
  await act(async () => {
    fireEvent.click(screen.getByText("Start Rugby off-season strength"));
  });
  await waitFor(() => assert.deepEqual(puts, [{ listing_id: "programme_rugby" }]));
  await screen.findByText("0 of 6 sessions done. Your sessions follow this programme in order.");
});

test("a finished beginner sees what moving up leads to, and can run their programme again", async () => {
  const puts = installMocks({
    current: {
      run_id: "run_1", listing_id: "programme_full_body", title: "Beginner full-body", sessions_done: 36, sessions_total: 36, finished: true,
      next: { listing_id: "programme_intermediate", title: "Intermediate upper/lower", summary: "Four days.", levels: ["amateur", "pro"], activity_ids: [], days_per_week: 4, suits_level: false },
      can_repeat: true
    },
    options: [fullBody]
  });
  render(<AthleteProgrammeCard />);
  await screen.findByText("Intermediate upper/lower");
  assert.ok(screen.getByText("It's for amateur and pro athletes. When you're ready to move up, change your training level in your setup, then start it here."));
  assert.equal(screen.queryByText("Start Intermediate upper/lower"), null);
  await act(async () => {
    fireEvent.click(screen.getByText("Run it again"));
  });
  await waitFor(() => assert.deepEqual(puts, [{ listing_id: "programme_full_body" }]));
});

test("mid-programme, the card says which week and block the next session is in, and flags a lighter block", async () => {
  installMocks({
    current: { run_id: "run_1", listing_id: "programme_rugby", title: "Run and ride strength", sessions_done: 13, sessions_total: 24,
      next_position: { week_number: 7, weeks_total: 12, block_name: "Heavy strength", block_type: "strength" } },
    options: [rugby]
  });
  render(<AthleteProgrammeCard />);
  await screen.findByText("Week 7 of 12 · Heavy strength");
  assert.ok(screen.getByText("13 of 24 sessions done. Your sessions follow this programme in order."));
  cleanup();

  installMocks({
    current: { run_id: "run_1", listing_id: "programme_fight", title: "Fight camp strength", sessions_done: 12, sessions_total: 15,
      next_position: { week_number: 7, weeks_total: 8, block_name: "Taper and fight week", block_type: "deload" } },
    options: []
  });
  render(<AthleteProgrammeCard />);
  await screen.findByText("Week 7 of 8 · Taper and fight week (lighter)");
});

test("each programme says how it fits: a 4-day plan for someone who trains 3, and when to start a meet prep for their meet", async () => {
  const meetPrep = { ...rugby, listing_id: "programme_meet", title: "Powerlifting meet prep (12 weeks)", days_per_week: 4,
    fit: { weeks_total: 12, days: { programme: 4, athlete: 3 }, competition: { date: "2027-02-23", weeks_away: 20, start_on: "2026-12-01", timing: "too_early" } } };
  const tooLate = { ...rugby, listing_id: "programme_late", title: "Fight camp strength (8 weeks)", days_per_week: 2,
    fit: { weeks_total: 8, days: null, competition: { date: "2026-11-10", weeks_away: 5, start_on: "2026-09-15", timing: "too_late" } } };
  installMocks({ current: null, options: [meetPrep, tooLate] });
  render(<AthleteProgrammeCard />);
  await screen.findByText("Powerlifting meet prep (12 weeks)");
  assert.ok(screen.getByText("4 days a week - you said you train 3, so it will take longer than 12 weeks."));
  assert.ok(screen.getByText("Your competition is in 20 weeks: start this the week of 1 Dec so it peaks on 23 Feb."));
  assert.ok(screen.getByText("Your competition is in 5 weeks; this is an 8-week programme, so it won't peak on the day."));
});
