// Coach Analysis on real, gappy logs (walkthrough 20): corrected sets and
// ratings, sessions nobody rated, a lighter block, and check-ins that stopped.
import assert from "node:assert/strict";
import test from "node:test";

import { analyseAthlete, findings, latestEntries } from "../dist/src/api/coach_analysis_metrics.js";

const TODAY = "2026-11-24";
const plus = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const at = (date, hh, mm = 0) => `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`;
const monday = (weeksAgo) => plus("2026-11-23", -7 * weeksAgo);

function session(date, { load = 100, reps = 5, rpe = null, lift = "back_squat", done = load, planned = { load_kg: load } } = {}) {
  return {
    session_id: `s_${date}_${lift}`, status: "completed", created_at: at(date, 18),
    planned: [{ exercise_id: lift, segment: "working", sets: 3, reps_target: 5, role: "primary", intensity_type: "percent_1rm", ...planned }],
    events: [
      { type: "START_SESSION", at: at(date, 18) },
      ...[1, 2, 3].map((set) => ({ type: "SET_LOG_REPORT", at: at(date, 18, 10 * set), exercise_id: lift, set_index: set, reps, load_kg: done })),
      ...(rpe === null ? [] : [{ type: "RPE_REPORT", at: at(date, 18, 40), exercise_id: lift, rpe }]),
      { type: "COMPLETE_EXERCISE", at: at(date, 19), exercise_id: lift }
    ]
  };
}
function analyse(sessions, extra = {}) {
  return analyseAthlete({
    today: TODAY, weeks: 12, sessions, readiness: [], checkins: [], planned_days_per_week: 3,
    exercise_name: (id) => id, is_strength_lift: () => true, ...extra
  });
}
const reportsFor = (list, report = { srpe: 7, minutes: 60 }) => Object.fromEntries(list.map((s) => [s.session_id, report]));
const weekOf = (n) => [0, 2, 4].map((day) => session(plus(monday(n), day)));
const has = (analysis, id) => findings(analysis).find((finding) => finding.id === id);

test("a corrected set or rating counts once, as it was last logged", () => {
  const date = plus(monday(1), 0);
  const typo = session(date);
  typo.events.splice(1, 0, { type: "SET_LOG_REPORT", at: at(date, 18, 5), exercise_id: "back_squat", set_index: 3, reps: 5, load_kg: 1000 });
  typo.events.push(
    { type: "RPE_REPORT", at: at(date, 18, 41), exercise_id: "back_squat", rpe: 10 },
    { type: "RPE_REPORT", at: at(date, 18, 42), exercise_id: "back_squat", rpe: 8 }
  );
  const kept = latestEntries(typo.events);
  assert.equal(kept.filter((event) => event.type === "SET_LOG_REPORT").length, 3);
  assert.deepEqual(kept.filter((event) => event.type === "RPE_REPORT").map((event) => event.rpe), [8]);
  const analysis = analyse([session(plus(monday(2), 0)), typo]);
  const last = analysis.volume.rows.find((row) => row.week_start === monday(1));
  assert.deepEqual([last.sets, last.tonnage_kg], [3, 1500], "the 1000 kg typo is gone");
  assert.ok(analysis.strength.lifts[0].peak < 140);
  assert.equal(analysis.exercises.rows[0].average_effort, 8);
});

test("sessions nobody rated aren't zero load: mostly unrated, the week isn't known; mostly rated, the rest count as their usual", () => {
  const weeks = [6, 5, 4, 3, 2, 1].map(weekOf);
  const all = weeks.flat();
  const lastWeek = weeks[5];
  const mostlyUnrated = analyse(all, { session_reports: reportsFor(all.filter((s) => !lastWeek.slice(1).includes(s))) });
  const row = mostlyUnrated.load.rows.find((entry) => entry.week_start === monday(1));
  assert.deepEqual([row.load, row.acute_chronic, row.ewma_ratio, row.unrated_sessions], [null, null, null, 2]);
  assert.equal(has(mostlyUnrated, "load"), undefined, "no made-up 67% drop, and no older week's figure either");
  assert.equal(has(mostlyUnrated, "load_unrated").text, "2 of 3 gym sessions last week weren't rated, so that week's load isn't known.");

  const oneMissed = analyse(all, { session_reports: reportsFor(all.filter((s) => s !== lastWeek[2])) });
  const filled = oneMissed.load.rows.find((entry) => entry.week_start === monday(1));
  assert.deepEqual([filled.load, filled.acute_chronic], [1260, 1], "420 + 420 + their usual 420");
  assert.equal(has(oneMissed, "load").level, "good");
  assert.equal(oneMissed.load.sessions.find((entry) => entry.session_id === lastWeek[2].session_id).load, null, "the session itself stays unrated");
});

