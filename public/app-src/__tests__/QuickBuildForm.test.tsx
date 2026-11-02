// Quick build: the goals follow the sport, and one tap builds the whole
// draft with every choice sent; a double tap builds once.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { QuickBuildForm } from "../screens/coach/QuickBuildForm";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

type Call = { method: string; path: string; body: Record<string, unknown> | null };

function installFetch(options: { buildFails?: boolean } = {}) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/templates/quick-build/goals")) {
      const sport = new URL(path, "http://x").searchParams.get("activity_id");
      return jsonResponse({ ok: true, goals: sport === "powerlifting"
        ? [{ goal_id: "build", label: "Get stronger", summary: "Volume then intensity blocks, repeating." }, { goal_id: "peak", label: "Peak for a competition", summary: "Volume, then intensity, then a peak block to finish." }]
        : [{ goal_id: "off_season", label: "Off-season", summary: "Build strength while there are no matches." }] });
    }
    if (path === "/templates/quick-build" && method === "POST") {
      if (options.buildFails) return jsonResponse({ error: "starter_template_invalid" }, 422);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse({ ok: true, template: { template_id: "tpl_qb_1" } }, 201);
    }
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => cleanup());

async function chooseSport(id: string) {
  const sport = screen.getByLabelText("Sport") as HTMLSelectElement;
  await act(async () => {
    fireEvent.change(sport, { target: { value: id } });
  });
}

test("builds a peaking powerlifting programme with every choice, once", async () => {
  const calls = installFetch();
  const created: string[] = [];
  render(<QuickBuildForm onCreated={(id) => created.push(id)} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick build a programme" }));
  assert.equal((screen.getByRole("button", { name: "Build programme" }) as HTMLButtonElement).disabled, true, "needs a sport first");
  await chooseSport("powerlifting");
  await screen.findByRole("option", { name: "Peak for a competition" });
  fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "peak" } });
  screen.getByText("Volume, then intensity, then a peak block to finish.");
  fireEvent.change(screen.getByLabelText("Length"), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText("Training days a week"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("Session length"), { target: { value: "60" } });
  fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "home_gym" } });
  fireEvent.change(screen.getByLabelText("Set weights by"), { target: { value: "rpe" } });
  const button = screen.getByRole("button", { name: "Build programme" });
  await act(async () => {
    fireEvent.click(button);
    fireEvent.click(button);
  });
  await waitFor(() => assert.deepEqual(created, ["tpl_qb_1"]));
  const posts = calls.filter((c) => c.method === "POST" && c.path === "/templates/quick-build");
  assert.equal(posts.length, 1, "a double tap builds once");
  assert.deepEqual(posts[0].body, { activity_id: "powerlifting", experience_level: "amateur", days_per_week: 4, weeks: 12, goal: "peak", session_minutes: 60, equipment: "home_gym", weights: "rpe" });
});

test("the goals change with the sport", async () => {
  installFetch();
  render(<QuickBuildForm onCreated={() => undefined} startOpen />);
  await chooseSport("powerlifting");
  await screen.findByRole("option", { name: "Get stronger" });
  await chooseSport("rugby_union");
  await screen.findByRole("option", { name: "Off-season" });
  assert.equal(screen.queryByRole("option", { name: "Get stronger" }), null);
});

test("a build that fails says so and stays open", async () => {
  installFetch({ buildFails: true });
  render(<QuickBuildForm onCreated={() => assert.fail("should not open anything")} startOpen />);
  await chooseSport("powerlifting");
  await screen.findByRole("option", { name: "Get stronger" });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Build programme" }));
  });
  await screen.findByText("The programme couldn't be built. Check the choices and try again.");
  screen.getByTestId("quick-build");
});
