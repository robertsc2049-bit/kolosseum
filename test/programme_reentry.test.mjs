// Back after a break on a Kolosseum programme (src/api/programme_reentry.ts):
// the re-entry week's sessions are lighter than what the programme would
// otherwise prescribe, whatever way the athlete's weights are set.
import test from "node:test";
import assert from "node:assert/strict";

const { lighterForReentry, reentryCut } = await import(new URL("../dist/src/api/programme_reentry.js", import.meta.url).href);

const twoWeeks = { returned_on: "2026-10-05", gap_days: 14, long_layoff: false, reentry_week: true };
const sixWeeks = { returned_on: "2026-10-05", gap_days: 42, long_layoff: true, reentry_week: true };

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

test("after six weeks away it's 20% lighter and 2 RPE easier", () => {
  assert.deepEqual(reentryCut(sixWeeks), { percent: 20, rpe: 2 });
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

test("set by set: back after two weeks, the last set goes and every set left is 10 points lighter", () => {
  const [lift] = lighterForReentry([{
    exercise_id: "back_squat", sets: 3, reps: 5, intensity: { type: "percent_1rm", value: 60, maximum: 80 },
    resolved_load: { type: "resolved_load", value: 120, unit: "kg", percentage: 60, rounding_increment: 2.5 },
    set_targets: [
      { set_index: 1, reps: 5, intensity: { type: "percent_1rm", value: 60 }, resolved_load: { value: 120, unit: "kg", percentage: 60, rounding_increment: 2.5 } },
      { set_index: 2, reps: 3, intensity: { type: "percent_1rm", value: 70 }, resolved_load: { value: 140, unit: "kg", percentage: 70, rounding_increment: 2.5 } },
      { set_index: 3, reps: 1, intensity: { type: "percent_1rm", value: 80 }, resolved_load: { value: 160, unit: "kg", percentage: 80, rounding_increment: 2.5 } }
    ]
  }], twoWeeks);
  assert.equal(lift.sets, 2);
  assert.deepEqual(lift.set_targets.map((target) => [target.set_index, target.intensity.value, target.resolved_load.value]), [[1, 50, 100], [2, 60, 120]]);
});

test("what a coach set for this athlete stays exactly as set after a break; what they didn't set still drops", () => {
  const base = { exercise_id: "back_squat", sets: 4, reps: 5, coach_override: true, intensity: { type: "load", value: 120, unit: "kg" }, resolved_load: { value: 120, unit: "kg" } };
  const [both, weight, setsOnly, rpe] = lighterForReentry([
    { ...base, coach_kept: { sets: true, load: true } },
    { ...base, coach_kept: { load: true } },
    { exercise_id: "bench_press", sets: 3, coach_override: true, coach_kept: { sets: true }, intensity: { type: "percent_1rm", value: 80 }, resolved_load: { value: 80, unit: "kg", percentage: 80, rounding_increment: 2.5 } },
    { exercise_id: "row", sets: 3, coach_override: true, coach_kept: { load: true }, intensity: { type: "rpe", value: 8 }, resolved_load: null }
  ], twoWeeks);
  assert.deepEqual([both.sets, both.intensity.value, both.resolved_load.value, both.reentry_lighter], [4, 120, 120, undefined]);
  assert.deepEqual([weight.sets, weight.intensity.value, weight.resolved_load.value], [3, 120, 120], "their weight stays, a set still comes off");
  assert.deepEqual([setsOnly.sets, setsOnly.resolved_load.value], [3, 70], "their sets stay, the weight still drops");
  assert.deepEqual([rpe.sets, rpe.intensity.value], [2, 8]);
});

test("a coach who lets the break drop apply gets it on the weight they set, wherever it shows", () => {
  const [squat] = lighterForReentry([{ exercise_id: "back_squat", sets: 4, coach_override: true, intensity: { type: "load", value: 120, unit: "kg" }, resolved_load: { value: 120, unit: "kg" } }], twoWeeks);
  assert.deepEqual([squat.sets, squat.intensity.value, squat.resolved_load.value], [3, 107.5, 107.5]);
});
