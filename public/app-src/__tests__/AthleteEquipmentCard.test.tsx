import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteEquipmentCard } from "../screens/athlete/AthleteEquipmentCard";
import { exerciseName } from "../utils/format";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const options = ["barbell", "rack", "bench", "plate", "dumbbell", "pull_up_bar", "resistance_band", "kettlebell", "yoke", "sled"]
  .map((id) => ({ equipment_id: id, display_name: id.replaceAll("_", " ") }));

function installMocks(initial: Record<string, unknown> = { full_gym: true, available_equipment: [], options }) {
  const saves: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/equipment" && method === "GET") return jsonResponse(initial);
    if (path === "/account/onboarding/equipment" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      saves.push(body);
      return jsonResponse({ full_gym: body.full_gym === true, available_equipment: body.available_equipment ?? [], options });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return saves;
}

test.afterEach(() => cleanup());

test("a full gym is assumed until the athlete says otherwise", async () => {
  installMocks();
  render(<AthleteEquipmentCard />);
  await screen.findByText("What can you train with?");
  assert.equal((screen.getByLabelText("I train in a full gym (everything available)") as HTMLInputElement).checked, true);
  assert.equal(screen.queryByText("Equipment I have"), null);
});

test("a strongman training at home picks the home-gym set and saves it", async () => {
  const saves = installMocks();
  render(<AthleteEquipmentCard />);
  await screen.findByText("What can you train with?");
  fireEvent.click(screen.getByLabelText("I train in a full gym (everything available)"));
  fireEvent.click(screen.getByText("Home gym"));
  assert.equal((screen.getByLabelText("barbell") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("yoke") as HTMLInputElement).checked, false);
  fireEvent.click(screen.getByLabelText("kettlebell"));
  await act(async () => {
    fireEvent.click(screen.getByText("Save equipment"));
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], { available_equipment: ["barbell", "rack", "bench", "plate", "dumbbell", "pull_up_bar", "resistance_band", "kettlebell"] });
  await screen.findByText("Your equipment is saved.");
});

test("a substitute keeps its own name, so the session shows what to actually do", () => {
  assert.equal(exerciseName({ exercise_id: "overhead_press", display_name: "Overhead press", equipment_swap: { from_display_name: "Strongman log press", missing: ["Strongman log"] } }), "Overhead press");
});
