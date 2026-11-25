import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TodayWeeklyCheckin } from "../screens/athlete/TodayWeeklyCheckin";

function installMocks(checkins: Record<string, unknown>[], actor = "athlete") {
  const saves: Record<string, unknown>[] = [];
  const paths: string[] = [];
  const respond = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    paths.push(path);
    if (path.startsWith("/account/detail")) return respond({ account: { user_id: "athlete_1", actor_type: actor }, csrf_token: "csrf" });
    if (init?.method === "POST") { saves.push(JSON.parse(String(init.body))); return respond({ ok: true, checkin: {} }); }
    return respond({ ok: true, checkins });
  }) as typeof fetch;
  return { saves, paths };
}
const monday = () => { const now = new Date(); return new Date(now.getTime() - ((now.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10); };

test.afterEach(() => cleanup());

test("this week's check-in is three taps on Today, and goes once it's done", async () => {
  const { saves } = installMocks([{ week_start_date: "2026-01-05" }]);
  render(<TodayWeeklyCheckin />);
  fireEvent.click(await screen.findByTestId("today-weekly-checkin"));
  for (const label of ["Energy this week 2", "Motivation 4", "Sleep 3"]) fireEvent.click(screen.getByLabelText(label));
  await act(async () => { fireEvent.click(screen.getByText("Save check-in")); });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], { week_start_date: monday(), energy_level: 2, motivation_level: 4, sleep_quality: 3 });
  await waitFor(() => assert.equal(screen.queryAllByTestId("today-weekly-checkin").length + screen.queryAllByTestId("today-weekly-checkin-open").length, 0));
});

test("nothing when it's done, and a coach is never asked", async () => {
  const done = installMocks([{ week_start_date: monday() }]);
  render(<TodayWeeklyCheckin />);
  await waitFor(() => assert.ok(done.paths.some((path) => path.startsWith("/weekly-checkins"))));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.equal(screen.queryAllByTestId("today-weekly-checkin").length, 0);
  cleanup();
  const coach = installMocks([], "coach");
  render(<TodayWeeklyCheckin />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.equal(coach.paths.some((path) => path.startsWith("/weekly-checkins")), false);
});
