// A rugby coach logs a winger's hamstring strain, then moves it on as she
// comes back; a concussion prompts a stand-down too.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { InjuryLog } from "../screens/coach/InjuryLog";
import { __resetSharedReadsForTests } from "../api/transport";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}
const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
function installMocks() {
  posts.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/account/detail") return jsonResponse({ ok: true, csrf_token: "csrf-1" });
    if (init?.method === "POST") {
      posts.push({ path, body: typeof init.body === "string" ? JSON.parse(init.body) : {} });
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
}
const injuries = {
  rows: [
    { id: "inj2", name: "right ankle (ligament sprain)", occurred_on: "2026-10-11", mechanism: "contact", context: "training", status: "out", expected_return: "2026-10-30", days_lost: 7, days_modified: 0, severity: "mild" },
    { id: "inj1", name: "left hamstring (muscle strain)", occurred_on: "2026-08-01", mechanism: "non_contact", context: "match", status: "returned", returned_on: "2026-08-25", days_lost: 14, days_modified: 10, severity: "moderate" }
  ]
};

test.beforeEach(() => { __resetSharedReadsForTests(); installMocks(); });
test.afterEach(() => cleanup());

test("the log shows days lost, severity and status", () => {
  render(<InjuryLog athleteUserId="a1" injuries={injuries} onChanged={() => {}} />);
  const log = screen.getByTestId("injury-log").textContent ?? "";
  assert.ok(log.includes("Right ankle (ligament sprain)") && log.includes("Out - expected back 30 Oct 2026") && log.includes("Mild"));
  assert.ok(log.includes("Left hamstring (muscle strain)") && log.includes("Back to full 25 Aug 2026") && log.includes("14 (+10 modified)") && log.includes("Moderate"));
  assert.equal(screen.getAllByText("Update").length, 1, "a returned injury is closed");
});

test("recording a hamstring strain, and a concussion asks for a stand-down too", async () => {
  let changed = 0;
  render(<InjuryLog athleteUserId="a1" injuries={{ rows: [] }} onChanged={() => { changed += 1; }} />);
  assert.ok(screen.getByText("No injuries recorded."));
  await act(async () => { fireEvent.click(screen.getByText("Record an injury")); });
  const form = screen.getByTestId("injury-form");
  const selects = form.querySelectorAll("select");
  await act(async () => { fireEvent.change(selects[2], { target: { value: "concussion" } }); });
  assert.match(form.textContent ?? "", /also record a stand-down/u);
  await act(async () => { fireEvent.change(selects[2], { target: { value: "muscle" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Save injury")); });
  assert.equal(posts[0].path, "/coach-workspace/athletes/a1/injuries");
  assert.deepEqual({ ...posts[0].body, occurred_on: "x", client_request_id: "x" }, { area: "thigh_back", side: "left", type: "muscle", mechanism: "non_contact", context: "training", status: "out", occurred_on: "x", client_request_id: "x" });
  assert.match(String(posts[0].body.client_request_id), /^inj_/u);
  assert.equal(changed, 1);
});

test("moving the ankle on to modified training with an expected return", async () => {
  render(<InjuryLog athleteUserId="a1" injuries={injuries} onChanged={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText("Update")); });
  const update = screen.getByTestId("injury-update");
  assert.equal((screen.getByLabelText("New status for right ankle (ligament sprain)") as HTMLSelectElement).value, "modified");
  const dates = update.querySelectorAll("input[type=date]");
  await act(async () => { fireEvent.change(dates[1], { target: { value: "2026-11-01" } }); });
  await act(async () => { fireEvent.click(update.querySelector("button")!); });
  assert.equal(posts[0].path, "/coach-workspace/athletes/a1/injuries/inj2/status");
  assert.equal(posts[0].body.status, "modified");
  assert.equal(posts[0].body.expected_return, "2026-11-01");
  await act(async () => { fireEvent.click(screen.getByLabelText("Remove left hamstring (muscle strain) on 2026-08-01")); });
  assert.equal(posts[1].path, "/coach-workspace/athletes/a1/injuries/inj1/remove");
});
