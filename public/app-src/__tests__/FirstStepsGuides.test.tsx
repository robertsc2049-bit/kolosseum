// First-steps guides: a coach's first programme on Overview and a
// self-training athlete's setup on Today. Steps tick off from real data,
// the next step is highlighted, buttons go where the step is done, the
// guide can be hidden, and it goes once everything's done.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AthleteFirstStepsGuide } from "../screens/athlete/AthleteFirstStepsGuide";
import { CoachFirstProgrammeGuide } from "../screens/coach/CoachFirstProgrammeGuide";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

type Data = Record<string, unknown>;

function installFetch(actor: "coach" | "athlete", data: Data) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "u1", actor_type: actor }, csrf_token: "csrf" });
    for (const [prefix, body] of Object.entries(data)) if (path.startsWith(prefix)) return jsonResponse(body);
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function coachData(templates: Data[], relationships: Data[], assignments: Data[]): Data {
  return {
    "/templates?": { templates },
    "/templates": { templates },
    "/coach-workspace/relationships": { relationships },
    "/coach-workspace/assignments": { assignments }
  };
}

test("a brand-new coach is pointed at Quick build first", async () => {
  installFetch("coach", coachData([], [], []));
  let opened = 0;
  const onOpen = () => { opened += 1; };
  document.addEventListener("kolosseum:open-quick-build", onOpen);
  render(<CoachFirstProgrammeGuide />);
  await screen.findByText("Your first programme");
  screen.getByText("0 of 4 done");
  const current = document.querySelector("[aria-current=step]");
  assert.match(current?.textContent ?? "", /Build a programme/u);
  fireEvent.click(screen.getByRole("button", { name: "Quick build" }));
  document.removeEventListener("kolosseum:open-quick-build", onOpen);
  assert.equal(opened, 1);
});

test("with a draft built, the next step opens that draft", async () => {
  installFetch("coach", coachData([{ template_id: "tpl_1", template_status: "draft", updated_at_iso8601: "2026-11-01T10:00:00Z" }], [], []));
  const opened: string[] = [];
  const onOpen = (event: Event) => opened.push(String(((event as CustomEvent).detail as { template_id: string }).template_id));
  document.addEventListener("kolosseum:open-programme-detail", onOpen);
  render(<CoachFirstProgrammeGuide />);
  await screen.findByText("1 of 4 done");
  assert.match(document.querySelector("[aria-current=step]")?.textContent ?? "", /Check it and make it ready to send/u);
  fireEvent.click(screen.getByRole("button", { name: "Open my draft" }));
  document.removeEventListener("kolosseum:open-programme-detail", onOpen);
  assert.deepEqual(opened, ["tpl_1"]);
});

test("the coach guide goes once a programme is assigned, and stays hidden once hidden", async () => {
  installFetch("coach", coachData([{ template_id: "tpl_1", template_status: "active" }], [{ relationship_state: "accepted" }], [{ assignment_id: "a1" }]));
  render(<CoachFirstProgrammeGuide />);
  await settle();
  assert.equal(screen.queryByTestId("coach-first-programme-guide"), null, "all done");
  cleanup();

  installFetch("coach", coachData([], [], []));
  render(<CoachFirstProgrammeGuide />);
  await screen.findByText("Your first programme");
  fireEvent.click(screen.getByRole("button", { name: "Hide this guide" }));
  assert.equal(screen.queryByTestId("coach-first-programme-guide"), null);
  cleanup();
  render(<CoachFirstProgrammeGuide />);
  await settle();
  assert.equal(screen.queryByTestId("coach-first-programme-guide"), null, "remembered");
});

function athleteData(overrides: Data = {}): Data {
  return {
    "/coach-workspace/relationships/mine": { relationships: [] },
    "/account/onboarding/training-week": { week: null, programme_in_progress: false },
    "/account/onboarding/maxes": { loading_method_chosen: false, lifts: [] },
    "/account/onboarding/equipment": { full_gym: true, gyms: [] },
    "/sessions/beta-athlete-history": { sessions: [] },
    ...overrides
  };
}

test("a self-training athlete is led from their week to their first session", async () => {
  installFetch("athlete", athleteData({ "/account/onboarding/training-week": { week: { week_id: "w1" } } }));
  render(<AthleteFirstStepsGuide />);
  await screen.findByText("Set up your training");
  screen.getByText("1 of 3 done");
  assert.match(document.querySelector("[aria-current=step]")?.textContent ?? "", /Choose how your weights are set/u);
  screen.getByText("Check your gym and kit (optional)");
  screen.getByRole("button", { name: "Set my weights" });
});

test("the athlete guide goes after the first session, and never shows for an athlete with a coach", async () => {
  installFetch("athlete", athleteData({
    "/account/onboarding/training-week": { week: { week_id: "w1" } },
    "/account/onboarding/maxes": { loading_method_chosen: true, lifts: [] },
    "/sessions/beta-athlete-history": { sessions: [{ session_id: "s1" }] }
  }));
  render(<AthleteFirstStepsGuide />);
  await settle();
  assert.equal(screen.queryByTestId("athlete-first-steps-guide"), null, "done - kit is optional");
  cleanup();

  installFetch("athlete", athleteData({ "/coach-workspace/relationships/mine": { relationships: [{ relationship_state: "accepted" }] } }));
  render(<AthleteFirstStepsGuide />);
  await settle();
  assert.equal(screen.queryByTestId("athlete-first-steps-guide"), null, "their coach builds the programme");
});

test("coaches don't see the athlete guide, nor athletes the coach one", async () => {
  installFetch("coach", coachData([], [], []));
  render(<AthleteFirstStepsGuide />);
  await settle();
  assert.equal(screen.queryByTestId("athlete-first-steps-guide"), null);
  cleanup();
  installFetch("athlete", athleteData());
  render(<CoachFirstProgrammeGuide />);
  await settle();
  assert.equal(screen.queryByTestId("coach-first-programme-guide"), null);
});
