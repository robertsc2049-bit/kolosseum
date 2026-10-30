// Athletes who found the coach at a gym and asked to be coached: the coach
// invites them (the usual invitation) or dismisses the request.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachingRequestsPanel } from "../screens/coach/CoachingRequestsPanel";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

const request = { request_id: "creq_1", athlete_display_name: "Sam Lifter", athlete_email: "sam@example.com", gym_name: "Forge", note: "Competing in spring.", requested_at: "2026-10-30T10:00:00.000Z" };

function installMocks(initial: Record<string, unknown>[]) {
  const decisions: Array<{ path: string; body: unknown }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/coach-workspace/coaching-requests") return jsonResponse({ ok: true, requests: initial });
    if (path.endsWith("/decision")) {
      decisions.push({ path, body: JSON.parse(String(init?.body)) });
      return jsonResponse({ ok: true, requests: [] });
    }
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return decisions;
}

test.afterEach(() => cleanup());

test("shows nothing when no athlete has asked", async () => {
  installMocks([]);
  const { container } = render(<CoachingRequestsPanel />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(container.innerHTML, "");
});

test("shows who asked, where they found the coach and their note, and invites them", async () => {
  const decisions = installMocks([request]);
  render(<CoachingRequestsPanel />);
  await screen.findByText("Sam Lifter");
  screen.getByText("sam@example.com");
  screen.getByText(/Found you at Forge/u);
  screen.getByText("\"Competing in spring.\"");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
  });
  await screen.findByText("Invitation sent to Sam Lifter.");
  assert.deepEqual(decisions, [{ path: "/coach-workspace/coaching-requests/creq_1/decision", body: { decision: "invite" } }]);
});

test("dismissing a request removes it", async () => {
  const decisions = installMocks([request]);
  render(<CoachingRequestsPanel />);
  await screen.findByText("Sam Lifter");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  });
  await screen.findByText("Request dismissed.");
  assert.equal(screen.queryByText("Sam Lifter"), null);
  assert.deepEqual(decisions.map((d) => d.body), [{ decision: "dismiss" }]);
});
