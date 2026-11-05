// The coach's own rule for one athlete: off by default, switched on here,
// saved for that athlete only.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteReadinessLightening } from "../screens/coach/AthleteReadinessLightening";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(enabled = false, failSave = false) {
  const puts: Array<{ path: string; body: unknown }> = [];
  let current = enabled;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/coach-workspace/athletes/athlete_eve/readiness-lightening" && method === "GET") return jsonResponse({ athlete_user_id: "athlete_eve", enabled: current });
    if (path === "/coach-workspace/athletes/athlete_eve/readiness-lightening" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      puts.push({ path, body });
      if (failSave) return jsonResponse({ ok: false, error: "relationship_access_denied" }, false, 403);
      current = body.enabled === true;
      return jsonResponse({ athlete_user_id: "athlete_eve", enabled: current });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return puts;
}

test.afterEach(() => cleanup());

test("a coach turns on lightening after a low check-in for Eve only, with what it does spelt out", async () => {
  const puts = installMocks();
  render(<AthleteReadinessLightening athleteUserId="athlete_eve" />);
  const box = (await screen.findByLabelText("Lighten sessions after a low check-in")) as HTMLInputElement;
  assert.equal(box.checked, false, "off by default");
  assert.match(screen.getByTestId("coach-readiness-lightening").textContent ?? "", /takes one set off each exercise .* lowers it by 5% of max or 1 RPE/);
  await act(async () => {
    fireEvent.click(box);
  });
  await waitFor(() => assert.deepEqual(puts, [{ path: "/coach-workspace/athletes/athlete_eve/readiness-lightening", body: { enabled: true } }]));
  await waitFor(() => assert.equal((screen.getByLabelText("Lighten sessions after a low check-in") as HTMLInputElement).checked, true));
});

test("a failed save says so and leaves the switch as it was", async () => {
  installMocks(false, true);
  render(<AthleteReadinessLightening athleteUserId="athlete_eve" />);
  const box = (await screen.findByLabelText("Lighten sessions after a low check-in")) as HTMLInputElement;
  await act(async () => {
    fireEvent.click(box);
  });
  await screen.findByText("Your choice could not be saved. Try again.");
  assert.equal((screen.getByLabelText("Lighten sessions after a low check-in") as HTMLInputElement).checked, false);
});
