// The gym fits around the sport: the day after a match a self-directed
// winger gets no jumps and lighter legs; after 250 jumps at volleyball
// practice, no plyometrics; an ordinary week changes nothing. Fast bowlers'
// and jumpers' counts show in the coach's load table, with spikes flagged.
import assert from "node:assert/strict";
import test from "node:test";

import { applySportLoad, sportLoadNote, sportLoadToday } from "../dist/src/api/sport_load_session.js";
import { analyseAthlete, findings } from "../dist/src/api/coach_analysis_metrics.js";

const TODAY = "2026-10-18";
const day = (n) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const PATTERN = { countermovement_jump: "jump_vertical", drop_to_stick: "jump_vertical", trap_bar_deadlift: "hinge", split_squat: "lunge", bench_press: "horizontal_push" };
const session = [
  { exercise_id: "countermovement_jump", sets: 4, reps: 3, intensity: { type: "bodyweight" } },
  { exercise_id: "drop_to_stick", sets: 3, reps: 4, intensity: { type: "bodyweight" } },
  { exercise_id: "trap_bar_deadlift", sets: 4, reps: 4, intensity: { type: "percent_1rm", value: 80 } },
  { exercise_id: "split_squat", sets: 3, reps: 6, intensity: { type: "rpe", value: 8 } },
  { exercise_id: "bench_press", sets: 4, reps: 5, intensity: { type: "percent_1rm", value: 78 } }
];
const practice = (n, extra = {}) => ({ date: day(n), kind: "practice", minutes: 75, srpe: 5, ...extra });

test("the day after a match: no jumps (landing drills stay), heavy legs a set shorter and lighter, upper body untouched", () => {
  const today = sportLoadToday([practice(3), { date: day(1), kind: "match", minutes: 80, srpe: 8 }], TODAY);
  assert.equal(today.reason, "match");
  const { exercises, adjustment } = applySportLoad(session, today, (id) => PATTERN[id]);
  assert.deepEqual(exercises.map((x) => x.exercise_id), ["drop_to_stick", "trap_bar_deadlift", "split_squat", "bench_press"]);
  assert.deepEqual([exercises[1].sets, exercises[1].intensity.value], [3, 75]);
  assert.deepEqual([exercises[2].sets, exercises[2].intensity.value], [2, 7]);
  assert.deepEqual(exercises[3], session[4]);
  assert.deepEqual(adjustment.removed, ["countermovement_jump"]);
  assert.equal(sportLoadNote(adjustment), "Lighter today after your match: no jumps today, and your heavy leg work a set shorter and a little lighter.");
});

test("a big practice day against their usual, or 200+ jumps in two days, does the same; a normal week doesn't", () => {
  const usual = Array.from({ length: 20 }, (_, i) => practice(i + 3));
  assert.equal(sportLoadToday([...usual, practice(1, { minutes: 120, srpe: 8 })], TODAY).reason, "big_sport_day");
  assert.equal(sportLoadToday([...usual, practice(1, { jumps: 250 })], TODAY).reason, "jump_load");
  const normal = sportLoadToday([...usual, practice(1)], TODAY);
  assert.equal(normal.reason, null);
  assert.equal(applySportLoad(session, normal, (id) => PATTERN[id]).adjustment, null);
});

test("the coach sees jumps and balls bowled per week, and a fast bowler's spike is an alert", () => {
  const other = [];
  for (let w = 6; w >= 1; w -= 1) other.push({ id: `b${w}`, date: day(w * 7 + 1), kind: "match", minutes: 90, srpe: 6, balls_bowled: w === 1 ? 240 : 90, jumps: 60 });
  const a = analyseAthlete({ today: TODAY, weeks: 4, sessions: [], readiness: [], checkins: [], planned_days_per_week: 3, exercise_name: (id) => id, is_strength_lift: () => false, other_training: other });
  const rows = a.load.rows.filter((row) => row.balls_bowled !== null && row.balls_bowled !== undefined);
  assert.ok(rows.length >= 2);
  const spike = findings(a).find((f) => f.id === "bowling_spike");
  assert.ok(spike, "240 balls against 90 a week");
  assert.equal(spike.level, "alert");
  assert.match(spike.action, /lumbar stress/u);
});
