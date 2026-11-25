// Block complete: an athlete who has just finished a block sees the award on
// Today until they close it, keeps it in My programme, and can print it.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AWARD_PRINTING_CLASS, BlockAwardsList, TodayBlockAward } from "../screens/athlete/BlockAwards";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const award = (id: string, daysAgo: number, name = "Strength block") => ({
  award_id: id, block_name: name, programme_name: "Meet prep", coach_name: "Morgan", source: "coach", weeks: 4,
  sessions_done: 11, sessions_total: 12, finished_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString()
});

function installMocks(awards: unknown[]) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input) === "/account/onboarding/block-awards") return jsonResponse({ ok: true, athlete_name: "Sam Lifter", awards });
    if (String(input).startsWith("/account/")) return jsonResponse({ ok: true, account: { actor_type: "athlete" } });
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => { cleanup(); window.localStorage.clear(); document.dispatchEvent(new CustomEvent("kolosseum:data-changed")); });

test("a block finished this week shows on Today, and stays closed once it's closed", async () => {
  installMocks([award("a1", 1), award("a0", 60, "Base block")]);
  const view = render(<TodayBlockAward />);
  const card = await screen.findByTestId("today-block-award");
  assert.match(card.textContent ?? "", /Block complete/u);
  assert.match(card.textContent ?? "", /Strength block/u);
  assert.match(card.textContent ?? "", /4 weeks · 11 of 12 sessions/u);
  assert.doesNotMatch(card.textContent ?? "", /%/u);
  fireEvent.click(screen.getByRole("button", { name: "Close block complete" }));
  assert.equal(screen.queryByTestId("today-block-award") === null, true);
  view.unmount();
  render(<TodayBlockAward />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  assert.equal(screen.queryByTestId("today-block-award") === null, true, "closed stays closed");
});

test("an old award isn't announced, and there's nothing with none", async () => {
  installMocks([award("a0", 30)]);
  render(<TodayBlockAward />);
  render(<BlockAwardsList />);
  await screen.findByTestId("block-awards");
  assert.equal(screen.queryByTestId("today-block-award") === null, true);
});

test("My programme keeps every award, and prints a certificate with their name", async () => {
  installMocks([award("a1", 1), award("a0", 60, "Base block")]);
  let printed = "";
  window.print = () => { printed = document.getElementById("award-print-root")?.textContent ?? ""; };
  render(<BlockAwardsList />);
  const rows = await screen.findAllByRole("button", { expanded: false });
  assert.equal(rows.length, 2);
  assert.match(rows[1].textContent ?? "", /Block complete: Base block/u);
  fireEvent.click(rows[0]);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Print certificate" })); });
  await waitFor(() => assert.match(printed, /Block completeSam LifterStrength blockMeet prep/u));
  assert.match(printed, /Coach: Morgan/u);
  assert.equal(document.body.classList.contains(AWARD_PRINTING_CLASS), true);
  await act(async () => { window.dispatchEvent(new Event("afterprint")); });
  assert.equal(document.body.classList.contains(AWARD_PRINTING_CLASS), false);
  assert.equal(document.getElementById("award-print-root") === null, true);
});

test("sharing says when the picture cannot be made", async () => {
  window.HTMLCanvasElement.prototype.getContext = (() => null) as never;
  installMocks([award("a1", 1)]);
  render(<BlockAwardsList />);
  fireEvent.click((await screen.findAllByRole("button", { expanded: false }))[0]);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Share picture" })); });
  // No drawing surface here: it says so rather than failing silently.
  await screen.findByText(/picture could not be made/u);
});
