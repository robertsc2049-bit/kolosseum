// The athlete's side of load a coach can trust: rating a finished session
// (how hard, how long) and logging practice, matches and conditioning.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SessionEffortCard } from "../screens/athlete/SessionEffortCard";
import { OtherTrainingPanel } from "../screens/athlete/OtherTrainingPanel";
import { TrendChart } from "../components/TrendChart";
import { __resetSharedReadsForTests } from "../api/transport";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
let entries: Array<Record<string, unknown>> = [];
function installMocks(existingReport: unknown = null) {
  posts.length = 0;
  entries = [{ id: "ot_1", date: "2026-10-15", kind: "practice", minutes: 90, srpe: 6 }];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/account/detail") return jsonResponse({ ok: true, csrf_token: "csrf-1" });
    if (init?.method === "POST") {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      posts.push({ path, body });
      if (path === "/account/onboarding/other-training") entries = [{ id: "ot_2", ...body }, ...entries];
      if (path === "/account/onboarding/other-training/remove") entries = entries.filter((entry) => entry.id !== body.id);
      return jsonResponse({ ok: true });
    }
    if (path.startsWith("/account/onboarding/session-load/")) return jsonResponse({ ok: true, report: existingReport });
    if (path === "/account/onboarding/other-training") return jsonResponse({ ok: true, entries });
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
}

test.beforeEach(() => __resetSharedReadsForTests());
test.afterEach(() => cleanup());

test("a finished session: the athlete rates the whole session and its minutes, and it saves once", async () => {
  installMocks();
  render(<SessionEffortCard sessionId="s1" />);
  await screen.findByText("How was that session?");
  const save = screen.getByText("Save") as HTMLButtonElement;
  assert.equal(save.disabled, true, "nothing to save until both are given");
  await act(async () => { fireEvent.click(screen.getByText("Very hard").closest("button")!); });
  await act(async () => { fireEvent.change(screen.getByLabelText("How long did it take? (minutes)"), { target: { value: "75" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Save")); });
  await screen.findByText("Saved");
  assert.deepEqual(posts, [{ path: "/account/onboarding/session-load", body: { session_id: "s1", srpe: 7, minutes: 75 } }]);
});

test("a session already rated shows its rating, and can be changed", async () => {
  installMocks({ srpe: 6, minutes: 60 });
  render(<SessionEffortCard sessionId="s1" />);
  await screen.findByText("Saved");
  assert.equal(screen.getByText("Hard+").closest("button")!.getAttribute("aria-checked"), "true");
  await act(async () => { fireEvent.click(screen.getByText("Hard").closest("button")!); });
  assert.ok(screen.getByText("Save"), "a change can be saved again");
});

test("logging a match: when, what, how long, how hard - then it's listed and can be removed", async () => {
  installMocks();
  render(<OtherTrainingPanel />);
  await screen.findByText(/Team practice/u);
  await act(async () => { fireEvent.click(screen.getByText("Log training")); });
  const form = screen.getByTestId("other-training");
  await act(async () => { fireEvent.change(form.querySelector("select")!, { target: { value: "match" } }); });
  await act(async () => { fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "80" } }); });
  await act(async () => { fireEvent.change(screen.getByLabelText("How hard (0-10)"), { target: { value: "9" } }); });
  await act(async () => { fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "v Northside" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Save")); });
  await screen.findByText(/v Northside/u);
  const added = posts.find((post) => post.path === "/account/onboarding/other-training")!;
  assert.equal(added.body.kind, "match");
  assert.equal(added.body.minutes, 80);
  assert.equal(added.body.srpe, 9);
  assert.match(String(added.body.client_request_id), /^ot_/u);
  await act(async () => { fireEvent.click(screen.getAllByText("Remove")[0]); });
  assert.ok(posts.some((post) => post.path === "/account/onboarding/other-training/remove" && post.body.id === "ot_2"));
});

test("charts mark competitions, matches and deloads on their weeks, with a key", () => {
  render(<TrendChart title="Load" weeks={["2026-10-05", "2026-10-12"]} series={[{ id: "l", label: "Load", values: [100, 200] }]} markers={[
    { week_start: "2026-10-05", kind: "deload", label: "Deload: Week 4" },
    { week_start: "2026-10-12", kind: "match", label: "Match: v Northside" },
    { week_start: "2026-10-12", kind: "competition", label: "Competition" }
  ]} />);
  const marks = [...document.querySelectorAll(".trend-marker")];
  assert.equal(marks.length, 2, "one mark per week");
  assert.equal(marks[1].querySelector("text")!.textContent, "MC");
  assert.match(marks[1].querySelector("title")!.textContent ?? "", /Match: v Northside, Competition/u);
  const legend = document.querySelector(".trend-legend")!.textContent ?? "";
  assert.ok(legend.includes("Deload") && legend.includes("Match") && legend.includes("Competition"));
});
