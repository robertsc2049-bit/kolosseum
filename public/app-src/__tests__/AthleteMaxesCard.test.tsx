import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteMaxesCard } from "../screens/athlete/AthleteMaxesCard";
import { exerciseDetails } from "../utils/format";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const lifts = [
  { exercise_id: "back_squat", display_name: "Back squat", in_programme: true, entered: null, from_training: null },
  { exercise_id: "deadlift", display_name: "Deadlift", in_programme: true, entered: null, from_training: { value: 198, unit: "kg", date: "2026-09-26" } }
];

function installMocks(options: { lifts?: Record<string, unknown>[]; onSave?: (body: Record<string, unknown>) => Response } = {}) {
  const saves: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/maxes" && method === "GET") return jsonResponse({ preferred_weight_unit: "kg", lifts: options.lifts ?? lifts });
    if (path === "/account/onboarding/maxes" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      saves.push(body);
      if (options.onSave) return options.onSave(body);
      const entered = new Map((body.maxes as Record<string, unknown>[]).map((m) => [m.exercise_id, m]));
      return jsonResponse({ preferred_weight_unit: "kg", lifts: (options.lifts ?? lifts).map((l) => ({ ...l, entered: entered.get(l.exercise_id) ?? null })) });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return saves;
}

test.afterEach(() => cleanup());

test("a lifter with no % of 1RM lifts (e.g. a beginner on RPE targets) sees no maxes card", async () => {
  installMocks({ lifts: [] });
  render(<AthleteMaxesCard />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  assert.equal(screen.queryByTestId("athlete-maxes"), null);
});

test("she enters a tested squat max and takes her deadlift estimate from training", async () => {
  const saves = installMocks();
  render(<AthleteMaxesCard />);
  await screen.findByText("Maxes for your % of 1RM lifts");
  assert.ok(screen.getByText(/From your training: 198 kg estimated max/u));
  fireEvent.change(screen.getByLabelText("Back squat max"), { target: { value: "150" } });
  fireEvent.click(screen.getByText("Use this"));
  assert.equal((screen.getByLabelText("Deadlift max") as HTMLInputElement).value, "198");
  assert.equal((screen.getByLabelText("Deadlift source") as HTMLSelectElement).value, "estimated_1rm");
  await act(async () => {
    fireEvent.click(screen.getByText("Save maxes"));
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], {
    preferred_weight_unit: "kg",
    maxes: [
      { exercise_id: "back_squat", value: 150, unit: "kg", basis: "tested_1rm" },
      { exercise_id: "deadlift", value: 198, unit: "kg", basis: "estimated_1rm" }
    ]
  });
  await screen.findByText("Your maxes are saved.");
});

test("a max the server refuses is shown on its lift", async () => {
  installMocks({ onSave: () => jsonResponse({ error: "athlete_maxes_invalid", field_errors: { back_squat: "Enter a weight between 0.25 and 1500." } }, false, 422) });
  render(<AthleteMaxesCard />);
  await screen.findByText("Maxes for your % of 1RM lifts");
  fireEvent.change(screen.getByLabelText("Back squat max"), { target: { value: "0" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save maxes"));
  });
  await screen.findByText("Enter a weight between 0.25 and 1500.");
});

test("a % of 1RM exercise with no max recorded shows an RPE target, and a resolved one shows the weight", () => {
  const noMax = exerciseDetails({ sets: 5, rep_range: { minimum: 5, maximum: 5 }, intensity: { type: "percent_1rm", value: 77.5 }, load_guidance: { type: "rpe", value: 7, reason: "no_max_recorded" } });
  assert.ok(noMax.includes("No max recorded - choose a weight at about RPE 7"), noMax.join(" | "));
  assert.ok(!noMax.includes("77.5% 1RM"));
  const resolved = exerciseDetails({ sets: 5, intensity: { type: "percent_1rm", value: 77.5 }, resolved_load: { value: 115, unit: "kg" } });
  assert.ok(resolved.includes("77.5% 1RM · 115 kg"), resolved.join(" | "));
});
