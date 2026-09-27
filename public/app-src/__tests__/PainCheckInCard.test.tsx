import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PainCheckInCard } from "../screens/athlete/PainCheckInCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

// Her elbow hurt during the paused bench on 24 Sep.
function elbowFlag(overrides: Record<string, unknown> = {}) {
  return {
    flag_key: "area:elbow",
    area: "elbow",
    where: "your elbow",
    reported_exercises: [{ exercise_id: "paused_bench_press", display_name: "Paused bench press" }],
    first_reported_at: "2026-09-24T10:00:00.000Z",
    last_reported_at: "2026-09-24T10:00:00.000Z",
    latest_check_in: null,
    check_in_due: true,
    ...overrides
  };
}

function installMocks(options: { flags: Record<string, unknown>[]; onCheckIn?: (body: Record<string, unknown>) => Response }) {
  const checkIns: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/pain-flags" && method === "GET") return jsonResponse({ flags: options.flags });
    if (path === "/account/onboarding/pain-flags/check-in" && method === "POST") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      checkIns.push(body);
      return options.onCheckIn ? options.onCheckIn(body) : jsonResponse({ flags: [] });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return checkIns;
}

test.afterEach(() => cleanup());

test("nothing is shown when no pain flag is open", async () => {
  installMocks({ flags: [] });
  render(<PainCheckInCard />);
  await waitFor(() => assert.equal(screen.queryByTestId("pain-check-in"), null));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  assert.equal(screen.queryByTestId("pain-check-in"), null);
});

test("an open flag asks how it is now, with no diagnosis or advice beyond seeing a professional", async () => {
  installMocks({ flags: [elbowFlag()] });
  render(<PainCheckInCard />);
  await screen.findByText("Pain in your elbow");
  assert.ok(screen.getByText("How is it now?"));
  assert.match(screen.getByText(/Reported .* during Paused bench press\./u).textContent ?? "", /Paused bench press/u);
  assert.ok(screen.getByText(/doesn't diagnose or give treatment advice/u));
  assert.ok(screen.getByText("Pain-free now"));
  assert.ok(screen.getByText("Still sore"));
});

test("pain-free closes the flag", async () => {
  const checkIns = installMocks({ flags: [elbowFlag()] });
  render(<PainCheckInCard />);
  await screen.findByText("Pain in your elbow");
  await act(async () => {
    fireEvent.click(screen.getByText("Pain-free now"));
  });
  await waitFor(() => assert.equal(checkIns.length, 1));
  assert.deepEqual(checkIns[0], { flag_key: "area:elbow", status: "pain_free" });
  await screen.findByText("Glad it's better - your sessions are back to normal.");
  assert.equal(screen.queryByText("Pain in your elbow"), null);
});

test("still sore asks what to do for the next session: swap those exercises or leave them out", async () => {
  const checkIns = installMocks({
    flags: [elbowFlag()],
    onCheckIn: (body) => jsonResponse({ flags: [elbowFlag({ check_in_due: false, latest_check_in: { status: "still_sore", plan: body.plan, at: "2026-09-25T09:00:00.000Z" } })] })
  });
  render(<PainCheckInCard />);
  await screen.findByText("Pain in your elbow");
  fireEvent.click(screen.getByText("Still sore"));
  assert.ok(screen.getByText("For your next session:"));
  await act(async () => {
    fireEvent.click(screen.getByText("Swap those exercises"));
  });
  await waitFor(() => assert.equal(checkIns.length, 1));
  assert.deepEqual(checkIns[0], { flag_key: "area:elbow", status: "still_sore", plan: "swap" });
  await screen.findByText("Still sore - your next session swaps those exercises for ones that don't load it.");
  assert.ok(screen.getByText("Thanks - your next session is adjusted."));
});

test("a check-in that can't be saved says so", async () => {
  installMocks({ flags: [elbowFlag()], onCheckIn: () => jsonResponse({ error: "boom" }, false, 500) });
  render(<PainCheckInCard />);
  await screen.findByText("Pain in your elbow");
  fireEvent.click(screen.getByText("Still sore"));
  await act(async () => {
    fireEvent.click(screen.getByText("Leave them out"));
  });
  await screen.findByText("Your check-in could not be saved. Try again.");
  assert.ok(screen.getByText("Pain in your elbow"), "the flag stays open");
});
