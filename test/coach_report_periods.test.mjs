// Coach progress reports: the periods a report covers (weeks, programme
// blocks, training-cycle phases, programmes, years) and each report summed
// up and compared with the one before.
import assert from "node:assert/strict";
import test from "node:test";

import {
  compareReports, cyclePeriods, programmePeriods, summariseReport, weekPeriods, weeksIn, yearPeriods
} from "../dist/src/api/coach_report_periods.js";
import { analyseAthlete } from "../dist/src/api/coach_analysis_metrics.js";

const TODAY = "2026-10-17"; // a Saturday

test("a weekly report for every week since their first session, this week still going", () => {
  const weeks = weekPeriods("2026-09-23", TODAY);
  assert.deepEqual(weeks.map((week) => week.start), ["2026-10-12", "2026-10-05", "2026-09-28", "2026-09-21"].reverse());
  assert.equal(weeks[0].end, "2026-09-27");
  assert.equal(weeks.at(-1).complete, false);
  assert.equal(weeks.slice(0, -1).every((week) => week.complete), true);
  assert.deepEqual(weekPeriods(null, TODAY), []);
});

test("yearly reports run on ISO years: 2025's ends the week of 28 Dec, this year's is still going", () => {
  const years = yearPeriods("2025-11-03", TODAY);
  assert.deepEqual(years.map((year) => year.id), ["2025", "2026"]);
  assert.equal(years[0].start, "2024-12-30");
  assert.equal(years[0].end, "2025-12-28");
  assert.equal(years[0].complete, true);
  assert.equal(years[1].start, "2025-12-29");
  assert.equal(years[1].end, "2026-10-18");
  assert.equal(years[1].complete, false);
});

test("a powerlifter's cycles: 4 weeks of accumulation then intensification, each its own report", () => {
  const phase = (monday) => (monday < "2026-10-05" ? "accumulation" : "intensification");
  const cycles = cyclePeriods("2026-09-07", TODAY, phase);
  assert.equal(cycles.length, 2);
  assert.equal(cycles[0].start, "2026-09-07");
  assert.equal(cycles[0].end, "2026-10-04");
  assert.equal(weeksIn(cycles[0]), 4);
  assert.equal(cycles[0].complete, true);
  assert.match(cycles[0].label, /^Accumulation/);
  assert.equal(cycles[1].complete, false);
  assert.deepEqual(cyclePeriods("2026-09-07", TODAY, () => null), [], "no training plan, no cycles");
});

test("a coach's 8-week programme: one programme report and one per block, the last block still going", () => {
  const sessions = [];
  for (let week = 0; week < 6; week += 1) {
    for (const day of [0, 2, 4]) {
      const date = new Date(Date.UTC(2026, 8, 7 + week * 7 + day)).toISOString().slice(0, 10);
      sessions.push(week < 4
        ? { date, block_key: "b1|1", block_name: "Volume", block_type: "volume" }
        : { date, block_key: "b2|2", block_name: "Strength", block_type: "strength" });
    }
  }
  const periods = programmePeriods([{ id: "asg_1", name: "Meet prep", current: true, sessions }], TODAY);
  const programme = periods.find((period) => period.type === "programme");
  const blocks = periods.filter((period) => period.type === "block");
  assert.equal(programme.label, "Meet prep");
  assert.equal(programme.start, "2026-09-07");
  assert.equal(programme.complete, false);
  assert.equal(programme.detail, "18 sessions");
  assert.deepEqual(blocks.map((block) => block.label), ["Volume - Meet prep", "Strength - Meet prep"]);
  assert.equal(blocks[0].end, "2026-10-04");
  assert.equal(blocks[0].complete, true);
  assert.equal(blocks[0].detail, "volume block");
  assert.equal(blocks[1].complete, false);
  assert.equal(blocks[1].end, "2026-10-18");

  const finished = programmePeriods([{ id: "run_1", name: "Old programme", current: false, sessions: sessions.slice(0, 3) }], TODAY);
  assert.equal(finished.find((period) => period.type === "programme").end, "2026-09-13");
  assert.equal(finished.every((period) => period.complete), true);
});

// Three weeks of a lifter squatting 3x a week, getting stronger.
function threeWeeks(startLoad) {
  const sessions = [];
  let n = 0;
  for (let week = 0; week < 3; week += 1) {
    for (const day of [0, 2, 4]) {
      const date = new Date(Date.UTC(2026, 8, 21 + week * 7 + day, 9)).toISOString();
      const end = new Date(Date.parse(date) + 60 * 60000).toISOString();
      const load = startLoad + week * 5;
      sessions.push({
        session_id: `s${n += 1}`, status: "completed", created_at: date,
        planned: [{ exercise_id: "back_squat", segment: "working", role: "primary", sets: 3, reps_target: 5, load_kg: load }],
        events: [
          { type: "START_SESSION", at: date },
          ...[1, 2, 3].map((set) => ({ type: "SET_LOG_REPORT", at: date, exercise_id: "back_squat", reps: 5, load_kg: load, set_index: set })),
          { type: "RPE_REPORT", at: end, exercise_id: "back_squat", rpe: 8 },
          { type: "COMPLETE_EXERCISE", at: end, exercise_id: "back_squat" }
        ]
      });
    }
  }
  return sessions;
}

const analyse = (sessions, closed = true) => analyseAthlete({
  today: "2026-10-11", weeks: 3, closed, sessions, readiness: [], checkins: [], planned_days_per_week: 3,
  exercise_name: (id) => id.replaceAll("_", " "), is_strength_lift: () => true
});

test("a 3-week report sums the period: 9 sessions of 9, 27 sets, the squat's estimated max start to end", () => {
  const summary = summariseReport(analyse(threeWeeks(140)));
  assert.equal(summary.sessions.completed, 9);
  assert.equal(summary.sessions.planned, 9, "a closed period counts its last week too");
  assert.equal(summary.sessions.adherence_pct, 100);
  assert.equal(summary.training.sets, 27);
  assert.equal(summary.training.tonnage_kg, 3 * 15 * (140 + 145 + 150));
  assert.equal(summary.execution.reps_hit_pct, 100);
  const squat = summary.strength[0];
  assert.equal(squat.name, "back squat");
  assert.ok(squat.end > squat.start);
  assert.ok(squat.change_pct > 0);
  assert.equal(summary.pain.reports, 0);
});

test("compared with the report before: more tonnage, a stronger squat", () => {
  const before = summariseReport(analyse(threeWeeks(130)));
  const now = summariseReport(analyse(threeWeeks(140)));
  const compared = compareReports(now, before);
  assert.ok(compared.tonnage_pct > 0);
  assert.equal(compared.sessions_completed, 0);
  assert.equal(compared.adherence_pct, 0);
  assert.ok(compared.strength[0].change_pct > 0);
  assert.equal(compareReports(now, null), null, "the first report has nothing to compare with");
});
