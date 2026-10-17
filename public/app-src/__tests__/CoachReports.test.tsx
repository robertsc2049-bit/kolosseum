// The coach's progress reports: one for every week, block, cycle, programme
// and year, or from a set date - each summed up, set against the one
// before, printable, and sendable to the athlete as their own copy.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachReports } from "../screens/coach/CoachReports";
import { AthleteProgressReportsPanel } from "../screens/athlete/AthleteProgressReports";
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
    execution: { reps_hit_pct: 94, sets_logged_pct: 98, load_vs_plan_pct: 2.5, effort_creep: [{ exercise_id: "back_squat", name: "Back squat", scale: "cr10", scale_label: "CR10", load_kg: 150, early: 6, late: 8, effort_change: 2 }], effort_targets: [{ exercise_id: "sled_push", name: "Sled push", scale: "borg", target: 13, target_max: null, rated_average: 15, ratings: 4, diff: 2 }], most_missed: [], most_skipped: [] },
    wellbeing: { check_ins: 20, readiness_average: 11.2, low_weeks: 0, energy: 4, motivation: 4, sleep: 3.5 },
    pain: { reports: 0, areas: [] },
    exercises: [
      { exercise_id: "back_squat", name: "Back squat", pattern: "squat", sessions: 12, sets: 48, reps: 220, tonnage_kg: 31000, top_set: { load_kg: 160, reps: 5 }, average_effort: 8.1, effort_scale: "rpe", intensity_pct: 76 },
      { exercise_id: "pull_up", name: "Pull-up", pattern: "vertical_pull", sessions: 8, sets: 24, reps: 230, tonnage_kg: 0, top_set: null, best_bodyweight_reps: 12, average_effort: 6, effort_scale: "cr10", intensity_pct: null },
      { exercise_id: "sled_push", name: "Sled push", pattern: null, sessions: 4, sets: 16, reps: 0, tonnage_kg: 0, top_set: null, distance_m: 320, average_effort: 15, effort_scale: "borg", intensity_pct: null }
    ],
    bodyweight_strength: [{ exercise_id: "pull_up", name: "Pull-up", first: 9, latest: 12, best: 12, change: 3 }],
    intensity: { sets: 40, zones: [{ zone: "under 60%", sets: 0, pct: 0 }, { zone: "60-70%", sets: 8, pct: 20 }, { zone: "70-80%", sets: 24, pct: 60 }, { zone: "80-90%", sets: 8, pct: 20 }, { zone: "90% +", sets: 0, pct: 0 }], by_exercise: [{ exercise_id: "back_squat", name: "Back squat", sets: 40, average_pct: 76, top_pct: 85 }] },
    effort_rated_by: { rpe: 12, cr10: 8, borg: 4 },
    effort_bands: [{ band: "6 or less", ratings: 1, pct: 5 }, { band: "7", ratings: 4, pct: 20 }, { band: "8", ratings: 10, pct: 50 }, { band: "9", ratings: 5, pct: 25 }, { band: "10", ratings: 0, pct: 0 }],
    effort_rated: 20,
    patterns: [{ pattern: "squat", sets: 48 }, { pattern: "hinge", sets: 30 }],
    bodyweight: [{ value: 92.5, unit: "kg", date: "2026-09-01" }, { value: 93.4, unit: "kg", date: "2026-09-28" }],
    session_log: [{ session_id: "s1", date: "2026-09-07", title: "Squat day", status: "completed", sets: 18, minutes: 70, effort: 8, load: 560, pain: true, skipped: 1 }]
  },
  compared: { sessions_completed: 1, adherence_pct: 4, sets_pct: 8, tonnage_pct: 12, load_weekly_average_pct: 9, reps_hit_pct: 2, readiness_average: -0.4, pain_reports: 0, strength: [{ exercise_id: "back_squat", name: "Back squat", change_pct: 3.1 }] },
  analysis: { weeks: ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"], load: { rows: [] }, volume: { rows: [] }, adherence: { rows: [] } }
};
const athleteCopy = {
  period: { type: "block", label: "Volume - Meet prep", start: "2026-09-07", end: "2026-10-04", complete: true },
  coach: { name: "Coach Sam", message: "" },
  sessions: { completed: 11, partial: 1, planned: 12, minutes: 720 },
  weeks: [{ week_start: "2026-09-07", sessions: 3, planned: 3 }, { week_start: "2026-09-14", sessions: 3, planned: 3 }],
  training: { sets: 210, tonnage_kg: 48210 },
  exercises: [{ name: "Back squat", sessions: 12, sets: 48, reps: 220, best_set: { load_kg: 160, reps: 5 }, average_effort: 8.1, effort_scale: "rpe" }],
  wellbeing: { check_ins: 20, energy: 4, motivation: 4, sleep: 3.5 },
  pain: { reports: 1, areas: [{ area: "knee", reports: 1 }] }
};
const posts: Array<{ path: string; body: Record<string, unknown>; csrf: string | null }> = [];

