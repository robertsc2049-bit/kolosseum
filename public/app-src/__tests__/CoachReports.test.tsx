// The coach's progress reports: one for every week, block, cycle, programme
// and year - each summed up, set against the one before, and printable.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachReports } from "../screens/coach/CoachReports";
import { __resetSharedReadsForTests } from "../api/transport";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const period = (type: string, id: string, label: string, start: string, end: string, complete = true, detail?: string) => ({ type, id, label, start, end, complete, ...(detail ? { detail } : {}) });
const list = {
  ok: true, today: "2026-10-17",
  reports: {
    week: [period("week", "2026-10-12", "Week of 12 Oct", "2026-10-12", "2026-10-18", false), period("week", "2026-10-05", "Week of 5 Oct", "2026-10-05", "2026-10-11")],
    block: [period("block", "asg_1:1", "Strength - Meet prep", "2026-10-05", "2026-10-18", false), period("block", "asg_1:0", "Volume - Meet prep", "2026-09-07", "2026-10-04", true, "volume block")],
    cycle: [],
    programme: [period("programme", "asg_1", "Meet prep", "2026-09-07", "2026-10-18", false, "18 sessions")],
    year: [period("year", "2026", "2026", "2025-12-29", "2026-10-18", false)]
  }
};
const report = {
  ok: true,
  athlete: { display_name: "Jordan" },
  period: { ...list.reports.block[1], weeks: 4 },
  previous: null,
  findings: [{ id: "strength_back_squat", section: "strength", level: "good", text: "Back squat estimated max up 6% to 185 kg." }],
  summary: {
    sessions: { completed: 11, partial: 1, not_finished: 0, planned: 12, adherence_pct: 96, minutes: 720, average_effort: 7.4 },
    training: { sets: 210, tonnage_kg: 48210, load_total: 21000, load_weekly_average: 5250, peak_acute_chronic: { value: 1.2, week_start: "2026-09-28" }, average_monotony: 1.1 },
    strength: [{ exercise_id: "back_squat", name: "Back squat", main: true, start: 175, end: 185, best: 185, best_from: "160 kg x 5", change_pct: 5.7 }],
    execution: { reps_hit_pct: 94, sets_logged_pct: 98, effort_creep: [], most_missed: [], most_skipped: [] },
    wellbeing: { check_ins: 20, readiness_average: 11.2, low_weeks: 0, energy: 4, motivation: 4, sleep: 3.5 },
    pain: { reports: 0, areas: [] }
  },
  compared: { sessions_completed: 1, adherence_pct: 4, sets_pct: 8, tonnage_pct: 12, load_weekly_average_pct: 9, reps_hit_pct: 2, readiness_average: -0.4, pain_reports: 0, strength: [{ exercise_id: "back_squat", name: "Back squat", change_pct: 3.1 }] },
  analysis: { weeks: ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"], load: { rows: [] }, volume: { rows: [] }, adherence: { rows: [] } }
};

function installMocks() {
  const paths: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    paths.push(path);
    if (path === "/coach-workspace/athletes/a1/reports") return jsonResponse(list);
    if (path === "/coach-workspace/athletes/a1/reports/block/asg_1%3A0") return jsonResponse(report);
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  return paths;
}

test.beforeEach(() => __resetSharedReadsForTests());
test.afterEach(() => cleanup());

test("a coach opens a finished block's report: the period's numbers, set against the last block, ready to print", async () => {
  const paths = installMocks();
  render(<CoachReports athleteUserId="a1" />);
  await screen.findByText("Week of 12 Oct");
  assert.ok(screen.getByText("Weekly (2)"));
  assert.ok(screen.getByText("Cycle (0)"));
  const weekRows = [...document.querySelectorAll(".report-period")];
  assert.ok(weekRows[0].textContent?.includes("So far"), "this week's report is still going");
  assert.ok(weekRows[1].textContent?.includes("Complete"));

  await act(async () => { fireEvent.click(screen.getByText("Cycle (0)")); });
  assert.ok(screen.getByText(/Cycles follow the athlete's training plan/u));

  await act(async () => { fireEvent.click(screen.getByText("Block (2)")); });
  await act(async () => { fireEvent.click(screen.getByText("Volume - Meet prep")); });
  await screen.findByTestId("report-body");
  assert.ok(paths.includes("/coach-workspace/athletes/a1/reports/block/asg_1%3A0"));
  const tiles = screen.getByTestId("report-tiles").textContent ?? "";
  assert.ok(tiles.includes("11 + 1 part of 12"));
  assert.ok(tiles.includes("96%"));
  assert.ok(tiles.includes("▲ +12%"), "tonnage up on the last report");
  assert.ok(screen.getByText("Back squat estimated max up 6% to 185 kg."));
  const strength = screen.getByTestId("report-strength").textContent ?? "";
  assert.ok(strength.includes("185 kg (160 kg x 5)"));
  assert.ok(strength.includes("+3.1%"));
  assert.ok(screen.getByText("Print"));

  await act(async () => { fireEvent.click(screen.getByText("‹ All reports")); });
  await screen.findByText("Progress reports");
});
