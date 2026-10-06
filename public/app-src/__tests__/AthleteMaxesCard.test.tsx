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

function installMocks(options: { lifts?: Record<string, unknown>[]; loadingMethod?: string; onSave?: (body: Record<string, unknown>) => Response } = {}) {
  const saves: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/maxes" && method === "GET") return jsonResponse({ preferred_weight_unit: "kg", loading_method: options.loadingMethod ?? "percent_1rm", lifts: options.lifts ?? lifts });
    if (path === "/account/onboarding/maxes" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      saves.push(body);
      if (options.onSave) return options.onSave(body);
      const entered = new Map((body.maxes as Record<string, unknown>[]).map((m) => [m.exercise_id, m]));
      return jsonResponse({ preferred_weight_unit: "kg", loading_method: body.loading_method, lifts: (options.lifts ?? lifts).map((l) => ({ ...l, entered: entered.get(l.exercise_id) ?? null })) });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return saves;
}

test.afterEach(() => cleanup());

test("a beginner's weights build from what they lift - no maxes to enter - and they can switch to % of max", async () => {
  const saves = installMocks({ loadingMethod: "progression" });
  render(<AthleteMaxesCard />);
  await screen.findByText("How your weights are set");
  assert.equal((screen.getByLabelText("Build from what you lift") as HTMLInputElement).checked, true);
  assert.ok(screen.getByText(/make every rep and it goes up a little/u));
  assert.equal(screen.queryByLabelText("Back squat max"), null, "no maxes to fill in for progression");

  fireEvent.click(screen.getByLabelText("% of your max"));
  assert.ok(screen.getByLabelText("Back squat max"), "choosing % of max shows the maxes");
  fireEvent.change(screen.getByLabelText("Back squat max"), { target: { value: "80" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save maxes"));
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.equal(saves[0].loading_method, "percent_1rm");
});

test("RPE is a choice too, saved on its own", async () => {
  const saves = installMocks({ loadingMethod: "progression" });
  render(<AthleteMaxesCard />);
  await screen.findByText("How your weights are set");
  fireEvent.click(screen.getByLabelText("RPE (effort)"));
  await act(async () => {
    fireEvent.click(screen.getByText("Save"));
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.equal(saves[0].loading_method, "rpe");
});

test("she enters a tested squat max and takes her deadlift estimate from training", async () => {
  const saves = installMocks();
  render(<AthleteMaxesCard />);
  await screen.findByText("How your weights are set");
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
    ],
    loading_method: "percent_1rm"
  });
  await screen.findByText("Saved.");
});

test("a max the server refuses is shown on its lift", async () => {
  installMocks({ onSave: () => jsonResponse({ error: "athlete_maxes_invalid", field_errors: { back_squat: "Enter a weight between 0.25 and 1500." } }, false, 422) });
  render(<AthleteMaxesCard />);
  await screen.findByText("How your weights are set");
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

test("a beginner's session reads as a weight to lift and why - never an RPE", () => {
  const first = exerciseDetails({ sets: 3, reps: 5, intensity: { type: "rpe", value: 6 }, load_guidance: { type: "progression", basis: "first_time", reps: 5 } });
  assert.ok(first.includes("First time: pick a weight you can lift for all 5 reps with clean technique - start lighter than you think"), first.join(" | "));
  assert.ok(!first.some((line) => line.includes("RPE")), first.join(" | "));
  const up = exerciseDetails({ sets: 3, reps: 5, intensity: { type: "load", value: 62.5, unit: "kg" }, load_guidance: { type: "progression", basis: "progress", increment: 2.5, unit: "kg", reps: 5 } });
  assert.ok(up.includes("62.5 kg - up 2.5 kg: you made every rep last time"), up.join(" | "));
  const same = exerciseDetails({ sets: 3, reps: 5, intensity: { type: "load", value: 60, unit: "kg" }, load_guidance: { type: "progression", basis: "repeat", unit: "kg", reps: 5 } });
  assert.ok(same.includes("60 kg - same as last time: make every rep and it goes up"), same.join(" | "));
  const down = exerciseDetails({ sets: 3, reps: 5, intensity: { type: "load", value: 55, unit: "kg" }, load_guidance: { type: "progression", basis: "deload", unit: "kg", reps: 5 } });
  assert.ok(down.includes("55 kg - 10% lighter after two sessions short of the reps"), down.join(" | "));
});

test("a row the programme set at RPE 8 keeps the effort target, with a weight to start at and where it came from", () => {
  assert.ok(exerciseDetails({ sets: 4, reps: 8, intensity: { type: "rpe", value: 8 }, starting_load: { value: 67.5, unit: "kg", basis: "last_session" } })
    .includes("RPE 8 · start around 67.5 kg (last time)"));
  assert.ok(exerciseDetails({ sets: 4, reps: 8, intensity: { type: "rpe", value: 8 }, starting_load: { value: 60, unit: "kg", basis: "max" } })
    .includes("RPE 8 · start around 60 kg (from your max)"));
  assert.ok(exerciseDetails({ sets: 4, reps: 8, intensity: { type: "rpe", value: 8 } }).includes("RPE 8"));
});