test("an athlete who never rates gym sessions is still followed on their other training", () => {
  const all = [6, 5, 4, 3, 2, 1].flatMap(weekOf);
  const other = [6, 5, 4, 3, 2, 1].map((n) => ({ id: `m${n}`, date: plus(monday(n), 5), kind: "match", minutes: 90, srpe: 8 }));
  const analysis = analyse(all, { other_training: other });
  assert.equal(analysis.load.rows.find((row) => row.week_start === monday(1)).load, 720);
});

test("a lighter block done as set isn't a falling lift; coming up short in it is", () => {
  const block = [110, 112.5, 115, 117.5, 105].map((load, index) => session(plus(monday(5 - index), 0), { load }));
  const obedient = analyse(block);
  const lift = obedient.strength.lifts[0];
  assert.deepEqual([lift.status, lift.change_pct, lift.plan_limited], ["steady", null, true]);
  assert.equal(has(obedient, "strength_back_squat"), undefined);
  const short = analyse([...block.slice(0, 4), session(plus(monday(1), 0), { load: 117.5, done: 100, reps: 4 })]);
  assert.equal(short.strength.lifts[0].status, "falling");
  assert.equal(has(short, "strength_back_squat").level, "alert");
});

test("rated weeks then an unrated one on an RPE programme isn't a fall", () => {
  const free = { planned: { load_kg: null, intensity_type: "rpe", target_effort: 7 } };
  const list = [4, 3, 2].map((n) => session(plus(monday(n), 0), { rpe: 7, ...free }));
  const analysis = analyse([...list, session(plus(monday(1), 0), free)]);
  assert.notEqual(analysis.strength.lifts[0].status, "falling");
  const never = analyse([120, 120, 120, 105].map((load, index) => session(plus(monday(4 - index), 0), { load, ...free })));
  assert.equal(never.strength.lifts[0].status, "falling", "never rated: the weights they pick are the evidence");
});

test("a lift getting harder isn't hidden by another getting easier, and only the same reps compare", () => {
  const early = [9, 8].flatMap((n) => [session(plus(monday(n), 0), { rpe: 7 }), session(plus(monday(n), 2), { rpe: 10, lift: "deadlift" })]);
  const late = [2, 1].flatMap((n) => [session(plus(monday(n), 0), { rpe: 9 }), session(plus(monday(n), 2), { rpe: 6, lift: "deadlift" })]);
  const text = findings(analyse([...early, ...late])).map((finding) => finding.text).join("\n");
  assert.match(text, /RPE 7 → 9/u);
  const moreReps = analyse([early[0], session(plus(monday(1), 0), { rpe: 9, reps: 8, planned: { load_kg: 100, reps_target: 8 } })]);
  assert.equal(moreReps.execution.effort_creep.length, 0, "8 reps at that weight should feel harder than 5");
});

test("a bad readiness week stops being news once it's older than last week, and reads the right way round", () => {
  const days = (n, value) => [0, 1, 2, 3, 4].map((day) => ({ date: plus(monday(n), day), sleep: value, soreness: value === 4 && day % 2 ? 3 : value, stress: value }));
  const sessions = [6, 5, 4, 3, 2, 1].flatMap(weekOf);
  const old = analyse(sessions, { readiness: [...days(6, 4), ...days(5, 4), ...days(3, 1)] });
  assert.equal(has(old, "readiness"), undefined);
  const lastWeek = analyse(sessions, { readiness: [...days(3, 4), ...days(2, 4), ...days(1, 1)] });
  assert.match(has(lastWeek, "readiness").text, /last week \(sleep 1, soreness 1, stress 1 - each from 1 poor to 5 great\)/u);
});
