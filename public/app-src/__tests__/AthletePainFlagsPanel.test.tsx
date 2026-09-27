import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthletePainFlagsPanel } from "../screens/coach/AthletePainFlagsPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const kneeFlag = {
  flag_key: "area:knee",
  area: "knee",
  where: "your knee",
  reported_exercises: [{ exercise_id: "back_squat", display_name: "Back squat" }],
  first_reported_at: "2026-09-24T10:00:00.000Z",
  last_reported_at: "2026-09-24T10:00:00.000Z",
  latest_check_in: { status: "still_sore", plan: "skip", at: "2026-09-25T09:00:00.000Z" },
  check_in_due: false
};

function installMocks(options: { flags: Record<string, unknown>[] }) {
  const clears: Array<{ path: string; body: Record<string, unknown> }> = [];
  let flags = options.flags;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/pain-flags/coach/athlete_1" && method === "GET") return jsonResponse({ flags });
    if (path === "/pain-flags/coach/athlete_1/clear" && method === "POST") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      clears.push({ path, body });
      flags = [];
      return jsonResponse({ flags });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return clears;
}

async function openAthlete() {
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-opened", { detail: { athlete_user_id: "athlete_1" } }));
  });
}

test.afterEach(() => cleanup());

test("nothing is shown until an athlete's profile is open", () => {
  installMocks({ flags: [kneeFlag] });
  render(<AthletePainFlagsPanel />);
  assert.equal(screen.queryByTestId("athlete-pain-flags"), null);
});

test("the coach sees where it hurts, since when, during what, and the latest check-in", async () => {
  installMocks({ flags: [kneeFlag] });
  render(<AthletePainFlagsPanel />);
  await openAthlete();
  await screen.findByText("Pain in knee");
  assert.ok(screen.getByText("Open"));
  assert.match(screen.getByText(/during Back squat/u).textContent ?? "", /Reported/u);
  assert.match(screen.getByText(/Latest check-in:/u).textContent ?? "", /Still sore .* leaving out those exercises/u);
});

test("clearing a flag posts it and the flag disappears", async () => {
  const clears = installMocks({ flags: [kneeFlag] });
  render(<AthletePainFlagsPanel />);
  await openAthlete();
  await screen.findByText("Pain in knee");
  await act(async () => {
    fireEvent.click(screen.getByText("Clear flag"));
  });
  await waitFor(() => assert.equal(clears.length, 1));
  assert.deepEqual(clears[0].body, { flag_key: "area:knee" });
  await screen.findByText("No open pain flags.");
});

test("an athlete with no open flags says so", async () => {
  installMocks({ flags: [] });
  render(<AthletePainFlagsPanel />);
  await openAthlete();
  await screen.findByText("No open pain flags.");
});
