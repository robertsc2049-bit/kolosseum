import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ReadinessCard } from "../screens/athlete/ReadinessCard";
import { TodayReadiness } from "../screens/athlete/TodayReadiness";

type Options = { actor?: string; scope?: string; onboarded?: boolean; today?: Record<string, unknown> | null; lightening?: Record<string, boolean> };
function installMocks({ actor = "athlete", scope = "coach_managed", onboarded = true, today = null, lightening = { own: false, coach_on: false } }: Options = {}) {
  const saves: Record<string, unknown>[] = [];
  const paths: string[] = [];
  const respond = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    paths.push(path);
    if (path.startsWith("/account/detail")) return respond({ account: { user_id: "athlete_1", actor_type: actor }, csrf_token: "csrf" });
    if (path === "/account/onboarding/") return respond(onboarded ? { current_effective_declaration: { fields: { execution_scope: scope } } } : { current_effective_declaration: null });
    if (path === "/account/onboarding/readiness" && init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      saves.push(body);
      return respond({ today: { date: new Date().toISOString().slice(0, 10), ...body }, low: body.sleep === 1, lightening });
    }
    if (path === "/account/onboarding/readiness") return respond({ today, low: false, lightening });
    return respond({ error: `unhandled_${path}` }, false);
  }) as typeof fetch;
  return { saves, paths };
}

test.afterEach(() => cleanup());

test("the daily check-in is one line on Today; opened, saved and closed, it says it's done", async () => {
  const { saves } = installMocks({ lightening: { own: false, coach_on: true } });
  render(<TodayReadiness />);
  const line = await screen.findByTestId("today-readiness");
  assert.match(line.textContent ?? "", /How are you today\?/u);
  fireEvent.click(line);
  await screen.findByTestId("today-readiness-open");
  for (const label of ["How did you sleep? 1", "How fresh do your muscles feel? 3", "How are stress and energy? 3"]) fireEvent.click(screen.getByLabelText(label));
  await act(async () => { fireEvent.click(screen.getByText("Save check-in")); });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], { sleep: 1, soreness: 3, stress: 3 });
  fireEvent.click(await screen.findByText("Close"));
  assert.match((await screen.findByTestId("today-readiness")).textContent ?? "", /Checked in today.*Today's session will be lighter.*Change/u);
});

test("the copies on Today and in Training details keep in step, and don't share radio buttons", async () => {
  installMocks();
  const { container } = render(<><ReadinessCard /><ReadinessCard compact /></>);
  fireEvent.click(await screen.findByTestId("today-readiness"));
  const todayCard = await screen.findByTestId("today-readiness-open");
  const names = new Set([...container.querySelectorAll("input[type=radio]")].map((input) => (input as HTMLInputElement).name));
  assert.equal(names.size, 6);
  for (const label of ["How did you sleep? 4", "How fresh do your muscles feel? 4", "How are stress and energy? 4"]) fireEvent.click(within(todayCard).getByLabelText(label));
  await act(async () => { fireEvent.click(within(todayCard).getByText("Save check-in")); });
  const full = screen.getByTestId("readiness");
  await within(full).findByText("Saved.");
  assert.equal((within(full).getByLabelText("How did you sleep? 4") as HTMLInputElement).checked, true);
});

test("a self-coached athlete sets the rule in Training details, not on Today", async () => {
  installMocks({ scope: "individual", lightening: { own: true, coach_on: false } });
  render(<TodayReadiness />);
  fireEvent.click(await screen.findByTestId("today-readiness"));
  await screen.findByText("You've chosen to lighten your sessions after a low check-in. Change that in Training details.");
  assert.equal(screen.queryAllByText("Lighten my sessions after a low check-in").length, 0);
  assert.ok(screen.getByText("Your answers are recorded for you."));
});

test("nothing before setup is done, and a coach's account asks for nothing", async () => {
  const before = installMocks({ onboarded: false });
  render(<TodayReadiness />);
  await waitFor(() => assert.ok(before.paths.includes("/account/onboarding/")));
  assert.equal(screen.queryAllByTestId("today-readiness").length, 0);
  cleanup();
  const coach = installMocks({ actor: "coach" });
  render(<TodayReadiness />);
  await waitFor(() => assert.ok(coach.paths.some((path) => path.startsWith("/account/detail"))));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.equal(coach.paths.some((path) => path.startsWith("/account/onboarding")), false);
});

test("left open overnight, yesterday's check-in stops showing as today's", async () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  installMocks({ today: { date: yesterday, sleep: 4, soreness: 4, stress: 4 } });
  render(<ReadinessCard compact />);
  await screen.findByText("Checked in today");
  installMocks();
  document.dispatchEvent(new Event("kolosseum:data-changed")); // past the 1.5s read reuse
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  await screen.findByText("How are you today?");
});
