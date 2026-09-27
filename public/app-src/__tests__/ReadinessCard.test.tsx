import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ReadinessCard } from "../screens/athlete/ReadinessCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(initial: Record<string, unknown> = { today: null, low: false }) {
  const saves: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/readiness" && method === "GET") return jsonResponse(initial);
    if (path === "/account/onboarding/readiness" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      saves.push(body);
      const low = [body.sleep, body.soreness, body.stress].includes(1) || body.sleep + body.soreness + body.stress <= 7;
      return jsonResponse({ today: { date: "2026-09-27", ...body }, low });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return saves;
}

test.afterEach(() => cleanup());

test("after a bad night she answers the three questions and is told today's session will be lighter", async () => {
  const saves = installMocks();
  render(<ReadinessCard />);
  await screen.findByText("How are you today? (optional)");
  const save = screen.getByText("Save check-in") as HTMLButtonElement;
  assert.equal(save.disabled, true, "all three answers needed");
  fireEvent.click(screen.getByLabelText("How did you sleep? 1"));
  fireEvent.click(screen.getByLabelText("How fresh do your muscles feel? 3"));
  fireEvent.click(screen.getByLabelText("How are stress and energy? 3"));
  await act(async () => {
    fireEvent.click(save);
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], { sleep: 1, soreness: 3, stress: 3 });
  await screen.findByText("Saved - today's session will be lighter.");
});

test("a saved good day says to train as planned", async () => {
  installMocks({ today: { date: "2026-09-27", sleep: 4, soreness: 4, stress: 4 }, low: false });
  render(<ReadinessCard />);
  await screen.findByText("Saved - train as planned.");
  assert.equal((screen.getByLabelText("How did you sleep? 4") as HTMLInputElement).checked, true);
});
