// Looking ahead: a powerlifter coming off a deload into an intensification
// block sees the jump before it happens; and the EWMA acute:chronic ratio
// alongside the rolling one.
import assert from "node:assert/strict";
import test from "node:test";

import { ewmaRatios, forwardFindings, forwardRows } from "../dist/src/api/forward_load.js";
import { analyseAthlete, findings } from "../dist/src/api/coach_analysis_metrics.js";

const week = (n, extra = {}) => ({ week_number: n, block_name: "Accumulation", block_type: "accumulation", current: false, sessions: 3, working_sets: 45, tonnage_kg: 18000, sets_80: 6, sets_90: 0, avg_rpe: null, ...extra });

test("each week ahead against their last 4 weeks and the plan's week before", () => {
  const rows = forwardRows([
    week(5, { current: true, sessions: 1, working_sets: 15, tonnage_kg: 6000 }),
    week(6, { block_name: "Deload", block_type: "deload", working_sets: 27, tonnage_kg: 9000 }),
    week(7, { block_name: "Intensification", block_type: "intensification", working_sets: 50, tonnage_kg: 26000, sets_80: 18, sets_90: 6 }),
    week(8, { block_name: "Intensification", block_type: "intensification", working_sets: 70, tonnage_kg: 25000 })
  ], { sets: 40, tonnage_kg: 16000 });
  assert.equal(rows[1].flag, "deload");
  assert.deepEqual([rows[2].sets_vs_recent, rows[2].tonnage_vs_recent, rows[2].flag], [1.25, 1.63, "spike"], "26 t against 16 t lately");
  assert.equal(rows[2].sets_vs_week_before, 1.85);
  assert.equal(rows[3].flag, "spike", "70 sets against 40 lately");
  const f = forwardFindings(rows);
  assert.equal(f[0].id, "forward_load");
  assert.equal(f[0].text, "Week 7 of the plan (Intensification) is 1.63× the work they've done lately.");
});

test("a step up on the plan's week before (not after a deload) when their recent work isn't known", () => {
  const rows = forwardRows([week(2, { current: true }), week(3, { working_sets: 60 })], { sets: null, tonnage_kg: null });
  assert.equal(rows[1].flag, "step_up");
  assert.equal(forwardFindings(rows)[0].text, "Week 3 of the plan (Accumulation) steps working sets up 33% on the week before.");
  assert.deepEqual(forwardFindings(forwardRows([week(2, { current: true }), week(3)], { sets: 45, tonnage_kg: 18000 })), [], "a steady plan says nothing");
});

test("EWMA: steady training averages about 1 across the week; a doubled week lifts it; it needs 28 days first", () => {
  const load = new Map();
  const start = Date.parse("2026-07-06T00:00:00Z");
  const iso = (n) => new Date(start + n * 86_400_000).toISOString().slice(0, 10);
  for (let n = 0; n < 70; n += 1) if ([0, 2, 4].includes(n % 7)) load.set(iso(n), n >= 63 ? 1000 : 500);
  const [early, steady, spike] = ewmaRatios(load, iso(0), [iso(20), iso(55), iso(69)]);
  assert.equal(early, null, "under 28 days of history");
  assert.ok(steady > 0.85 && steady < 1.15, `steady ${steady}`);
  assert.ok(spike > 1.25 && spike - steady > 0.3, `spike ${spike}`);
  assert.deepEqual(ewmaRatios(load, null, [iso(69)]), [null]);
});

test("in the athlete's analysis: EWMA in the load rows, the weeks ahead in the plan, and a finding", () => {
  const a = analyseAthlete({
    today: "2026-10-18", weeks: 8, sessions: [], readiness: [], checkins: [], planned_days_per_week: 3, exercise_name: (id) => id, is_strength_lift: () => false,
    planned_ahead: [week(5, { current: true }), week(6, { working_sets: 80 })]
  });
  assert.ok(a.load.rows.every((row) => "ewma_ratio" in row));
  assert.equal(a.plan.ahead.rows.length, 2);
  assert.ok(findings(a).some((f) => f.id === "forward_load" && /check they're ready/iu.test(f.action)));
  const report = analyseAthlete({ today: "2026-10-18", weeks: 8, closed: true, sessions: [], readiness: [], checkins: [], planned_days_per_week: 3, exercise_name: (id) => id, is_strength_lift: () => false, planned_ahead: [week(5, { current: true }), week(6, { working_sets: 80 })] });
  assert.ok(!findings(report).some((f) => f.id === "forward_load"), "a report on an ended period doesn't look ahead");
});
