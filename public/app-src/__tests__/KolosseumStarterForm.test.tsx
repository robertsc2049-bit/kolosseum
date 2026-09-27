import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { KolosseumStarterForm } from "../screens/coach/KolosseumStarterForm";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

test.afterEach(() => cleanup());

test("a rugby coach starts a pro, 4-day programme from Kolosseum and it opens as a draft", async () => {
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
  fireEvent.change(screen.getByLabelText("Sport"), { target: { value: "rugby_union" } });
  fireEvent.change(screen.getByLabelText("Level"), { target: { value: "pro" } });
  fireEvent.change(screen.getByLabelText("Training days a week"), { target: { value: "4" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Create draft"));
  });
  await waitFor(() => assert.deepEqual(opened, ["tpl_new"]));
  assert.deepEqual(posts, [{ activity_id: "rugby_union", experience_level: "pro", days_per_week: 4 }]);
});
