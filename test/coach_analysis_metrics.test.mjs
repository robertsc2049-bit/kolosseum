// Coach Analysis metrics, against hand-worked numbers: the RTS chart, Foster
// session load, acute:chronic, monotony, readiness against the athlete's own
// normal, and the findings a coach reads.
import assert from "node:assert/strict";
import test from "node:test";

import {
  acuteChronic, analyseAthlete, attentionScore, estimatedMax, findings, monotony, rtsPercent,
  sessionEffort, sessionLoad, sessionMinutes, weekStart, weekStarts
} from "../dist/src/api/coach_analysis_metrics.js";

test("weeks start on Monday (UTC) and the window ends with the current week", () => {
  assert.equal(weekStart("2026-10-17"), "2026-10-12");
  assert.equal(weekStart("2026-10-12"), "2026-10-12");
  assert.deepEqual(weekStarts("2026-10-17", 3), ["2026-09-28", "2026-10-05", "2026-10-12"]);
});

test("the RTS chart: 1 @ 10 is 100%, 3 @ 8 is 86.3%, 10 @ 6 is 62.6%; outside it, no estimate", () => {
  assert.equal(rtsPercent(1, 10), 100);
  assert.equal(rtsPercent(3, 8), 86.3);
  assert.equal(rtsPercent(10, 6), 62.6);
  assert.equal(rtsPercent(5, 5), null);
  assert.equal(rtsPercent(12, 8), null);
});

test("estimated max: RTS when the effort was rated, Epley when not; nothing past 10 reps", () => {
  assert.deepEqual(estimatedMax(300, 3, 8), { value: 347.6, method: "rts" }, "300 x 3 @ 8 is about 348, not the 343 a mis-read chart gives");
  assert.deepEqual(estimatedMax(100, 5, null), { value: 116.7, method: "epley" });
  assert.deepEqual(estimatedMax(140, 1, null), { value: 140, method: "epley" });
  assert.equal(estimatedMax(60, 12, null), null);
});

const at = (date, hh, mm) => `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`;

test("Foster session load: mean effort (Borg rescaled to 0-10) x minutes from start to the last event", () => {
  const events = [
    { type: "START_SESSION", at: at("2026-10-12", 18, 0) },
    { type: "RPE_REPORT", at: at("2026-10-12", 18, 20), exercise_id: "back_squat", rpe: 8 },
    { type: "BORG_REPORT", at: at("2026-10-12", 18, 40), exercise_id: "row", borg: 13 },
    { type: "COMPLETE_EXERCISE", at: at("2026-10-12", 19, 0), exercise_id: "row" }
  ];
  assert.equal(sessionEffort(events), 6.5, "RPE 8 and Borg 13 (= 5 on 0-10)");
  assert.equal(sessionMinutes(events), 60);
  assert.equal(sessionLoad(events), 390);
  assert.equal(sessionLoad([{ type: "START_SESSION", at: at("2026-10-12", 18, 0) }]), null, "no ratings, no load");
});

test("acute:chronic is this week over the mean of the previous 4, and needs all 4", () => {
  assert.equal(acuteChronic([1000, 1000, 1000, 1000, 1500], 4), 1.5);
  assert.equal(acuteChronic([null, 1000, 1000, 1000, 800], 4), null);
  assert.equal(acuteChronic([1000, 1000, 1000], 2), null);
});

test("monotony is mean daily load over its SD (rest days count); the same load every day has none", () => {
  assert.equal(monotony([300, 0, 300, 0, 300, 0, 0]), 0.8, "mean 128.6 / sample SD 160.4");
  assert.equal(monotony([300, 300, 300, 300, 300, 300, 300]), null);
  assert.equal(monotony([0, 0, 0, 0, 0, 0, 0]), null);
});

