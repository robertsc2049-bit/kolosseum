// Back after a break on a Kolosseum programme (src/api/programme_reentry.ts):
// the re-entry week's sessions are lighter than what the programme would
// otherwise prescribe, whatever way the athlete's weights are set.
import test from "node:test";
import assert from "node:assert/strict";

const { lighterForReentry, reentryCut } = await import(new URL("../dist/src/api/programme_reentry.js", import.meta.url).href);

const twoWeeks = { returned_on: "2026-10-05", gap_days: 14, long_layoff: false, reentry_week: true };
const sixWeeks = { returned_on: "2026-10-05", gap_days: 42, long_layoff: true, reentry_week: true };
const headInjury = { returned_on: "2026-10-05", gap_days: 9, long_layoff: false, reentry_week: true, after_head_injury: true };

test("a fighter back after two weeks off: the 85% trap bar triple from their max is a set fewer and 10 points lighter, rounded down to a plate", () => {
  const [lift] = lighterForReentry([{
    exercise_id: "trap_bar_deadlift", sets: 3, reps: 3, intensity: { type: "percent_1rm", value: 85 },
    resolved_load: { type: "resolved_load", value: 170, unit: "kg", percentage: 85, rounding_increment: 2.5 }
  }], twoWeeks);
  assert.equal(lift.sets, 2);
  assert.deepEqual(lift.intensity, { type: "percent_1rm", value: 75 });
  assert.equal(lift.resolved_load.value, 150, "170 kg at 85% is 200 kg; 75% of it is 150 kg");
  assert.equal(lift.resolved_load.percentage, 75);
  assert.equal(lift.reentry_lighter, true);
});

test("a beginner building from what they lift: last time's 62.5 kg squat comes back at 55 kg, not 62.5 or more", () => {
  const [squat] = lighterForReentry([{
    exercise_id: "back_squat", sets: 3, reps: 5, intensity: { type: "load", value: 62.5, unit: "kg" },
    load_guidance: { type: "progression", basis: "progress", previous: 60, increment: 2.5, unit: "kg", reps: 5 }
  }], twoWeeks);
  assert.deepEqual([squat.sets, squat.intensity.value], [2, 55]);
});

test("in pounds the weight rounds down to 5 lb", () => {
  const [bench] = lighterForReentry([{ exercise_id: "bench_press", sets: 4, intensity: { type: "load", value: 185, unit: "lb" } }], twoWeeks);
  assert.equal(bench.intensity.value, 165, "166.5 lb rounds down to 165");
});

test("after six weeks away, or a head injury, it's 20% lighter and 2 RPE easier", () => {
  assert.deepEqual(reentryCut(sixWeeks), { percent: 20, rpe: 2 });
  assert.deepEqual(reentryCut(headInjury), { percent: 20, rpe: 2 });
  const [squat, pull] = lighterForReentry([
    { exercise_id: "back_squat", sets: 4, intensity: { type: "load", value: 100, unit: "kg" } },
    { exercise_id: "pull_up", sets: 3, intensity: { type: "rpe", value: 8 } }
  ], sixWeeks);
  assert.equal(squat.intensity.value, 80);
  assert.equal(pull.intensity.value, 6);
});

test("an athlete with no max sees an easier effort target, never below RPE 5", () => {
  const [row, carry] = lighterForReentry([
    { exercise_id: "barbell_row", sets: 3, intensity: { type: "percent_1rm", value: 70 }, load_guidance: { type: "rpe", value: 7, reason: "no_max_recorded" } },
    { exercise_id: "farmers_carry", sets: 2, intensity: { type: "rpe", value: 5 } }
  ], twoWeeks);
  assert.deepEqual([row.intensity.value, row.load_guidance.value], [60, 6]);
  assert.equal(carry.intensity.value, 5);
});

test("a first session on a lift and bodyweight work just lose a set; a single set stays a single set", () => {
  const [first, plank, single] = lighterForReentry([
    { exercise_id: "deadlift", sets: 1, intensity: { type: "percent_1rm", value: 65 }, load_guidance: { type: "progression", basis: "first_time", reps: 5 } },
    { exercise_id: "side_plank", sets: 3, intensity: { type: "bodyweight" } },
    { exercise_id: "box_jump", sets: 1, intensity: { type: "bodyweight" } }
  ], twoWeeks);
  assert.equal(first.sets, 1);
  assert.deepEqual(first.load_guidance, { type: "progression", basis: "first_time", reps: 5 });
  assert.deepEqual([plank.sets, plank.intensity], [2, { type: "bodyweight" }]);
  assert.equal(single.sets, 1);
});
