// Fuller wellness and GPS load: fatigue, mood, resting heart rate and HRV
// against the athlete's own normal; distance, high-speed running and sprint
// from a GPS export, with HSR against their usual.
import assert from "node:assert/strict";
import test from "node:test";

import { analyseAthlete, findings } from "../dist/src/api/coach_analysis_metrics.js";

const TODAY = "2026-10-18"; // a Sunday
const day = (n) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const analyse = (extra) => analyseAthlete({
  today: TODAY, weeks: 4, sessions: [], readiness: [], checkins: [], planned_days_per_week: null,
  exercise_name: (id) => id, is_strength_lift: () => false, ...extra
});

test("a winger's HRV drops and resting HR rises in the last week: both flagged against their own 28 days", () => {
  // 5 weeks of steady mornings (HRV ~70 ms, RHR ~50), then the last 6 days off.
  const readiness = Array.from({ length: 35 }, (_, i) => {
    const n = 35 - i;
    const last = n <= 6;
    return { date: day(n), sleep: 4, soreness: 4, stress: 4, fatigue: last ? 2 : 4, mood: last ? 3 : 4, resting_hr: last ? 58 : 50 + (i % 3), hrv_ms: last ? 48 : 68 + (i % 5) };
  });
  const a = analyse({ readiness });
  const week = a.readiness.rows.at(-1);
  assert.ok(week.hrv_z <= -1.5, `HRV z ${week.hrv_z}`);
  assert.ok(week.resting_hr_delta >= 5, `RHR +${week.resting_hr_delta}`);
  assert.equal(week.fatigue, 2);
  const ids = findings(a).map((f) => f.id);
  assert.ok(ids.includes("hrv_low") && ids.includes("rhr_high"));
  const hrv = findings(a).find((f) => f.id === "hrv_low");
  assert.match(hrv.text, /HRV well below their normal this week \(48 ms on average\)/u);
  assert.match(hrv.action, /lighter session/u);
});

test("GPS: weekly distance, HSR and sprint, and an HSR spike against their usual", () => {
  const sessions = [];
  for (let w = 7; w >= 1; w -= 1) {
    for (const offset of [1, 3]) {
      const n = w * 7 + offset - 7;
      sessions.push({ id: `x${w}${offset}`, date: day(n), total_distance_m: 5200, hsr_m: w === 2 ? 900 : 400, sprint_m: 120, player_load: 520, avg_hr: 148, max_hr: 188, duration_min: 75 });
    }
  }
  const a = analyse({ external_load: sessions });
  const last = a.external.rows.at(-1);
  const prior = a.external.rows.at(-2);
  assert.deepEqual([prior.sessions, prior.total_distance_m, prior.hsr_m, prior.sprint_m], [2, 10400, 1800, 240]);
  assert.equal(prior.hsr_ratio, Math.round((1800 / 800) * 100) / 100, "the big HSR week against the 4 before it");
  assert.ok(findings(a).some((f) => f.id === "hsr_spike" && /High-speed running jumped to 2\.25× their usual/u.test(f.text)));
  assert.equal(last.partial_week, true);
});
