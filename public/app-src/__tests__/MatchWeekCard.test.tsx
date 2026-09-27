import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MatchWeekCard } from "../screens/athlete/MatchWeekCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(initial: Record<string, unknown> = { match_days: [], fixtures: [] }, onSave?: (body: Record<string, unknown>) => Response) {
  const saves: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/match-week" && method === "GET") return jsonResponse(initial);
    if (path === "/account/onboarding/match-week" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      saves.push(body);
      return onSave ? onSave(body) : jsonResponse(body);
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return saves;
}

test.afterEach(() => cleanup());

test("a rugby player sets Saturday as match day and adds a midweek cup tie", async () => {
  const saves = installMocks();
  render(<MatchWeekCard />);
  await screen.findByText("Matches, races and key sessions");
  assert.ok(screen.getByText(/short primer with no heavy leg work/u));
  fireEvent.click(screen.getByLabelText("Sat"));
  fireEvent.change(screen.getByLabelText("Fixture date"), { target: { value: "2026-10-07" } });
  fireEvent.change(screen.getByLabelText("Fixture name"), { target: { value: "Cup tie" } });
  fireEvent.click(screen.getByText("Add fixture"));
  assert.ok(screen.getByText("2026-10-07 - Cup tie"));
  await act(async () => {
    fireEvent.click(screen.getByText("Save match week"));
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], { match_days: ["sat"], fixtures: [{ date: "2026-10-07", label: "Cup tie" }] });
  await screen.findByText("Your match week is saved.");
});

test("saved fixtures can be removed, and a failed save says so", async () => {
  installMocks({ match_days: ["sat"], fixtures: [{ date: "2026-10-07", label: "Cup tie" }] }, () => jsonResponse({ error: "match_week_invalid" }, false, 422));
  render(<MatchWeekCard />);
  await screen.findByText("2026-10-07 - Cup tie");
  assert.equal((screen.getByLabelText("Sat") as HTMLInputElement).checked, true);
  fireEvent.click(screen.getByText("Remove"));
  assert.ok(screen.getByText("No one-off fixtures."));
  await act(async () => {
    fireEvent.click(screen.getByText("Save match week"));
  });
  await screen.findByText("Your match week could not be saved. Check the dates and try again.");
});