function installMocks() {
  const paths: string[] = [];
  posts.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    paths.push(path);
    if (init?.method === "POST") {
      const headers = (init.headers ?? {}) as Record<string, string>;
      posts.push({ path, body: typeof init.body === "string" ? JSON.parse(init.body) : {}, csrf: headers["x-kolosseum-csrf"] ?? null });
      return jsonResponse({ ok: true, report_id: "cpr_1", sent: true });
    }
    if (path === "/account/detail") return jsonResponse({ ok: true, csrf_token: "csrf-1" });
    if (path.endsWith("/athlete-copy")) return jsonResponse({ ok: true, report: athleteCopy });
    if (path === "/coach-workspace/athletes/a1/reports/custom/2026-09-23_2026-10-06") {
      return jsonResponse({ ...report, period: { type: "custom", id: "2026-09-23_2026-10-06", label: "23 Sep – 6 Oct 2026", start: "2026-09-21", end: "2026-10-11", from: "2026-09-23", to: "2026-10-06", complete: true, weeks: 3 } });
    }
    if (path === "/account/onboarding/progress-reports") {
      return jsonResponse({ ok: true, reports: [{ report_id: "cpr_1", sent_at: "2026-10-05T09:00:00.000Z", report: { ...athleteCopy, coach: { name: "Coach Sam", message: "Great block - squat is moving." } } }] });
    }
    if (path === "/coach-workspace/athletes/a1/reports") return jsonResponse(list);
    if (path === "/coach-workspace/athletes/a1/reports/block/asg_1%3A0") return jsonResponse(report);
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  return paths;
}

