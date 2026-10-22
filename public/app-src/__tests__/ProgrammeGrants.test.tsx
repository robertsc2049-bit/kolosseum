// A coach gives a programme she sold outside the app; the athlete starts it.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProgrammeGrantsSection } from "../screens/coach/ProgrammeGrantsSection";
import { ProgrammeGrantsCard } from "../screens/athlete/ProgrammeGrantsCard";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const template = { template_id: "tpl_1_v1", template_name: "8-week strength", template_status: "active" };

test.afterEach(() => cleanup());

test("the coach gives the programme by email and sees her allowance; a full allowance says why", async () => {
  const posts: Record<string, unknown>[] = [];
  let full = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ csrf_token: "csrf" });
    if (path === "/templates/programme-grants") {
      return jsonResponse({ grants: posts.length ? [{ grant_id: "pg_1", template_id: "tpl_1_v1", title: "8-week strength", athlete_email: "sam@example.com", state: "pending" }] : [], usage: { active: 0, allowance: 50, dormant_after_days: 28 } });
    }
    if (path === "/templates/tpl_1_v1/programme-grants") {
      if (full) return jsonResponse({ ok: false, error: "programme_grant_allowance_full" }, false, 409);
      posts.push(typeof init?.body === "string" ? JSON.parse(init.body) : {});
      return jsonResponse({ ok: true, added: true }, true, 201);
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  render(<ProgrammeGrantsSection template={template} />);
  await waitFor(() => assert.ok(screen.getByText("Programme athletes: 0 of 50")));
  await act(async () => { fireEvent.change(screen.getByLabelText("Athlete's email"), { target: { value: "sam@example.com" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Give programme")); });
  await waitFor(() => assert.ok(screen.getByText("Waiting for them")));
  assert.equal(posts[0].athlete_email, "sam@example.com");
  assert.match(String(posts[0].client_request_id), /^pg_/u);
  assert.ok(screen.getByText("Take back"));
  full = true;
  await act(async () => { fireEvent.change(screen.getByLabelText("Athlete's email"), { target: { value: "tia@example.com" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Give programme")); });
  await waitFor(() => assert.ok(screen.getByText(/allowance is full/u)));
});

test("the athlete sees who it's from and starts it", async () => {
  let running = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ csrf_token: "csrf" });
    if (path === "/account/onboarding/programme-grants/pg_1/start") { running = true; }
    if (path.startsWith("/account/onboarding/programme-grants")) {
      return jsonResponse({ grants: [{ grant_id: "pg_1", title: "8-week strength", coach_name: "Cara Coach", accepted: running, running }] });
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  render(<ProgrammeGrantsCard />);
  await waitFor(() => assert.ok(screen.getByText("8-week strength")));
  assert.ok(screen.getByText(/from Cara Coach/u));
  await act(async () => { fireEvent.click(screen.getByText("Start")); });
  await waitFor(() => assert.ok(screen.getByText("Running")));
});
