// An athlete's coaching requests on their Account page: where each stands,
// and withdrawing one the coach hasn't answered yet.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AthleteCoachingRequestsPanel } from "../screens/account/AthleteCoachingRequestsPanel";
import { COACHING_REQUESTS_CHANGED_EVENT } from "../utils/coachingRequests";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

const WAITING = { request_id: "creq_1", coach_display_name: "Chris Roberts", coach_business_name: "Old Tyme Strength", gym_name: null, via_share_link: true, status: "waiting", requested_at: "2026-10-30T10:00:00.000Z", ask_again_from: null };
const DECLINED = { request_id: "creq_2", coach_display_name: "Pat Other", coach_business_name: null, gym_name: "Forge", via_share_link: false, status: "not_taken_on", requested_at: "2026-10-01T10:00:00.000Z", decided_at: "2026-10-02T10:00:00.000Z", ask_again_from: "2099-11-01T10:00:00.000Z" };
const COACHING = { request_id: "creq_3", coach_display_name: "Lee Coach", coach_business_name: null, gym_name: "Forge", via_share_link: false, status: "coaching", requested_at: "2026-09-01T10:00:00.000Z", ask_again_from: null };

type Call = { method: string; path: string };

function installMocks(initial: Record<string, unknown>[], options: { withdrawFails?: boolean } = {}) {
  const calls: Call[] = [];
  let current = initial;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, path });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "ath_1" }, csrf_token: "csrf-abc" });
    if (path.endsWith("/withdraw") && method === "POST") {
      if (options.withdrawFails) return jsonResponse({ ok: false, error: "coaching_request_not_found" }, 404);
      current = current.filter((request) => !path.includes(String(request.request_id)));
      return jsonResponse({ ok: true, requests: current });
    }
    if (path === "/account/onboarding/coaching-requests") return jsonResponse({ ok: true, requests: current });
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return { calls, set: (next: Record<string, unknown>[]) => { current = next; } };
}

test.beforeEach(() => window.localStorage.setItem("kolosseum.product.app.v1", JSON.stringify({ role: "athlete" })));
test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("shows where each request stands", async () => {
  installMocks([WAITING, DECLINED, COACHING]);
  render(<AthleteCoachingRequestsPanel />);
  await screen.findByText("Chris Roberts · Old Tyme Strength");
  screen.getByText("Waiting for the coach to reply");
  screen.getByText(`Can't take you on right now - you can ask them again from ${new Date(DECLINED.ask_again_from).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`);
  screen.getByText("Coaching you");
  assert.equal(screen.getAllByRole("button", { name: "Withdraw" }).length, 1, "only a request still waiting can be withdrawn");
});

test("withdrawing a waiting request takes it off the list", async () => {
  const { calls } = installMocks([WAITING, COACHING]);
  render(<AthleteCoachingRequestsPanel />);
  await screen.findByText("Waiting for the coach to reply");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
  });
  assert.equal(screen.queryByText("Waiting for the coach to reply"), null);
  assert.ok(calls.some((call) => call.method === "POST" && call.path === "/account/onboarding/coaching-requests/creq_1/withdraw"));
});

test("a request the coach just answered can't be withdrawn, and the list catches up", async () => {
  const mocks = installMocks([WAITING], { withdrawFails: true });
  render(<AthleteCoachingRequestsPanel />);
  await screen.findByText("Waiting for the coach to reply");
  mocks.set([{ ...WAITING, status: "invited" }]);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
  });
  await screen.findByText("That request couldn't be withdrawn - the coach may have just replied.");
  await screen.findByText("Invited you - accept their invitation above");
});

test("a new request shows up when one is sent", async () => {
  const mocks = installMocks([]);
  render(<AthleteCoachingRequestsPanel />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(screen.queryByTestId("athlete-coaching-requests"), null, "nothing to show yet");
  mocks.set([WAITING]);
  await act(async () => {
    document.dispatchEvent(new Event(COACHING_REQUESTS_CHANGED_EVENT));
  });
  await screen.findByText("Waiting for the coach to reply");
});

test("coaches don't see it", async () => {
  window.localStorage.setItem("kolosseum.product.app.v1", JSON.stringify({ role: "coach" }));
  const { calls } = installMocks([WAITING]);
  render(<AthleteCoachingRequestsPanel />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(screen.queryByTestId("athlete-coaching-requests"), null);
  assert.equal(calls.length, 0);
});
