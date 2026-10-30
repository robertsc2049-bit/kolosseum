// The gyms a coach works out of: a gym on Kolosseum waits for the gym to
// confirm; one that isn't on Kolosseum yet is typed in and linked once it
// joins.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CoachGymsPanel } from "../screens/account/CoachGymsPanel";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

type Call = { method: string; path: string; body: Record<string, unknown> | null };

function installMocks(gyms: Record<string, unknown>[], options: { search?: Record<string, unknown>[]; addFails?: string } = {}) {
  const calls: Call[] = [];
  let current = gyms;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/coach-branding/gyms/search")) return jsonResponse({ ok: true, gyms: options.search ?? [] });
    if (path === "/coach-branding/gyms" && method === "POST") {
      if (options.addFails) return jsonResponse({ ok: false, error: options.addFails }, 409);
      current = [...current, { coach_gym_id: "cgym_new", org_id: body?.org_id ?? null, gym_name: body?.gym_name ?? "Iron Temple", area: body?.area ?? "Leeds", link_status: body?.org_id ? "pending" : "unlisted", now_on_kolosseum: [] }];
      return jsonResponse({ ok: true, max_gyms: 5, gyms: current }, 201);
    }
    if (path.endsWith("/link") && method === "POST") {
      current = current.map((gym) => (path.includes(String(gym.coach_gym_id)) ? { ...gym, org_id: body?.org_id, link_status: "pending", now_on_kolosseum: [] } : gym));
      return jsonResponse({ ok: true, max_gyms: 5, gyms: current });
    }
    if (method === "DELETE") {
      current = current.filter((gym) => !path.endsWith(String(gym.coach_gym_id)));
      return jsonResponse({ ok: true, max_gyms: 5, gyms: current });
    }
    if (path === "/coach-branding/gyms") return jsonResponse({ ok: true, max_gyms: 5, gyms: current });
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => cleanup());

test("lists the coach's gyms with where each link stands", async () => {
  installMocks([
    { coach_gym_id: "g1", org_id: "org_1", gym_name: "Iron Temple", area: "Leeds", link_status: "pending", now_on_kolosseum: [] },
    { coach_gym_id: "g2", org_id: null, gym_name: "Garage Gym", area: "", link_status: "unlisted", now_on_kolosseum: [] }
  ]);
  render(<CoachGymsPanel />);
  await screen.findByText("Iron Temple, Leeds");
  screen.getByText("Waiting for the gym to confirm");
  screen.getByText("Garage Gym");
  screen.getByText("Not on Kolosseum yet");
});

test("a typed-in gym that's now on Kolosseum can be linked in one tap", async () => {
  const calls = installMocks([
    { coach_gym_id: "g2", org_id: null, gym_name: "Iron Temple", area: "Leeds", link_status: "unlisted", now_on_kolosseum: [{ org_id: "org_1", display_name: "Iron Temple", area: "Leeds" }] }
  ]);
  render(<CoachGymsPanel />);
  await screen.findByText(/is now on Kolosseum/u);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Link it" }));
  });
  await screen.findByText("Waiting for the gym to confirm");
  const link = calls.find((call) => call.path.endsWith("/link"));
  assert.deepEqual(link?.body, { org_id: "org_1" });
});

test("finds a gym on Kolosseum and adds it, or types one in that isn't", async () => {
  const calls = installMocks([], { search: [{ org_id: "org_1", display_name: "Iron Temple", area: "Leeds" }] });
  render(<CoachGymsPanel />);
  await screen.findByText("No gyms yet.");

  fireEvent.change(screen.getByPlaceholderText("Gym name or town"), { target: { value: "iron" } });
  await act(async () => {
    fireEvent.submit(screen.getByPlaceholderText("Gym name or town").closest("form") as HTMLFormElement);
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
  });
  await screen.findByText("Waiting for the gym to confirm");
  assert.deepEqual(calls.find((call) => call.method === "POST" && call.path === "/coach-branding/gyms")?.body, { org_id: "org_1" });

  fireEvent.change(screen.getByLabelText("Gym name"), { target: { value: "Garage Gym" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add gym" }));
  });
  await screen.findByText("Not on Kolosseum yet");
  assert.deepEqual(calls.filter((call) => call.method === "POST" && call.path === "/coach-branding/gyms")[1]?.body, { gym_name: "Garage Gym", area: "" });
});

test("shows a plain message when the coach has hit the limit", async () => {
  installMocks([], { addFails: "coach_gym_limit_reached" });
  render(<CoachGymsPanel />);
  await screen.findByText("No gyms yet.");
  fireEvent.change(screen.getByLabelText("Gym name"), { target: { value: "Sixth Gym" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add gym" }));
  });
  await waitFor(() => screen.getByText("You can list up to 5 gyms - remove one first."));
});
