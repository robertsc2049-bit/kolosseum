// DEV NOTE: athlete's own progress insights behavioral proof - replaces
// the source-text regex checks against the now-removed app.js
// progressInsightsAdherenceText()/renderStrengthTrendCard()/
// renderHabitConsistencyCard()/renderBodyMetricTrendCard()/
// renderProgressInsightsSummary() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";

import { AthleteSelfProgressInsightsPanel } from "../screens/athlete/AthleteSelfProgressInsightsPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  insights?: Record<string, unknown>;
  exercises?: Record<string, unknown>[];
  insightsFail?: boolean;
}) {
  const {
    insights = {
      session_adherence: { has_sufficient_data: false },
      strength_trends: [],
      habit_consistency: [],
      body_metric_trends: []
    },
    exercises = [],
    insightsFail = false
  } = options;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/progress-insights")) {
      if (insightsFail) return jsonResponse({ error: "service_unavailable" }, false, 500);
      return jsonResponse({ ok: true, insights });
    }
    if (path.startsWith("/templates/exercises")) return jsonResponse({ ok: true, exercises });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual no-data message and empty states when nothing has been recorded", async () => {
  installMocks({});
  render(<AthleteSelfProgressInsightsPanel />);

  await waitFor(() => screen.getByText("No sessions recorded in the last 30 days."));
  assert.ok(screen.getByText("No strength benchmarks recorded yet."));
  assert.ok(screen.getByText("No habits tracked yet."));
  assert.ok(screen.getByText("No body-metric entries recorded yet."));
});

test("shows an error message when the fetch fails", async () => {
  installMocks({ insightsFail: true });
  render(<AthleteSelfProgressInsightsPanel />);
  await waitFor(() => screen.getByText("Progress insights could not be loaded. Check your connection and try again."));
});

test("shows adherence percentage and counts when there is sufficient data", async () => {
  installMocks({
    insights: {
      session_adherence: { has_sufficient_data: true, adherence_percentage: 75, completed_sessions: 9, total_sessions: 12 },
      strength_trends: [],
      habit_consistency: [],
      body_metric_trends: []
    }
  });

  render(<AthleteSelfProgressInsightsPanel />);
  await waitFor(() => screen.getByText("75% adherence — 9 of 12 sessions completed in the last 30 days."));
});

test("renders a strength trend card resolving the exercise's real display name from the catalog", async () => {
  installMocks({
    insights: {
      session_adherence: { has_sufficient_data: false },
      strength_trends: [
        {
          exercise_id: "back_squat",
          current_value: 140,
          current_unit: "kg",
          current_effective_date: "2026-01-05",
          has_prior_value: true,
          delta: 5,
          delta_percentage: 3.7,
          prior_effective_date: "2025-12-01"
        }
      ],
      habit_consistency: [],
      body_metric_trends: []
    },
    exercises: [{ exercise_id: "back_squat", display_name: "Back Squat" }]
  });

  render(<AthleteSelfProgressInsightsPanel />);

  await waitFor(() => screen.getByText("Back Squat"));
  assert.ok(screen.getByText("140 kg"));
  assert.match(document.body.textContent ?? "", /\+5 kg \(\+3\.7%\) since/u);
});

test("falls back to a title-cased exercise id when the catalog has no match", async () => {
  installMocks({
    insights: {
      session_adherence: { has_sufficient_data: false },
      strength_trends: [
        {
          exercise_id: "back_squat",
          current_value: 140,
          current_unit: "kg",
          current_effective_date: "2026-01-05",
          has_prior_value: false
        }
      ],
      habit_consistency: [],
      body_metric_trends: []
    },
    exercises: []
  });

  render(<AthleteSelfProgressInsightsPanel />);

  await waitFor(() => screen.getByText("Back Squat"));
  assert.ok(screen.getByText("No prior benchmark to compare yet."));
});

test("renders a habit consistency card with completion rate and streaks", async () => {
  installMocks({
    insights: {
      session_adherence: { has_sufficient_data: false },
      strength_trends: [],
      habit_consistency: [
        {
          habit_label: "Mobility work",
          cadence: "daily",
          completion_rate_percentage: 80,
          window_completions: 24,
          window_expected_units: 30,
          current_streak_length: 5,
          longest_streak_length: 12
        }
      ],
      body_metric_trends: []
    }
  });

  render(<AthleteSelfProgressInsightsPanel />);

  await waitFor(() => screen.getByText("Mobility work"));
  assert.ok(screen.getByText("Daily"));
  assert.match(document.body.textContent ?? "", /80% of expected completions in the last 30 days \(24\/30\)/u);
  assert.match(document.body.textContent ?? "", /Current streak 5 · Longest streak 12/u);
});

