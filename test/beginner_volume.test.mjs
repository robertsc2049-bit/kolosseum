// A beginner's volume is their programme's novice dose: general preparation
// adds sets and reps for amateurs and pros, never for beginners
// (engine/src/phases/phase4/periodisation.ts).
import test from "node:test";
import assert from "node:assert/strict";

import { periodisePrescriptions } from "../dist/engine/src/phases/phase4/periodisation.js";

const logPress = { sets: 4, reps: 5, intensity: { type: "rpe", value: 6 }, rest_seconds: 180 };
const accumulation = (week) => ({ macro_phase: "accumulation", meso_week: week, week_number: week });

test("a novice strongman's first log press session is the listed 4 x 5, not 5 x 7", () => {
  const [p] = periodisePrescriptions([logPress], accumulation(1), "beginner");
  assert.deepEqual([p.sets, p.reps], [4, 5]);
  assert.ok(p.intensity.value <= 7, "and stays at or below RPE 7");
});

test("an amateur strongman in accumulation still gets the extra set and reps", () => {
  const [p] = periodisePrescriptions([logPress], accumulation(1), "amateur");
  assert.deepEqual([p.sets, p.reps], [5, 7]);
});

test("a beginner's sets never grow across an accumulation block, and the deload week still cuts them", () => {
  for (const week of [1, 2, 3]) {
    const [p] = periodisePrescriptions([logPress], accumulation(week), "beginner");
    assert.deepEqual([p.sets, p.reps], [4, 5], `week ${week}`);
  }
  const [deload] = periodisePrescriptions([logPress], accumulation(4), "beginner");
  assert.ok(deload.sets < 4, "deload week");
});
