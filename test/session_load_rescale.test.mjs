// When a coach's % session is made lighter around a match, the weight the
// athlete is told to lift follows the new % - and a set weight comes down too.
import assert from "node:assert/strict";
import test from "node:test";

import { rescaleResolvedLoads } from "../dist/src/api/session_load_rescale.js";
import { applyMatchWeek } from "../dist/src/api/match_week.js";

test("75% of 160 kg made 60% is 95 kg, not the old 120 kg; untouched work keeps its weight", () => {
  const out = rescaleResolvedLoads([
    { exercise_id: "back_squat", intensity: { type: "percent_1rm", value: 60 }, resolved_load: { value: 120, percentage: 75, one_rep_max: 160, calculation_one_rep_max: 160 } },
    { exercise_id: "bench_press", intensity: { type: "percent_1rm", value: 75 }, resolved_load: { value: 75, percentage: 75, one_rep_max: 100 } },
    { exercise_id: "barbell_row", intensity: { type: "rpe", value: 7 }, resolved_load: null }
  ]);
  assert.deepEqual([out[0].resolved_load.value, out[0].resolved_load.percentage], [95, 60]);
  assert.equal(out[1].resolved_load.value, 75);
  assert.equal(out[2].resolved_load, null);
});

test("the day after a match, a coach's set weight drops 15% to the nearest 2.5 kg", () => {
  const [row] = applyMatchWeek([{ exercise_id: "romanian_deadlift", sets: 4, intensity: { type: "load", value: 100, maximum: 110, unit: "kg" } }], { role: "day_after", match_date: "2026-10-17", label: "v Northside" }, () => "hinge");
  assert.deepEqual([row.sets, row.intensity.value, row.intensity.maximum], [2, 85, 92.5]);
});