test("renders a body-metric trend card using the shared metric label and percent unit suffix", async () => {
  installMocks({
    insights: {
      session_adherence: { has_sufficient_data: false },
      strength_trends: [],
      habit_consistency: [],
      body_metric_trends: [
        {
          metric_type: "body_fat_percentage",
          latest_value: 18,
          unit: "percent",
          latest_effective_date: "2026-01-05",
          has_prior_value: true,
          delta: -1.5,
          delta_percentage: -7.7,
          prior_effective_date: "2025-12-01"
        }
      ]
    }
  });

  render(<AthleteSelfProgressInsightsPanel />);

  await waitFor(() => screen.getByText("Body fat"));
  assert.ok(screen.getByText("18%"));
  assert.match(document.body.textContent ?? "", /-1\.5% \(-7\.7%\) since/u);
});

test("a habit label containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    insights: {
      session_adherence: { has_sufficient_data: false },
      strength_trends: [],
      habit_consistency: [
        {
          habit_label: '<img src=x onerror="window.pwned=true">',
          cadence: "daily",
          completion_rate_percentage: 50,
          window_completions: 1,
          window_expected_units: 2,
          current_streak_length: 1,
          longest_streak_length: 1
        }
      ],
      body_metric_trends: []
    }
  });

  render(<AthleteSelfProgressInsightsPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({});
  render(<AthleteSelfProgressInsightsPanel />);
  await waitFor(() => screen.getByText("No sessions recorded in the last 30 days."));

  installMocks({
    insights: {
      session_adherence: { has_sufficient_data: true, adherence_percentage: 100, completed_sessions: 4, total_sessions: 4 },
      strength_trends: [],
      habit_consistency: [],
      body_metric_trends: []
    }
  });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));
  });

  await waitFor(() => screen.getByText("100% adherence — 4 of 4 sessions completed in the last 30 days."));
});

test("charts a strength trend's series and falls back to a factual empty chart state when no series is present", async () => {
  installMocks({
    insights: {
      session_adherence: { has_sufficient_data: false },
      strength_trends: [
        {
          exercise_id: "back_squat",
          current_value: 140,
          current_unit: "kg",
          current_effective_date: "2026-01-05",
          has_prior_value: true,
          delta: 5,
          delta_percentage: 3.7,
          prior_effective_date: "2025-12-01",
          series: [
            { date: "2025-12-01", value: 135 },
            { date: "2026-01-05", value: 140 }
          ]
        },
        {
          exercise_id: "deadlift",
          current_value: 180,
          current_unit: "kg",
          current_effective_date: "2026-01-05",
          has_prior_value: false
          // no `series` field at all - the panel must not crash on this
        }
      ],
      habit_consistency: [],
      body_metric_trends: []
    },
    exercises: [{ exercise_id: "back_squat", display_name: "Back Squat" }, { exercise_id: "deadlift", display_name: "Deadlift" }]
  });

  render(<AthleteSelfProgressInsightsPanel />);

  await waitFor(() => screen.getByText("Back Squat"));
  const cards = document.querySelectorAll(".record-card");
  assert.equal(cards.length, 2);
  assert.ok(cards[0].querySelector("svg path"), "back_squat card charts its 2-point series");
  assert.ok(cards[1].querySelector(".empty-state.compact-empty"), "deadlift card falls back to the empty chart state with no series");
});

test("charts session adherence over time using the series field, keyed off window_end_date", async () => {
  installMocks({
    insights: {
      session_adherence: {
        has_sufficient_data: true,
        adherence_percentage: 75,
        completed_sessions: 9,
        total_sessions: 12,
        series: [
          { window_end_date: "2025-11-06", adherence_percentage: null, total_sessions: 0 },
          { window_end_date: "2025-12-06", adherence_percentage: 60, total_sessions: 5 },
          { window_end_date: "2026-01-05", adherence_percentage: 75, total_sessions: 12 }
        ]
      },
      strength_trends: [],
      habit_consistency: [],
      body_metric_trends: []
    }
  });

  render(<AthleteSelfProgressInsightsPanel />);
  await waitFor(() => screen.getByText("75% adherence — 9 of 12 sessions completed in the last 30 days."));

  const panel = document.querySelector(".progress-insights-panel") as HTMLElement;
  const path = panel.querySelector("svg path");
  assert.ok(path, "expected an adherence line chart");
  // A null-adherence window (no sessions at all that far back) must be
  // dropped, never charted as a fabricated 0% - so only 2 of the 3 series
  // points become real chart points.
  const dCommands = path?.getAttribute("d")?.split(" ") ?? [];
  assert.equal(dCommands.length, 2, "expected exactly 2 plotted points (the null-adherence window excluded)");
});

test("keeps the three labeled sections (Strength trends, Habit consistency, Body-metric trends) as distinct headings", async () => {
  installMocks({});
  render(<AthleteSelfProgressInsightsPanel />);
  await waitFor(() => screen.getByText("No sessions recorded in the last 30 days."));

  const headings = Array.from(document.querySelectorAll(".progress-insights-section h4")).map((node) => node.textContent);
  assert.deepEqual(headings, ["Strength trends", "Habit consistency", "Body-metric trends"]);
  const panel = document.querySelector(".progress-insights-panel") as HTMLElement;
  assert.ok(within(panel).getByText("Progress insights"));
});
