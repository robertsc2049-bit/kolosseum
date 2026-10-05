import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { KolosseumStarterForm } from "../screens/coach/KolosseumStarterForm";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

test.afterEach(() => cleanup());

test("with no Kolosseum programmes published yet, a rugby coach starts a pro, 4-day programme from the generated one and it opens as a draft", async () => {
  const posts: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/templates/kolosseum-starter") {
      posts.push(typeof init?.body === "string" ? JSON.parse(init.body) : {});
      return jsonResponse({ ok: true, template: { template_id: "tpl_new", template_status: "draft" } }, true, 201);
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  const opened: string[] = [];
  render(<KolosseumStarterForm onCreated={(id) => opened.push(id)} />);
  fireEvent.click(screen.getByText("Start from a Kolosseum programme"));
  await screen.findByLabelText("Sport");
  fireEvent.change(screen.getByLabelText("Sport"), { target: { value: "rugby_union" } });
  fireEvent.change(screen.getByLabelText("Level"), { target: { value: "pro" } });
  fireEvent.change(screen.getByLabelText("Training days a week"), { target: { value: "4" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Create draft"));
  });
  await waitFor(() => assert.deepEqual(opened, ["tpl_new"]));
  assert.deepEqual(posts, [{ activity_id: "rugby_union", experience_level: "pro", days_per_week: 4 }]);
});

const programmes = [
  { listing_id: "programme_off_season", title: "Off-season strength build (8 weeks)", summary: "Three days a week: jumps, throws and heavy lifting.", levels: ["amateur", "pro"], activity_ids: ["rugby_union", "basketball"], days_per_week: 3 },
  { listing_id: "programme_beginner", title: "Beginner full-body", summary: "Three full-body days.", levels: ["beginner"], activity_ids: [], days_per_week: 3 }
];

function catalogueMocks() {
  const copies: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/templates/kolosseum-programmes") return jsonResponse({ programmes });
    const copy = path.match(/^\/templates\/kolosseum-programmes\/([^/]+)\/copy$/);
    if (copy && init?.method === "POST") {
      copies.push(decodeURIComponent(copy[1]));
      await new Promise((resolve) => setTimeout(resolve, 20));
      return jsonResponse({ ok: true, template: { template_id: "tpl_copy", template_status: "draft" } }, true, 201);
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  return copies;
}

test("a rugby coach copies the coach-written off-season build into their library, and it opens as their draft", async () => {
  const copies = catalogueMocks();
  const opened: string[] = [];
  render(<KolosseumStarterForm onCreated={(id) => opened.push(id)} />);
  fireEvent.click(screen.getByText("Start from a Kolosseum programme"));
  await screen.findByText("Off-season strength build (8 weeks)");
  assert.ok(screen.getByText("Rugby Union, Basketball"));
  assert.ok(screen.getByText("Any sport"));
  assert.ok(screen.getByText("3 days a week · Amateur, Pro"));
  assert.equal(screen.queryByLabelText("Sport"), null, "no generated programme once coach-written ones are published");
  await act(async () => {
    fireEvent.click(screen.getAllByText("Copy to my library")[0]);
  });
  await waitFor(() => assert.deepEqual(opened, ["tpl_copy"]));
  assert.deepEqual(copies, ["programme_off_season"]);
});

test("a double tap on Copy to my library copies once", async () => {
  const copies = catalogueMocks();
  render(<KolosseumStarterForm onCreated={() => {}} />);
  fireEvent.click(screen.getByText("Start from a Kolosseum programme"));
  await screen.findByText("Off-season strength build (8 weeks)");
  const button = screen.getAllByText("Copy to my library")[0];
  await act(async () => {
    fireEvent.click(button);
    fireEvent.click(button);
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  assert.deepEqual(copies, ["programme_off_season"]);
});