// A powerlifter training Mon/Wed/Fri for 8 weeks: squat climbing, bench
// stuck, a knee that keeps coming back and a bad readiness week at the end.
function powerlifter() {
  const weeks = weekStarts("2026-10-17", 8);
  const sessions = [];
  weeks.forEach((week, w) => {
    [0, 2, 4].forEach((offset, d) => {
      const date = new Date(Date.parse(`${week}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
      if (date > "2026-10-17") return;
      const squat = 120 + w * 2.5;
      const events = [{ type: "START_SESSION", at: at(date, 18, 0) }];
      for (let s = 1; s <= 3; s += 1) events.push({ type: "SET_LOG_REPORT", at: at(date, 18, 5 + s * 4), exercise_id: "back_squat", set_index: s, reps: 5, load_kg: squat });
      events.push({ type: "RPE_REPORT", at: at(date, 18, 20), exercise_id: "back_squat", rpe: 8 });
      for (let s = 1; s <= 3; s += 1) events.push({ type: "SET_LOG_REPORT", at: at(date, 18, 25 + s * 4), exercise_id: "bench_press", set_index: s, reps: w >= 6 ? 3 : 5, load_kg: 90 });
      events.push({ type: "RPE_REPORT", at: at(date, 18, 40), exercise_id: "bench_press", rpe: w >= 4 ? 9 : 7.5 });
      if (d === 0 && (w === 5 || w === 7)) events.push({ type: "PAIN_REPORT", at: at(date, 18, 15), exercise_id: "back_squat", pain_area: "knee" });
      events.push({ type: "COMPLETE_EXERCISE", at: at(date, 19, 0), exercise_id: "bench_press" });
      sessions.push({
        session_id: `s_${w}_${d}`, status: "completed", created_at: at(date, 17, 0), events,
        planned: [
          { exercise_id: "back_squat", segment: "working", sets: 3, reps_target: 5, load_kg: squat },
          { exercise_id: "bench_press", segment: "working", sets: 3, reps_target: 5, load_kg: 90 }
        ]
      });
    });
  });
  const readiness = [];
  for (let i = 0; i < 40; i += 1) {
    const date = new Date(Date.parse("2026-09-07T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10);
    const bad = date >= "2026-10-12";
    readiness.push({ date, sleep: bad ? 2 : 4 + (i % 2), soreness: bad ? 2 : 4, stress: bad ? 2 : 4 - (i % 2) });
  }
  return analyseAthlete({
    today: "2026-10-17", weeks: 8, sessions, readiness, checkins: [], planned_days_per_week: 3,
    exercise_name: (id) => ({ back_squat: "Back squat", bench_press: "Bench press" })[id] ?? id,
    is_strength_lift: (id) => id === "back_squat" || id === "bench_press"
  });
}

test("the powerlifter: squat rising, bench stuck and feeling harder, knee pain recurring, readiness down this week", () => {
  const analysis = powerlifter();
  const squat = analysis.strength.lifts.find((lift) => lift.exercise_id === "back_squat");
  assert.equal(squat.status, "rising");
  assert.equal(squat.series[0].method, "rts", "the rated top set uses the RTS chart");
  assert.ok(squat.change_pct > 2);
  const bench = analysis.strength.lifts.find((lift) => lift.exercise_id === "bench_press");
  assert.equal(bench.status, "falling", "3 reps at the same 90 kg instead of 5");

  assert.equal(analysis.adherence.rows.at(-2).adherence_pct, 100);
  assert.deepEqual(analysis.adherence.by_weekday.map((d) => d.sessions).slice(0, 5), [8, 0, 8, 0, 8], "Mon/Wed/Fri for 8 weeks (today is a Saturday)");

  const lastWeek = analysis.execution.rows.at(-2);
  assert.equal(lastWeek.reps_hit_pct, 50, "the latest complete week: squats hit, bench 3 of 5");
  assert.equal(analysis.execution.rows.at(-1).partial_week, true);
  assert.equal(analysis.execution.most_missed[0].name, "Bench press");
  const creep = analysis.execution.effort_creep.find((c) => c.exercise_id === "bench_press");
  assert.deepEqual([creep.scale_label, creep.early, creep.late, creep.effort_change], ["RPE", 7.5, 9, 1.5]);

  assert.deepEqual([analysis.pain.areas[0].area, analysis.pain.areas[0].reports, analysis.pain.areas[0].weeks, analysis.pain.areas[0].exercises], ["knee", 2, 2, ["Back squat"]]);
  assert.ok(analysis.readiness.rows.at(-1).z <= -1.5, "a 6/15 week against a ~12/15 normal");

  const list = findings(analysis);
  const texts = list.map((f) => f.text);
  assert.ok(texts.some((t) => /Bench press estimated max is \d+(\.\d)?% below its peak/u.test(t)), texts.join("\n"));
  // Falling and feeling harder on the same lift: one fatigue finding, not two.
  const benchFinding = list.find((f) => f.id === "strength_fatigue_bench_press");
  assert.ok(benchFinding, texts.join("\n"));
  assert.match(benchFinding.text, /, and it feels harder \(RPE 7\.5 → 9 at about 90 kg\)\.$/u);
  assert.equal(texts.some((t) => t.startsWith("Bench press feels harder")), false, "not listed twice");
  // Every finding comes with a suggested next step.
  assert.ok(list.every((f) => typeof f.action === "string" && f.action.length > 10), list.filter((f) => !f.action).map((f) => f.id).join(", "));
  assert.match(list.find((f) => f.id.startsWith("pain_")).action, /refer them to a medical professional/u);
  assert.ok(texts.some((t) => /^Knee pain reported in 2 different weeks \(Back squat\)/u.test(t)), texts.join("\n"));
  assert.ok(texts.some((t) => /^Readiness well below their normal/u.test(t)));
  assert.ok(texts.some((t) => /^Back squat estimated max up/u.test(t)));
  assert.equal(list[0].level, "alert", "alerts come first");
  assert.ok(attentionScore(list) >= 9);
});

test("a quiet, on-plan athlete gets good news and a low attention score", () => {
  const today = "2026-10-17";
  const sessions = weekStarts(today, 6).slice(0, 5).map((week, w) => ({
    session_id: `q${w}`, status: "completed", created_at: at(week, 9, 0), planned: [],
    events: [{ type: "START_SESSION", at: at(week, 9, 0) }, { type: "RPE_REPORT", at: at(week, 9, 30), exercise_id: "x", rpe: 7 }, { type: "COMPLETE_EXERCISE", at: at(week, 10, 0), exercise_id: "x" }]
  }));
  const analysis = analyseAthlete({ today, weeks: 6, sessions, readiness: [], checkins: [], planned_days_per_week: 1, exercise_name: (id) => id, is_strength_lift: () => false });
  const list = findings(analysis);
  assert.equal(attentionScore(list), 0, list.map((f) => f.text).join(" | "));
  assert.ok(list.some((f) => f.level === "good" && /Training as planned/u.test(f.text)));
});

test("adherence counts only from the week they started - a new athlete has no missed weeks before it", () => {
  const today = "2026-10-17";
  const sessions = [{ session_id: "n1", status: "completed", created_at: at("2026-10-13", 9, 0), planned: [], events: [{ type: "START_SESSION", at: at("2026-10-13", 9, 0) }] }];
  const analysis = analyseAthlete({ today, weeks: 6, sessions, readiness: [], checkins: [], planned_days_per_week: 3, exercise_name: (id) => id, is_strength_lift: () => false });
  assert.ok(analysis.adherence.rows.every((row) => row.planned === null || row.week_start >= "2026-10-12"));
  assert.equal(findings(analysis).some((f) => f.id === "adherence"), false, "the current week is still under way");
});

test("a big week then a drop is one story, not two lines that look like they disagree", () => {
  const analysis = {
    weeks: ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"],
    closed: true,
    adherence: { rows: [] },
    load: { rows: [
      { week_start: "2026-09-21", acute_chronic: 1.0 }, { week_start: "2026-09-28", acute_chronic: 2.3 },
      { week_start: "2026-10-05", acute_chronic: 1.1 }, { week_start: "2026-10-12", acute_chronic: 0.4 }
    ] },
    readiness: { rows: [], checkins: [] },
    strength: { lifts: [], bodyweight: [] },
    execution: { rows: [], effort_creep: [], effort_targets: [] },
    pain: { areas: [] }
  };
  const list = findings(analysis);
  const story = list.find((f) => f.id === "load_story");
  assert.equal(story.text, "Training load spiked to 2.3x their 4-week normal in the week of 28 Sep, then dropped 60% below their 4-week normal (ratio 0.4).");
  assert.equal(list.some((f) => f.id === "load" || f.id === "load_spike"), false);
  assert.match(story.action, /planned recovery/u);
});
