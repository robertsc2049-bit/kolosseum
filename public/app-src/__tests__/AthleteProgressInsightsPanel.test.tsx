// DEV NOTE: coach_athlete_detail progress-insights mirror behavioral proof
// - replaces the source-text regex checks
// test/full_ui_36_progress_insights_surface.test.mjs previously ran against
// the now-removed app.js renderProgressInsightsCompactList/
// refreshCoachAthleteProgressInsights functions for exactly this
// coach-side capability. The athlete's own progress-insights view stays
// legacy and is still covered there.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteProgressInsightsPanel } from "../screens/coach/AthleteProgressInsightsPanel";

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

const exercises = [{ exercise_id: "back_squat", display_name: "Back Squat" }];

function baseInsights(overrides: Record<string, unknown> = {}) {
  return {
    session_adherence: {
      has_sufficient_data: true,
      adherence_percentage: 80,
      completed_sessions: 8,
      total_sessions: 10
    },
    strength_trends: [
      {
        exercise_id: "back_squat",
        current_value: 150,
        current_unit: "kg",
        current_effective_date: "2026-08-01",
        has_prior_value: true,
        delta: 10,
        delta_percentage: 7.1,
        prior_effective_date: "2026-07-01"
      }
    ],
    habit_consistency: [
      {
        habit_label: "Sleep 8 hours",
        cadence: "daily",
        completion_rate_percentage: 90,
        window_completions: 27,
        window_expected_units: 30,
        current_streak_length: 5,
        longest_streak_length: 12
      }
    ],
    body_metric_trends: [
      {
        metric_type: "body_weight_kg",
        unit: "kg",
        latest_value: 82,
        latest_effective_date: "2026-08-10",
        has_prior_value: false
      }
    ],
    ...overrides
  };
}

async function openPanel(insights: Record<string, unknown> | null) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/progress-insights/coach/")) return jsonResponse({ insights });
    if (path === "/templates/exercises") return jsonResponse({ exercises });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteProgressInsightsPanel />);

  act(() => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:coach-athlete-profile-opened", {
        detail: { athlete_user_id: "athlete_test123" }
      })
    );
  });

  await waitFor(() => screen.getByText(/adherence/u));
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the coach opens an athlete's profile", () => {
  installFetchMock(() => jsonResponse({}, false, 404));
  render(<AthleteProgressInsightsPanel />);
  assert.equal(document.body.textContent, "");
});

test("displays adherence, strength trend, habit consistency and body-metric trend cards", async () => {
  await openPanel(baseInsights());

  assert.match(document.body.textContent ?? "", /80% adherence — 8 of 10 sessions completed/u);
  assert.match(document.body.textContent ?? "", /Back Squat/u);
  assert.match(document.body.textContent ?? "", /150 kg/u);
  assert.match(document.body.textContent ?? "", /\+10 kg \(\+7\.1%\) since/u);
  assert.match(document.body.textContent ?? "", /Sleep 8 hours/u);
  assert.match(document.body.textContent ?? "", /90% of expected completions/u);
  assert.match(document.body.textContent ?? "", /Body weight/u);
  assert.match(document.body.textContent ?? "", /82 kg/u);
  assert.match(document.body.textContent ?? "", /No entry from 30\+ days ago to compare yet\./u);
});

test("falls back to a title-cased exercise id when the exercise isn't in the loaded list", async () => {
  await openPanel(
    baseInsights({
      strength_trends: [
        {
          exercise_id: "unknown_lift",
          current_value: 50,
          current_unit: "kg",
          current_effective_date: "2026-08-01",
          has_prior_value: false
        }
      ]
    })
  );

  assert.match(document.body.textContent ?? "", /Unknown Lift/u);
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel(baseInsights());

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText(/adherence/u), null));
});

test("a habit label containing markup is rendered as inert text, never as HTML", async () => {
  await openPanel(
    baseInsights({
      habit_consistency: [
        {
          habit_label: '<img src=x onerror="window.pwned=true">',
          cadence: "daily",
          completion_rate_percentage: 50,
          window_completions: 15,
          window_expected_units: 30,
          current_streak_length: 1,
          longest_streak_length: 1
        }
      ]
    })
  );

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
  assert.match(document.body.textContent ?? "", /<img src=x onerror="window\.pwned=true">/u);
});
