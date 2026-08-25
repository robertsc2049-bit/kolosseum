// DEV NOTE: coach_athlete_detail nutrition mirror behavioral proof -
// replaces the source-text regex checks
// test/full_ui_29_body_metrics_habits_surface.test.mjs previously ran
// against the removed #athleteDetailNutritionSummary DOM id for exactly
// this coach-side capability. renderNutritionSummary/
// groupNutritionEntriesByDate stay in app.js for the athlete's own view
// and are still covered there.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteNutritionPanel } from "../screens/coach/AthleteNutritionPanel";

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

async function openPanel(entries: Record<string, unknown>[]) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/body-metrics/coach/")) return jsonResponse({ entries });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteNutritionPanel />);

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
  render(<AthleteNutritionPanel />);
  assert.equal(document.body.textContent, "");
});

test("groups nutrition entries by day and excludes non-nutrition body-metric types", async () => {
  await openPanel([
    { metric_type: "calories_kcal", value: 2200, effective_date: "2026-08-20" },
    { metric_type: "protein_g", value: 150, effective_date: "2026-08-20" },
    { metric_type: "carbs_g", value: 220, effective_date: "2026-08-19" },
    { metric_type: "waist_circumference_cm", value: 82, effective_date: "2026-08-20" }
  ]);

  await waitFor(() => screen.getByText(/Calories 2200 kcal/u));

  assert.match(document.body.textContent ?? "", /Calories 2200 kcal · Protein 150g/u);
  assert.match(document.body.textContent ?? "", /Carbs 220g/u);
  assert.doesNotMatch(document.body.textContent ?? "", /Waist/u);
});

test("keeps only the most recently logged value per metric type per day", async () => {
  await openPanel([
    { metric_type: "calories_kcal", value: 2300, effective_date: "2026-08-20" },
    { metric_type: "calories_kcal", value: 2200, effective_date: "2026-08-20" }
  ]);

  await waitFor(() => screen.getByText(/Calories 2300 kcal/u));
  assert.doesNotMatch(document.body.textContent ?? "", /2200/u);
});

test("shows a factual empty state when the athlete has no nutrition entries yet", async () => {
  await openPanel([]);
  await waitFor(() => screen.getByText("No nutrition entries yet."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel([{ metric_type: "calories_kcal", value: 2200, effective_date: "2026-08-20" }]);
  await waitFor(() => screen.getByText(/Calories 2200 kcal/u));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText(/Calories 2200 kcal/u), null));
});
