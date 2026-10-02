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
  assert.equal((screen.getByLabelText("Full gym") as HTMLInputElement).checked, true);
  assert.ok(screen.getByText("Everything is available."));
  assert.equal(screen.queryByText("Free weights"), null, "no equipment list for a full gym");
});

test("a strongman training at home picks the home-gym set and saves it", async () => {
  const saves = installMocks();
  render(<AthleteEquipmentCard />);
  await screen.findByText("What can you train with?");
  fireEvent.click(screen.getByLabelText("Home gym"));
  assert.ok(screen.getByText("Free weights") && screen.getByText("Strongman and sleds"), "grouped the way a gym is laid out");
  assert.equal((screen.getByLabelText("barbell") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("yoke") as HTMLInputElement).checked, false);
  fireEvent.click(screen.getByLabelText("kettlebell"));
  assert.equal((screen.getByLabelText("Choose my own") as HTMLInputElement).checked, true, "adding to the home set makes it their own");
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
