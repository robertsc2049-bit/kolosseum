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

test("a lifter finds their gym, it becomes their main gym, and their own list becomes home kit", async () => {
  const gymSaves: Record<string, unknown>[] = [];
  const ironworks = { org_id: "org_ironworks", display_name: "Ironworks", area: "Leeds", equipment_count: 3 };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/equipment") return jsonResponse({ full_gym: true, available_equipment: [], gyms: [], main_gym: null, options });
    if (path === "/account/onboarding/gyms/search?q=leeds") return jsonResponse({ ok: true, gyms: [ironworks] });
    if (path === "/account/onboarding/gyms" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      gymSaves.push(body);
      return jsonResponse({
        full_gym: false, available_equipment: [], options,
        gyms: [{ ...ironworks, listed: true }],
        main_gym: { org_id: "org_ironworks", display_name: "Ironworks", equipment: ["barbell", "rack", "bench"] }
      });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  render(<AthleteEquipmentCard />);
  await screen.findByText("Your gyms");
  fireEvent.change(screen.getByLabelText("Find a gym by name or town"), { target: { value: "leeds" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Search"));
  });
  await screen.findByText("Ironworks, Leeds");
  await act(async () => {
    fireEvent.click(screen.getByText("Add"));
  });
  await waitFor(() => assert.equal(gymSaves.length, 1));
  assert.deepEqual(gymSaves[0], { gym_org_ids: ["org_ironworks"], main_org_id: "org_ironworks" }, "the first gym is the main gym");
  await screen.findByText("Ironworks, Leeds - main gym");
  assert.ok(screen.getByText("The 3 pieces of kit listed at Ironworks count as yours. Add your home kit below - anything you have away from the gym."));
  assert.equal(screen.queryByLabelText("Full gym"), null, "no full-gym choice with a main gym");
  assert.ok(screen.getByText("Save home kit"));
});

test("an athlete sees the coaches their gym confirmed and asks one to coach them", async () => {
  const requests: Record<string, unknown>[] = [];
  const gyms = [{
    org_id: "org_1", display_name: "Forge", area: "York", equipment_count: 2, listed: true,
    coaches: [{ coach_gym_id: "cgym_1", display_name: "Chris Roberts", business_name: "Old Tyme Strength", asked: false }]
  }];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/equipment") return jsonResponse({ full_gym: false, available_equipment: [], options, gyms, main_gym: { org_id: "org_1", display_name: "Forge", equipment: ["barbell", "rack"] } });
    if (path === "/account/onboarding/coaching-requests") {
      requests.push(JSON.parse(String(init?.body)));
      return jsonResponse({ ok: true, request_id: "creq_1" }, true, 201);
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;

  render(<AthleteEquipmentCard />);
  await screen.findByText("Chris Roberts · Old Tyme Strength");
  fireEvent.click(screen.getByRole("button", { name: "Ask to coach me" }));
  fireEvent.change(screen.getByPlaceholderText("A line about you and your goals (optional)"), { target: { value: "Competing in spring." } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
  await screen.findByText("Asked - they'll invite you if they can take you on");
  assert.deepEqual(requests, [{ coach_gym_id: "cgym_1", note: "Competing in spring." }]);
});
