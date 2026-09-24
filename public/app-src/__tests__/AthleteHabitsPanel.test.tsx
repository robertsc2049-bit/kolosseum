// DEV NOTE: coach_athlete_detail habits mirror behavioral proof - replaces
// the source-text regex checks
// test/full_ui_29_body_metrics_habits_surface.test.mjs previously ran
// against the removed #athleteDetailHabitList DOM id and
// refreshCoachAthleteHabits() for exactly this coach-side capability.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteHabitsPanel } from "../screens/coach/AthleteHabitsPanel";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installFetchMock(handler: (call: FetchCall) => Response) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler({ input, init })) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; } };
}

async function openPanel(habits: Record<string, unknown>[]) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/habits/coach/")) return jsonResponse({ habits });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteHabitsPanel />);

  act(() => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:coach-athlete-profile-opened", {
        detail: { athlete_user_id: "athlete_test123" }
      })
    );
  });
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the coach opens an athlete's profile", () => {
  installFetchMock(() => jsonResponse({}, false, 404));
  render(<AthleteHabitsPanel />);
  assert.equal(document.body.textContent, "");
});

test("renders a habit with cadence badge and plain-integer streak copy, read-only", async () => {
  await openPanel([
    { habit_id: "habit_1", habit_label: "Stretch", cadence: "daily", current_streak_length: 3, longest_streak_length: 5, total_completions: 12, archived_at_iso8601: null }
  ]);

  await waitFor(() => screen.getByText("Stretch"));

  assert.equal(document.querySelector(".record-card .badge")?.textContent, "Daily");
  assert.match(document.querySelector(".record-card p")?.textContent ?? "", /3 days logged in a row - longest 5, 12 total\./u);
  assert.equal(document.querySelectorAll(".record-card button").length, 0);
});

test("archived habits show an Archived tag", async () => {
  await openPanel([
    { habit_id: "habit_1", habit_label: "Old habit", cadence: "weekly", current_streak_length: 0, longest_streak_length: 4, total_completions: 9, archived_at_iso8601: "2026-08-01T00:00:00.000Z" }
  ]);

  await waitFor(() => screen.getByText("Old habit"));
  assert.ok(screen.getByText("Archived"));
});

test("shows a factual empty state when the athlete has no habits yet", async () => {
  await openPanel([]);
  await waitFor(() => screen.getByText("No habits yet."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel([
    { habit_id: "habit_1", habit_label: "Stretch", cadence: "daily", current_streak_length: 1, longest_streak_length: 1, total_completions: 1, archived_at_iso8601: null }
  ]);
  await waitFor(() => screen.getByText("Stretch"));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText("Stretch"), null));
});
