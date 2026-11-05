import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ReadinessCard } from "../screens/athlete/ReadinessCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(initial: Record<string, unknown> = { today: null, low: false, lightening: { own: false, coach_on: false } }) {
  const saves: Record<string, unknown>[] = [];
  let lightening = (initial.lightening as Record<string, boolean>) ?? { own: false, coach_on: false };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/readiness" && method === "GET") return jsonResponse(initial);
    if (path === "/account/onboarding/readiness" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      saves.push(body);
      const low = [body.sleep, body.soreness, body.stress].includes(1) || body.sleep + body.soreness + body.stress <= 7;
      return jsonResponse({ today: { date: "2026-09-27", ...body }, low, lightening });
    }
    if (path === "/account/onboarding/readiness/lightening" && method === "PUT") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      saves.push({ lightening: body });
      lightening = { ...lightening, own: body.enabled === true };
      return jsonResponse({ today: initial.today ?? null, low: initial.low === true, lightening });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return saves;
}

test.afterEach(() => cleanup());

test("a self-directed lifter who turned the rule on answers after a bad night and is told today's session will be lighter", async () => {
  const saves = installMocks({ today: null, low: false, lightening: { own: true, coach_on: false } });
  render(<ReadinessCard selfDirected />);
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

test("a saved good day just says saved", async () => {
  installMocks({ today: { date: "2026-09-27", sleep: 4, soreness: 4, stress: 4 }, low: false, lightening: { own: true, coach_on: false } });
  render(<ReadinessCard selfDirected />);
  await screen.findByText("Saved.");
  assert.equal((screen.getByLabelText("How did you sleep? 4") as HTMLInputElement).checked, true);
});

test("off by default: a bad night is recorded, and the session is not lightened or said to be", async () => {
  installMocks({ today: { date: "2026-09-27", sleep: 1, soreness: 3, stress: 3 }, low: true, lightening: { own: false, coach_on: false } });
  render(<ReadinessCard />);
  await screen.findByText("Saved.");
  assert.equal(screen.queryByText("Saved - today's session will be lighter."), null);
  assert.ok(screen.getByText("Your check-in doesn't change your sessions unless your coach turns that on."));
  assert.equal(screen.queryByText("Lighten my sessions after a low check-in"), null, "a coached athlete doesn't choose - their coach does");
});

test("a coached athlete sees that her coach turned the rule on", async () => {
  installMocks({ today: { date: "2026-09-27", sleep: 1, soreness: 3, stress: 3 }, low: true, lightening: { own: false, coach_on: true } });
  render(<ReadinessCard />);
  await screen.findByText("Saved - today's session will be lighter.");
  assert.ok(screen.getByText(/Your coach has turned on a rule for your sessions/));
});

test("a self-directed athlete turns the rule on herself, with a plain statement of what it does", async () => {
  const saves = installMocks();
  render(<ReadinessCard selfDirected />);
  const box = (await screen.findByLabelText("Lighten my sessions after a low check-in")) as HTMLInputElement;
  assert.equal(box.checked, false, "off unless she turns it on");
  assert.match(screen.getByTestId("readiness-rule").textContent ?? "", /not an assessment of your health or of what you should do/);
  assert.doesNotMatch(screen.getByTestId("readiness-rule").textContent ?? "", /%/, "athletes never see percentages");
  await act(async () => {
    fireEvent.click(box);
  });
  await waitFor(() => assert.deepEqual(saves, [{ lightening: { enabled: true } }]));
  await waitFor(() => assert.equal((screen.getByLabelText("Lighten my sessions after a low check-in") as HTMLInputElement).checked, true));
});

test("a pro winger adds tiredness, mood, resting HR and HRV from her strap", async () => {
  const saves = installMocks();
  render(<ReadinessCard />);
  await screen.findByText("How are you today? (optional)");
  fireEvent.click(screen.getByLabelText("How did you sleep? 4"));
  fireEvent.click(screen.getByLabelText("How fresh do your muscles feel? 4"));
  fireEvent.click(screen.getByLabelText("How are stress and energy? 4"));
  fireEvent.click(screen.getByText("Add more (optional): tiredness, mood, heart rate, HRV"));
  fireEvent.click(screen.getByLabelText("How tired do you feel? 2"));
  fireEvent.click(screen.getByLabelText("How's your mood? 4"));
  fireEvent.change(screen.getByLabelText("Resting heart rate (bpm)"), { target: { value: "52" } });
  fireEvent.change(screen.getByLabelText("HRV (ms)"), { target: { value: "61" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save check-in"));
  });
  await waitFor(() => assert.equal(saves.length, 1));
  assert.deepEqual(saves[0], { sleep: 4, soreness: 4, stress: 4, fatigue: 2, mood: 4, resting_hr: 52, hrv_ms: 61 });
});
