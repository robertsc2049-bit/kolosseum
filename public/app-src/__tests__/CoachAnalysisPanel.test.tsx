// The coach's Analysis page: who needs a look first, and one athlete's
// trends - a plain headline per section for the coach, the numbers and
// methods behind it for a sports scientist.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachAnalysisPanel } from "../screens/coach/CoachAnalysisPanel";
import { __resetSharedReadsForTests } from "../api/transport";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const weeks = ["2026-09-28", "2026-10-05", "2026-10-12"];
const finding = (id: string, section: string, level: string, text: string) => ({ id, section, level, text });
const roster = {
  ok: true, weeks: 8, athletes: [
    { athlete_user_id: "a1", display_name: "Jordan", attention: 7, findings: [finding("pain_knee", "pain", "alert", "Knee pain reported in 2 different weeks (Back squat)."), finding("load", "load", "watch", "Training load is 40% above their 4-week normal (ratio 1.4).")], adherence: { latest_pct: 100 }, load: { acute_chronic: 1.4 }, readiness: { z: -1.6 }, strength: [{ name: "Back squat", status: "rising" }] },
    { athlete_user_id: "a2", display_name: "Casey", attention: 0, findings: [finding("adherence", "adherence", "good", "Training as planned.")], adherence: { latest_pct: 100 }, load: { acute_chronic: 1 }, readiness: { z: 0.2 }, strength: [] }
  ]
};
const athlete = {
  ok: true, weeks: 12, athlete: { display_name: "Jordan" },
  findings: [finding("strength_back_squat", "strength", "good", "Back squat estimated max up 7.3% to 181.9 kg."), finding("load", "load", "watch", "Training load is 40% above their 4-week normal (ratio 1.4).")],
  analysis: {
    weeks,
    strength: { lifts: [{ exercise_id: "back_squat", name: "Back squat", main: true, latest: 181.9, status: "rising", change_pct: 7.3, change_from_week: "2026-09-28", peak: 181.9, peak_week: "2026-10-12", series: [{ e1rm: 170, method: "epley", from: "150 kg x 4" }, { e1rm: 176, method: "rts", from: "155 kg x 5" }, { e1rm: 181.9, method: "rts", from: "160 kg x 5" }] }] },
    execution: { rows: weeks.map(() => ({ reps_hit_pct: 100, sets_logged_pct: 100, load_vs_plan_pct: 0 })), most_missed: [], effort_creep: [] },
    load: { rows: [{ load: 1000, acute_chronic: 1, monotony: 0.8, strain: 800 }, { load: 1100, acute_chronic: 1.1, monotony: 0.8, strain: 880 }, { load: 1400, acute_chronic: 1.4, monotony: 0.9, strain: 1260 }], sessions: [] },
    adherence: { rows: weeks.map(() => ({ completed: 3, partial: 0, abandoned: 0, planned: 3, adherence_pct: 100 })), by_weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({ day, sessions: i % 2 ? 0 : 3 })), most_skipped: [] },
    readiness: { rows: weeks.map(() => ({ check_ins: 5, sleep: 4, soreness: 4, stress: 4, total: 12, z: 0 })), days: [], checkins: weeks.map(() => ({ energy: 4, motivation: 4, sleep: 4 })) },
    pain: { rows: weeks.map(() => ({ reports: 0, areas: {} })), areas: [] },
    volume: { rows: weeks.map(() => ({ sets: 20, tonnage_kg: 11000 })) }
  }
};

function installMocks() {
  const paths: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    paths.push(path);
    if (path === "/coach-workspace/analysis") return jsonResponse(roster);
    if (path.startsWith("/coach-workspace/athletes/a1/analysis")) return jsonResponse(athlete);
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  return paths;
}

test.beforeEach(() => { window.location.hash = "#/coach/progress"; __resetSharedReadsForTests(); });
test.afterEach(() => cleanup());

