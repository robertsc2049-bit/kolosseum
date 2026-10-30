// Someone who followed a coach's share link and is signed in as an athlete
// is offered to ask that coach; nothing is sent until they tap Ask.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CoachLinkRequestCard } from "../screens/athlete/CoachLinkRequestCard";
import { capturePendingCoachFromUrl, readPendingCoach } from "../utils/pendingCoach";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

type Call = { method: string; path: string; body: Record<string, unknown> | null };

function installMocks(options: { cardStatus?: number; askError?: string } = {}) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "ath_1" }, csrf_token: "csrf-abc" });
    if (path === "/c/old-tyme-strength/card") {
      if (options.cardStatus) return jsonResponse({ ok: false, error: "coach_share_link_not_found" }, options.cardStatus);
      return jsonResponse({ ok: true, coach: { slug: "old-tyme-strength", display_name: "Chris Roberts", business_name: "Old Tyme Strength", tagline: "Barbell strength, the old way.", brand_color: "#8a5a2b", gyms: [] } });
    }
    if (path === "/account/onboarding/coaching-requests" && method === "POST") {
      if (options.askError) return jsonResponse({ ok: false, error: options.askError, ...(options.askError === "coaching_request_recently_declined" ? { field_errors: { ask_again_from: "2099-11-29T10:00:00.000Z" } } : {}) }, 409);
      return jsonResponse({ ok: true, request_id: "creq_1" }, 201);
    }
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return calls;
}

function signInAs(role: string) {
  window.localStorage.setItem("kolosseum.product.app.v1", JSON.stringify({ role }));
}

function followLink(slug: string) {
  window.history.replaceState(null, "", `/app/?coach=${slug}#today`);
  capturePendingCoachFromUrl();
}

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("the coach's link is kept and taken out of the address bar", () => {
  followLink("Old-Tyme-Strength");
  assert.equal(readPendingCoach(), "old-tyme-strength");
  assert.equal(window.location.search, "");
  assert.equal(window.location.hash, "#today");
  followLink("<script>");
  assert.equal(readPendingCoach(), "old-tyme-strength", "an address that can't be a link is ignored");
});

test("an athlete asks the coach whose link they followed, with a note", async () => {
  signInAs("athlete");
  followLink("old-tyme-strength");
  const calls = installMocks();
  render(<CoachLinkRequestCard />);
  await screen.findByText("Ask Chris Roberts · Old Tyme Strength to coach you?");
  assert.equal(calls.filter((call) => call.method === "POST").length, 0, "nothing sent before they tap Ask");
  fireEvent.change(screen.getByLabelText("A line about you and your goals (optional)"), { target: { value: "Want to compete." } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ask to coach me" }));
  });
  await screen.findByText("Asked - Chris Roberts will invite you if they can take you on. Their invitation shows on your Account page.");
  assert.deepEqual(calls.find((call) => call.method === "POST")?.body, { coach_link: "old-tyme-strength", note: "Want to compete." });
  assert.equal(readPendingCoach(), "");
});

test("not now forgets the link without asking", async () => {
  signInAs("athlete");
  followLink("old-tyme-strength");
  const calls = installMocks();
  render(<CoachLinkRequestCard />);
  await screen.findByText("Ask Chris Roberts · Old Tyme Strength to coach you?");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  });
  await waitFor(() => assert.equal(screen.queryByTestId("coach-link-request-card"), null));
  assert.equal(readPendingCoach(), "");
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);
});

test("asking a coach who already coaches them says so", async () => {
  signInAs("athlete");
  followLink("old-tyme-strength");
  installMocks({ askError: "coaching_request_already_coached" });
  render(<CoachLinkRequestCard />);
  await screen.findByText("Ask Chris Roberts · Old Tyme Strength to coach you?");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ask to coach me" }));
  });
  await screen.findByText("Chris Roberts already coaches you.");
});

test("a coach who turned them down recently says when they can ask again", async () => {
  signInAs("athlete");
  followLink("old-tyme-strength");
  installMocks({ askError: "coaching_request_recently_declined" });
  render(<CoachLinkRequestCard />);
  await screen.findByText("Ask Chris Roberts · Old Tyme Strength to coach you?");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ask to coach me" }));
  });
  const when = new Date("2099-11-29T10:00:00.000Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  await screen.findByText(`Chris Roberts couldn't take you on recently - you can ask them again from ${when}.`);
  assert.equal(readPendingCoach(), "");
});

test("a link that's been switched off is forgotten quietly", async () => {
  signInAs("athlete");
  followLink("old-tyme-strength");
  installMocks({ cardStatus: 404 });
  render(<CoachLinkRequestCard />);
  await waitFor(() => assert.equal(readPendingCoach(), ""));
  assert.equal(screen.queryByTestId("coach-link-request-card"), null);
});

test("a coach following a link sees nothing to ask", async () => {
  signInAs("coach");
  followLink("old-tyme-strength");
  const calls = installMocks();
  render(<CoachLinkRequestCard />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(screen.queryByTestId("coach-link-request-card"), null);
  assert.equal(calls.length, 0);
});