async function openVolumeBlock() {
  render(<CoachReports athleteUserId="a1" />);
  await screen.findByText("Week of 12 Oct");
  await act(async () => { fireEvent.click(screen.getByText("Block (2)")); });
  await act(async () => { fireEvent.click(screen.getByText("Volume - Meet prep")); });
  await screen.findByTestId("report-body");
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
  assert.ok(screen.getByText(/Cycles follow the athlete's training plan/));

  await act(async () => { fireEvent.click(screen.getByText("Block (2)")); });
  await act(async () => { fireEvent.click(screen.getByText("Volume - Meet prep")); });
  await screen.findByTestId("report-body");
  assert.ok(paths.includes("/coach-workspace/athletes/a1/reports/block/asg_1%3A0"));
  const tiles = screen.getByTestId("report-tiles").textContent ?? "";
  assert.ok(tiles.includes("Sessions (12 planned)11 + 1 part"));
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

test("the report has every exercise, how hard it felt, sets by movement, bodyweight and every session", async () => {
  installMocks();
  await openVolumeBlock();
  assert.ok(screen.getByTestId("report-exercises").textContent?.includes("160 kg x 5"));
  assert.ok(screen.getByTestId("report-effort").textContent?.includes("50%"));
  assert.ok(screen.getByTestId("report-patterns").textContent?.includes("Hinge: 30 sets"));
  assert.ok(screen.getByTestId("report-patterns").textContent?.includes("93.4 kg"));
  const sessionsLog = screen.getByTestId("report-sessions");
  assert.ok(sessionsLog.textContent?.includes("Squat day"));
  assert.ok(sessionsLog.textContent?.includes("Pain reported, 1 skipped"));
});

test("a coach compiles a report from a set date to another", async () => {
  const paths = installMocks();
  render(<CoachReports athleteUserId="a1" />);
  await screen.findByText("Week of 12 Oct");
  await act(async () => { fireEvent.click(screen.getByText("Custom dates")); });
  const [from, to] = [...document.querySelectorAll(".report-custom input[type=date]")] as HTMLInputElement[];
  await act(async () => { fireEvent.change(from, { target: { value: "2026-09-23" } }); });
  await act(async () => { fireEvent.change(to, { target: { value: "2026-10-06" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Compile report")); });
  await screen.findByTestId("report-body");
  assert.ok(paths.includes("/coach-workspace/athletes/a1/reports/custom/2026-09-23_2026-10-06"));
  assert.ok(screen.getByTestId("report-body").textContent?.includes("23 Sep – 6 Oct 2026"), "the exact dates, not the whole weeks");
});

test("a coach sends the athlete their copy with a message - previewed first, sent once", async () => {
  installMocks();
  await openVolumeBlock();
  await act(async () => { fireEvent.click(screen.getByText("Send to athlete")); });
  await screen.findByText("What they'll see");
  const preview = screen.getByTestId("report-send").querySelector("[data-testid=athlete-report-body]")?.textContent ?? "";
  assert.ok(preview.includes("160 kg × 5"), "their best set");
  assert.equal(/estimated|load ratio|AU/.test(preview), false, "no coach-only numbers");
  await act(async () => { fireEvent.change(screen.getByPlaceholderText("What went well, and what's next."), { target: { value: "Great block - squat is moving." } }); });
  await act(async () => { fireEvent.click(screen.getByText("Send report")); });
  await screen.findByText(/Sent to Jordan/);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, "/coach-workspace/athletes/a1/reports/block/asg_1%3A0/send");
  assert.equal(posts[0].body.message, "Great block - squat is moving.");
  assert.match(String(posts[0].body.client_request_id), /^rpt_/);
  assert.equal(posts[0].csrf, "csrf-1");
  assert.equal((screen.getByText("Sent") as HTMLButtonElement).disabled, true, "can't send twice");
});

test("the athlete finds the report in History: their coach's message and the weights they lifted", async () => {
  installMocks();
  render(<AthleteProgressReportsPanel />);
  await screen.findByText("Reports from your coach");
  await act(async () => { fireEvent.click(screen.getByText("Block report: Volume - Meet prep")); });
  const body = (await screen.findByTestId("athlete-report-body")).textContent ?? "";
  assert.ok(body.includes("Great block - squat is moving."));
  assert.ok(body.includes("160 kg × 5"));
  assert.ok(body.includes("knee (1)"));
  assert.equal(/estimated|%/.test(body), false, "no maxes or percentages");
  assert.ok(screen.getByText("Print"));
});

test("every part of a report, and sending it, explains itself", async () => {
  installMocks();
  render(<CoachReports athleteUserId="a1" />);
  await screen.findByText("Week of 12 Oct");
  assert.ok(screen.getByTestId("explain-reports").textContent?.includes("Custom dates: any two dates"));
  await act(async () => { fireEvent.click(screen.getByText("Block (2)")); });
  await act(async () => { fireEvent.click(screen.getByText("Volume - Meet prep")); });
  await screen.findByTestId("report-body");
  for (const id of ["report_overview", "report_strength", "report_weeks", "report_exercises", "report_effort", "report_patterns", "report_bodyweight", "report_sessions", "report_plan", "report_wellbeing"]) {
    assert.ok(screen.getByTestId(`explain-${id}`).textContent?.includes("How to read it"), `${id} is explained`);
  }
  await act(async () => { fireEvent.click(screen.getByText("Send to athlete")); });
  assert.ok(screen.getByTestId("explain-report_send").textContent?.includes("never shows estimated maxes"));
});

test("every loading type in a report: % of max zones, bodyweight bests, distance, effort in RPE, CR10 and Borg, targets met or missed", async () => {
  installMocks();
  await openVolumeBlock();
  const intensity = screen.getByTestId("report-intensity").textContent ?? "";
  assert.ok(intensity.includes("60%") && intensity.includes("70-80%"));
  assert.ok(intensity.includes("Back squat: 40 sets, 76% of max on average, heaviest 85%"));
  const exercises = screen.getByTestId("report-exercises").textContent ?? "";
  assert.ok(exercises.includes("160 kg x 5"));
  assert.ok(exercises.includes("12 reps (bodyweight)"));
  assert.ok(exercises.includes("320 m"));
  assert.ok(exercises.includes("CR10 6") && exercises.includes("Borg 15") && exercises.includes("RPE 8.1"));
  assert.ok(screen.getByTestId("report-bodyweight-strength").textContent?.includes("Pull-up (bodyweight): best set 9 → 12 reps"));
  const body = screen.getByTestId("report-body").textContent ?? "";
  assert.ok(body.includes("Sled push: Borg 13 set, rated 15 on average (+2)"));
  assert.ok(body.includes("Back squat at 150 kg: CR10 6 → 8"));
  assert.ok(body.includes("Weight against the plan: +2.5%"));
  assert.ok(body.includes("RPE 12, CR10 8, Borg 4"));
});

test("each headline number says what usual looks like - the athlete's own normal, or the general guide", async () => {
  installMocks();
  const original = report.summary as Record<string, unknown>;
  original.baseline = { weekly_load: 4800, readiness: { average: 12.4, low: 12, high: 13, check_ins: 20 } };
  await openVolumeBlock();
  const tiles = screen.getByTestId("report-tiles").textContent ?? "";
  assert.ok(tiles.includes("Their usual: 12-13"), tiles);
  assert.ok(tiles.includes("Their usual before this: 4,800"));
  assert.ok(tiles.includes("On track: 90%+"));
  assert.ok(tiles.includes("5,250 points"), "load points, not AU");
  assert.equal(tiles.includes("AU"), false);
  delete original.baseline;
});