test("the roster ranks athletes by what needs a look, with the reasons in plain English", async () => {
  installMocks();
  render(<CoachAnalysisPanel />);
  await screen.findByText("Jordan");
  const rowsShown = [...document.querySelectorAll("[data-testid='analysis-roster'] tbody tr")];
  assert.equal(rowsShown[0].textContent?.includes("Jordan"), true);
  assert.ok(rowsShown[0].textContent?.includes("Needs a look"));
  assert.ok(rowsShown[0].textContent?.includes("Knee pain reported in 2 different weeks"));
  assert.ok(rowsShown[1].textContent?.includes("On track"));
  assert.ok(rowsShown[1].textContent?.includes("Nothing needs a look"), "good news is not listed as a problem");
});

test("an athlete's analysis: findings first, each section a headline and a chart, the numbers and methods one click away", async () => {
  const paths = installMocks();
  render(<CoachAnalysisPanel />);
  await screen.findByText("Jordan");
  await act(async () => { fireEvent.click(screen.getByText("Jordan")); });
  await screen.findByTestId("analysis-summary");
  assert.ok(paths.some((p) => p === "/coach-workspace/athletes/a1/analysis?weeks=12"));
  const strength = screen.getByTestId("analysis-strength");
  assert.ok(strength.textContent?.includes("Back squat estimated max up 7.3% to 181.9 kg."));
  assert.ok(strength.querySelector("svg"), "a chart");
  const numbers = strength.querySelector("details.analysis-numbers") as HTMLDetailsElement;
  assert.equal(numbers.open, false, "the numbers start folded away");
  assert.ok(numbers.textContent?.includes("RTS (Tuchscherer) RPE chart"), "the method is stated");
  assert.ok(numbers.textContent?.includes("181.9ʳ"), "the weekly table marks RTS estimates");
  const load = screen.getByTestId("analysis-load");
  assert.ok(load.textContent?.includes("0.8-1.3: in line with normal"));
  assert.ok(load.textContent?.includes("disputed as an injury predictor"), "the caveat is shown with the metric");

  await act(async () => { fireEvent.click(screen.getByText("26 wks")); });
  assert.ok(paths.some((p) => p === "/coach-workspace/athletes/a1/analysis?weeks=26"));
  await act(async () => { fireEvent.click(screen.getByText("‹ All athletes")); });
  await screen.findByText("Who needs a look");
});

test("the roster is only worked out while the Analysis page is open - not on every page load", async () => {
  const paths = installMocks();
  window.location.hash = "#/coach/overview";
  render(<CoachAnalysisPanel />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.equal(paths.filter((p) => p === "/coach-workspace/analysis").length, 0);
  await act(async () => { window.location.hash = "#/coach/progress"; await new Promise((resolve) => setTimeout(resolve, 50)); });
  assert.equal(paths.filter((p) => p === "/coach-workspace/analysis").length, 1);
  await screen.findByText("Jordan");
});

test("opening the Analysis page from the menu (the section is un-hidden, no hashchange) loads the roster", async () => {
  const paths = installMocks();
  window.location.hash = "#/coach/overview";
  const section = document.createElement("section");
  section.id = "view-coach-progress";
  section.hidden = true;
  document.body.appendChild(section);
  try {
    render(<CoachAnalysisPanel />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    assert.equal(paths.filter((p) => p === "/coach-workspace/analysis").length, 0);
    await act(async () => { section.hidden = false; await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.ok(paths.filter((p) => p === "/coach-workspace/analysis").length >= 1);
    await screen.findByText("Jordan");
  }
  finally {
    section.remove();
  }
});

test("every part of an athlete's analysis explains itself - what it shows, how to read it, how it's worked out", async () => {
  installMocks();
  render(<CoachAnalysisPanel />);
  await screen.findByText("Jordan");
  assert.ok(screen.getByTestId("explain-roster"), "the roster explains its statuses and columns");
  await act(async () => { fireEvent.click(screen.getByText("Jordan")); });
  await screen.findByTestId("analysis-summary");
  for (const id of ["summary", "strength", "execution", "load", "adherence", "readiness", "pain", "volume"]) {
    const explain = screen.getByTestId(`explain-${id}`) as HTMLDetailsElement;
    assert.equal(explain.open, false, `${id}: folded away until asked for`);
    const text = explain.textContent ?? "";
    assert.ok(text.includes("How to read it") && text.includes("How it's worked out"), `${id}: full explanation`);
  }
  assert.ok(screen.getByTestId("explain-load").textContent?.includes("0.8-1.3 (the shaded band) is normal"));
});
