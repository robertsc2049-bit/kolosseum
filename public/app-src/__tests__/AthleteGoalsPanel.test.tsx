// DEV NOTE: coach_athlete_detail goals mirror behavioral proof - replaces
// the source-text regex checks test/full_ui_37_athlete_goals_surface.test.mjs
// previously ran against the now-removed app.js refreshCoachAthleteGoals
// function for exactly this coach-side capability. The athlete's own
// create/resolve/history view stays legacy and is still covered there.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { AthleteGoalsPanel } from "../screens/coach/AthleteGoalsPanel";

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

async function openPanel(goals: Record<string, unknown>[]) {
  installFetchMock(({ input }) => {
    const path = String(input);
    if (path.startsWith("/athlete-goals/coach/")) return jsonResponse({ goals });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  });

  render(<AthleteGoalsPanel />);

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
  render(<AthleteGoalsPanel />);
  assert.equal(document.body.textContent, "");
});

test("displays an active goal linked to a measurement with computed progress", async () => {
  await openPanel([
    {
      goal_id: "goal_1",
      goal_label: "Hit target bodyweight",
      status: "active",
      metric_type: "body_weight_kg",
      target_value: 80,
      target_unit: "kg",
      has_current_value: true,
      current_value: 82,
      progress_percentage: 60,
      is_goal_met: false,
      target_date: "2026-12-01"
    }
  ]);

  await waitFor(() => screen.getByText("Hit target bodyweight"));

  assert.match(document.body.textContent ?? "", /Active/u);
  assert.match(document.body.textContent ?? "", /Body weight: 82 kg now, target 80 kg \(60% of the way there\)\./u);
  assert.match(document.body.textContent ?? "", /Target date 1 Dec 2026/u);
});

test("displays a goal with no measurement logged yet, and an achieved goal with the target-met note", async () => {
  await openPanel([
    {
      goal_id: "goal_2",
      goal_label: "New habit goal",
      status: "active",
      metric_type: "waist_circumference_cm",
      target_value: 85,
      target_unit: "cm",
      has_current_value: false
    },
    {
      goal_id: "goal_3",
      goal_label: "Hit squat target",
      status: "achieved",
      has_current_value: false
    }
  ]);

  await waitFor(() => screen.getByText("New habit goal"));

  assert.match(document.body.textContent ?? "", /Waist: target 85 cm - no measurement logged yet\./u);
  assert.match(document.body.textContent ?? "", /Achieved/u);
  assert.match(document.body.textContent ?? "", /Hit squat target/u);
});

test("shows a factual empty state when the athlete has no goals yet", async () => {
  await openPanel([]);
  await waitFor(() => screen.getByText("No goals yet."));
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel([{ goal_id: "goal_1", goal_label: "Hit target bodyweight", status: "active", has_current_value: false }]);
  await waitFor(() => screen.getByText("Hit target bodyweight"));

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText("Hit target bodyweight"), null));
});

test("a goal label containing markup is rendered as inert text, never as HTML", async () => {
  await openPanel([
    {
      goal_id: "goal_1",
      goal_label: '<img src=x onerror="window.pwned=true">',
      status: "active",
      has_current_value: false
    }
  ]);

  await waitFor(() => screen.getByText(/img src=x/u));

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});
