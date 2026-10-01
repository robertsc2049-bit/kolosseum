import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { WeightClassCard, isCombatActivity } from "../screens/athlete/WeightClassCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

test.afterEach(() => cleanup());

test("a lightweight boxer declares a 63.5 kg class; the card says there is no weight-cut advice", async () => {
  const puts: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "a1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/weight-class" && init?.method === "PUT") {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      puts.push(body);
      return jsonResponse(body);
    }
    if (path === "/account/onboarding/weight-class") return jsonResponse({ competes_at_weight_class: false, weight_class_kg: null });
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  render(<WeightClassCard />);
  await screen.findByText("Weight class");
  assert.ok(screen.getByText(/Kolosseum gives no weight-cutting advice/u));
  await act(async () => {
    fireEvent.click(screen.getByLabelText("I compete at a weight class"));
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Weight class (kg, optional)"), { target: { value: "63.5" } });
  });
  await act(async () => {
    fireEvent.click(screen.getByText("Save weight class"));
  });
  await waitFor(() => screen.getByText("Saved."));
  assert.deepEqual(puts, [{ competes_at_weight_class: true, weight_class_kg: 63.5 }]);
  assert.equal(isCombatActivity("judo"), true);
  assert.equal(isCombatActivity("powerlifting"), false);
});
