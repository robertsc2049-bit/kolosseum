// Load a coach can trust: a gym session the athlete rated when they
// finished (effort x minutes) is measured; one they didn't is estimated and
// said to be; team practice and matches count too; competitions, matches
// and deload blocks are marked on the weeks they fall in.
import assert from "node:assert/strict";
import test from "node:test";

import { analyseAthlete, findings } from "../dist/src/api/coach_analysis_metrics.js";

const TODAY = "2026-10-18"; // a Sunday
const at = (date, minutes = 0) => new Date(Date.parse(`${date}T17:00:00Z`) + minutes * 60_000).toISOString();
// A rugby back's gym sessions: two a week, each squat 3x5 rated RPE 8, and
// 50 minutes by the app's own timings.
function gym(date, id) {
  return {
    session_id: id, status: "completed", created_at: at(date), planned: [],
    events: [
      { type: "START_SESSION", at: at(date) },
      ...[1, 2, 3].map((set) => ({ type: "SET_LOG_REPORT", at: at(date, 10 * set), exercise_id: "back_squat", set_index: set, reps: 5, load_kg: 120 })),
      { type: "RPE_REPORT", at: at(date, 50), exercise_id: "back_squat", rpe: 8 }
    ]
  };
}
const weeks = ["2026-09-28", "2026-10-05", "2026-10-12"];
const sessions = weeks.flatMap((week, w) => [gym(week, `g${w}a`), gym(new Date(Date.parse(`${week}T00:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10), `g${w}b`)]);

const analyse = (extra = {}) => analyseAthlete({
  today: TODAY, weeks: 3, sessions, readiness: [], checkins: [], planned_days_per_week: 2,
  exercise_name: (id) => id, is_strength_lift: () => true, ...extra
});

test("a session rated when it was finished is measured: their effort x their minutes, not the app's timings", () => {
  const estimated = analyse();
  const row = estimated.load.sessions.find((s) => s.session_id === "g0a");
  assert.equal(row.measured, false);
  assert.equal(row.load, 8 * 50, "estimated: exercise rating 8 x 50 minutes from the app");
  const measured = analyse({ session_reports: { g0a: { srpe: 6, minutes: 75 } } });
  const rated = measured.load.sessions.find((s) => s.session_id === "g0a");
  assert.deepEqual([rated.measured, rated.effort, rated.minutes, rated.load], [true, 6, 75, 450]);
  assert.equal(measured.load.quality.measured, 1);
  assert.equal(measured.load.quality.gym_sessions, 6);
});

test("mostly estimated loads say so, with what to ask the athlete", () => {
  const list = findings(analyse());
  const note = list.find((f) => f.id === "load_estimated");
  assert.equal(note.text, "100% of gym session loads are estimated from the app's timings - the athlete didn't rate them when they finished.");
  assert.match(note.action, /rate each session/u);
  const rated = Object.fromEntries(sessions.map((s) => [s.session_id, { srpe: 7, minutes: 60 }]));
  assert.equal(findings(analyse({ session_reports: rated })).some((f) => f.id === "load_estimated"), false);
});

test("team practice and a match count towards the week's load, split gym and sport", () => {
  const other = [
    { id: "p1", date: "2026-10-13", kind: "practice", minutes: 90, srpe: 6 },
    { id: "p2", date: "2026-10-15", kind: "practice", minutes: 90, srpe: 5 },
    { id: "m1", date: "2026-10-17", kind: "match", minutes: 80, srpe: 9, note: "v Northside" }
  ];
  const a = analyse({ other_training: other });
  const week = a.load.rows.find((row) => row.week_start === "2026-10-12");
  assert.equal(week.gym_load, 800, "2 gym sessions x 400");
  assert.equal(week.sport_load, 540 + 450 + 720);
  assert.equal(week.load, 800 + 1710);
  assert.equal(week.matches, 1);
  const match = a.load.sessions.find((s) => s.session_id === "m1");
  assert.deepEqual([match.title, match.kind, match.load, match.note], ["Match", "match", 720, "v Northside"]);
  // A week with matches and practice against gym-only weeks before it.
  assert.ok(week.acute_chronic === null || week.acute_chronic > 1, "sport load raises the week against their usual");
});

test("competitions, matches and deload blocks are marked on the weeks they fall in - only inside the period", () => {
  const a = analyse({
    other_training: [{ id: "m1", date: "2026-10-17", kind: "match", minutes: 80, srpe: 9, note: "v Northside" }],
    markers: [
      { date: "2026-10-06", kind: "deload", label: "Deload: Week 4" },
      { date: "2026-10-16", kind: "competition", label: "Competition" },
      { date: "2026-08-01", kind: "season", label: "Season starts" },
      { date: "2026-11-20", kind: "competition", label: "Competition" }
    ]
  });
  assert.deepEqual(a.markers.map((m) => [m.week_start, m.kind, m.label]), [
    ["2026-10-05", "deload", "Deload: Week 4"],
    ["2026-10-12", "competition", "Competition"],
    ["2026-10-12", "match", "Match: v Northside"]
  ]);
});
