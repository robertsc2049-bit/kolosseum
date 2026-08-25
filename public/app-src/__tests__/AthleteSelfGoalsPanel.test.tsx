// DEV NOTE: athlete's own goal-setting behavioral proof - replaces the
// source-text regex checks against the now-removed app.js
// renderAthleteGoalMetricLine()/renderAthleteGoalCard()/
// renderAthleteGoalList()/refreshAthleteGoals()/
// updateAthleteGoalTargetValueVisibility()/createAthleteGoal()/
// resolveAthleteGoal() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteSelfGoalsPanel } from "../screens/athlete/AthleteSelfGoalsPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: { goals?: Record<string, unknown>[]; createFails?: boolean }) {
  const { goals = [], createFails = false } = options;
  let currentGoals = goals;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/athlete-goals") && method === "GET") return jsonResponse({ ok: true, goals: currentGoals });
    if (path.match(/\/athlete-goals\/.+\/resolve$/u) && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const goalId = path.split("/")[2];
      currentGoals = currentGoals.map((g) => (g.goal_id === goalId ? { ...g, status: body.resolution } : g));
      return jsonResponse({ ok: true, goal: currentGoals.find((g) => g.goal_id === goalId) });
    }
    if (path.startsWith("/athlete-goals") && method === "POST") {
      if (createFails) return jsonResponse({ error: "athlete_goals_invalid" }, false, 400);
      const body = JSON.parse(String(init?.body ?? "{}"));
      const record = { goal_id: `goal_${currentGoals.length + 1}`, status: "active", ...body };
      currentGoals = [...currentGoals, record];
      return jsonResponse({ ok: true, goal: record }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when no goals are set", async () => {
  installMocks({});
  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("No goals yet."));
});

test("renders a goal card with status badge, and mark achieved/abandon actions only while active", async () => {
  installMocks({
    goals: [
      { goal_id: "goal_1", goal_label: "Run a 5k", status: "active" },
      { goal_id: "goal_2", goal_label: "Deadlift 150kg", status: "achieved" }
    ]
  });

  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("Run a 5k"));

  const cards = document.querySelectorAll(".record-card");
  assert.equal(cards.length, 2);
  assert.ok((cards[0] as HTMLElement).querySelector(".badge.active"));
  assert.ok(Array.from(cards[0].querySelectorAll("button")).some((b) => b.textContent === "Mark achieved"));
  assert.equal((cards[1] as HTMLElement).querySelectorAll("button").length, 0);
  assert.ok((cards[1] as HTMLElement).querySelector(".badge.complete"));
});

test("renders a linked-metric progress line with the shared metric label", async () => {
  installMocks({
    goals: [
      {
        goal_id: "goal_1",
        goal_label: "Lean out",
        status: "active",
        metric_type: "body_fat_percentage",
        target_unit: "percent",
        target_value: 15,
        has_current_value: true,
        current_value: 18,
        progress_percentage: 40,
        is_goal_met: false
      }
    ]
  });

  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("Lean out"));

  assert.match(document.body.textContent ?? "", /Body fat: 18% now, target 15% \(40% of the way there\)\./u);
});

test("shows the no-measurement-yet copy when a linked goal has no recorded value", async () => {
  installMocks({
    goals: [
      {
        goal_id: "goal_1",
        goal_label: "Waist target",
        status: "active",
        metric_type: "waist_circumference_cm",
        target_unit: "cm",
        target_value: 80,
        has_current_value: false
      }
    ]
  });

  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("Waist target"));

  assert.match(document.body.textContent ?? "", /Waist: target 80 cm - no measurement logged yet\./u);
});

test("the target-value field only appears once a linked measurement is chosen", async () => {
  installMocks({});
  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("No goals yet."));

  assert.equal(screen.queryByText("Target value"), null);

  const metricSelect = screen.getByDisplayValue("No linked metric");
  fireEvent.change(metricSelect, { target: { value: "body_weight_kg" } });

  assert.ok(screen.getByText("Target value"));
});

test("blocks submission client-side when the goal label is empty", async () => {
  installMocks({});
  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("No goals yet."));

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => screen.getByText("Enter a goal."));
});

test("blocks submission client-side when a linked metric has no target value", async () => {
  installMocks({});
  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("No goals yet."));

  const labelInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(labelInput, { target: { value: "Run a 5k" } });
  const metricSelect = screen.getByDisplayValue("No linked metric");
  fireEvent.change(metricSelect, { target: { value: "body_weight_kg" } });

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => screen.getByText("Enter a target value for the linked measurement."));
});

test("sets a goal without a linked metric, then resets the form and shows the new entry", async () => {
  installMocks({});
  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("No goals yet."));

  const labelInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(labelInput, { target: { value: "Run a 5k" } });

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => screen.getByText("Run a 5k"));
  assert.equal(labelInput.value, "");
});

test("shows a submit error when the server rejects the goal", async () => {
  installMocks({ createFails: true });
  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("No goals yet."));

  const labelInput = document.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(labelInput, { target: { value: "Run a 5k" } });

  const form = document.querySelector("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });

  await waitFor(() => screen.getByText("Goal could not be set."));
});

test("marking a goal achieved calls the server and updates the badge", async () => {
  installMocks({
    goals: [{ goal_id: "goal_1", goal_label: "Run a 5k", status: "active" }]
  });

  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("Run a 5k"));

  const achieveButton = screen.getByText("Mark achieved");
  await act(async () => {
    achieveButton.click();
  });

  await waitFor(() => {
    assert.ok(document.querySelector(".record-card .badge.complete"));
  });
  assert.equal(document.querySelectorAll(".record-card button").length, 0);
});

test("a goal label containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    goals: [{ goal_id: "goal_1", goal_label: '<img src=x onerror="window.pwned=true">', status: "active" }]
  });

  render(<AthleteSelfGoalsPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({});
  render(<AthleteSelfGoalsPanel />);
  await waitFor(() => screen.getByText("No goals yet."));

  installMocks({ goals: [{ goal_id: "goal_1", goal_label: "Run a 5k", status: "active" }] });

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));
  });

  await waitFor(() => screen.getByText("Run a 5k"));
});
