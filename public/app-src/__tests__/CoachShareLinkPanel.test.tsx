// A coach's share link: off until they turn it on, with an address
// suggested from their business name; once on, the link and its QR code to
// share, copy or download.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachShareLinkPanel } from "../screens/account/CoachShareLinkPanel";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

type Call = { method: string; path: string; body: Record<string, unknown> | null };

function installMocks(initial: Record<string, unknown> | null, options: { saveFails?: string } = {}) {
  const calls: Call[] = [];
  let current = initial;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    if (path === "/coach-branding/share-link" && method === "PUT") {
      if (options.saveFails) return jsonResponse({ ok: false, error: options.saveFails }, 409);
      current = { slug: String(body?.slug), enabled: body?.enabled === true, path: `/c/${String(body?.slug)}` };
      return jsonResponse({ ok: true, share_link: current, suggested_slug: current.slug });
    }
    if (path === "/coach-branding/share-link") return jsonResponse({ ok: true, share_link: current, suggested_slug: "old-tyme-strength" });
    return jsonResponse({ error: `unhandled_${path}` }, 404);
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => cleanup());

test("off at first, with an address suggested from the business name; turning it on shows the link and QR code", async () => {
  const calls = installMocks(null);
  render(<CoachShareLinkPanel />);
  const address = await screen.findByLabelText("Page address") as HTMLInputElement;
  assert.equal(address.value, "old-tyme-strength");
  assert.equal(screen.queryByTestId("share-link-on"), null);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Turn on my link" }));
  });
  await screen.findByText("Your link is on.");
  const put = calls.find((call) => call.method === "PUT");
  assert.deepEqual(put?.body, { slug: "old-tyme-strength", enabled: true });
  screen.getByRole("link", { name: `${window.location.origin}/c/old-tyme-strength` });
  const qr = screen.getByAltText(`QR code for ${window.location.origin}/c/old-tyme-strength`) as HTMLImageElement;
  assert.equal(qr.getAttribute("src"), "/c/old-tyme-strength/qr.svg");
  assert.equal(screen.getByRole("link", { name: "Download QR code" }).getAttribute("href"), "/c/old-tyme-strength/qr.png?download");
});

test("turning it off says the page no longer works", async () => {
  const calls = installMocks({ slug: "old-tyme-strength", enabled: true, path: "/c/old-tyme-strength" });
  render(<CoachShareLinkPanel />);
  await screen.findByTestId("share-link-on");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
  });
  await screen.findByText("Your link is off - the page and QR code no longer work.");
  assert.deepEqual(calls.find((call) => call.method === "PUT")?.body, { slug: "old-tyme-strength", enabled: false });
  screen.getByRole("button", { name: "Turn on my link" });
});

test("an address another coach has is explained", async () => {
  installMocks(null, { saveFails: "coach_share_link_slug_taken" });
  render(<CoachShareLinkPanel />);
  await screen.findByLabelText("Page address");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Turn on my link" }));
  });
  await screen.findByText("Another coach has that address - pick a different one.");
});

test("changing the address of a link that's on keeps it on", async () => {
  const calls = installMocks({ slug: "old-tyme-strength", enabled: true, path: "/c/old-tyme-strength" });
  render(<CoachShareLinkPanel />);
  await screen.findByTestId("share-link-on");
  fireEvent.change(screen.getByLabelText("Page address"), { target: { value: "Chris-Lifts" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
  });
  await screen.findByText("Your link is on.");
  assert.deepEqual(calls.find((call) => call.method === "PUT")?.body, { slug: "chris-lifts", enabled: true });
  screen.getByRole("link", { name: `${window.location.origin}/c/chris-lifts` });
});
