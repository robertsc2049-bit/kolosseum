// Beginner loading: a weight built from what the athlete lifted last time on
// the lift (src/api/athlete_loading_rules.ts) - never an RPE target for
// someone who can't yet judge reps in reserve.
import test from "node:test";
import assert from "node:assert/strict";

const service = await import(new URL("../dist/src/api/athlete_loading_rules.js", import.meta.url).href);
const { progressionPrescription, progressionIncrement, percentForRpe, rpeForPercentage, defaultLoadingMethod } = service;

const session = (load, reps, unit = "kg") => ({ sets: reps.map((r) => ({ reps: r, load, unit })) });

test("beginners build from what they lift by default; amateurs and pros go by % of max", () => {
  assert.equal(defaultLoadingMethod("beginner"), "progression");
  assert.equal(defaultLoadingMethod("amateur"), "percent_1rm");
  assert.equal(defaultLoadingMethod("pro"), "percent_1rm");
  assert.equal(defaultLoadingMethod(undefined), "percent_1rm");
});

test("a beginner's first squat session gives a technique weight to choose, not a number or an RPE", () => {
  assert.deepEqual(progressionPrescription([], 5, 2.5, "kg"), { basis: "first_time" });
});

test("a beginner who squatted 3x5 at 60 kg with every rep goes to 62.5 kg", () => {
  assert.deepEqual(progressionPrescription([session(60, [5, 5, 5])], 5, 2.5, "kg"),
    { basis: "progress", value: 62.5, unit: "kg", previous: 60, increment: 2.5 });
});

test("a beginner benching 40 kg who made every rep goes up the smaller upper-body step to 41.25 kg", () => {
  const next = progressionPrescription([session(40, [5, 5, 5])], 5, progressionIncrement("horizontal_push", "kg"), "kg");
  assert.equal(next.value, 41.25);
});

test("a beginner who got 5, 5, 4 at 62.5 kg repeats 62.5 kg", () => {
  assert.deepEqual(progressionPrescription([session(62.5, [5, 5, 4])], 5, 2.5, "kg"),
    { basis: "repeat", value: 62.5, unit: "kg", previous: 62.5, increment: 2.5 });
});

test("short of the reps at 62.5 kg two sessions running drops 10% to 55 kg (rounded to the plate step)", () => {
  const next = progressionPrescription([session(62.5, [5, 4, 3]), session(62.5, [5, 5, 4])], 5, 2.5, "kg");
  assert.equal(next.basis, "deload");
  assert.equal(next.value, 55);
});

test("a miss after a success at a lighter weight is a repeat, not a deload", () => {
  const next = progressionPrescription([session(62.5, [5, 4, 4]), session(60, [5, 5, 5])], 5, 2.5, "kg");
  assert.equal(next.basis, "repeat");
});

test("only sets at the top weight count: warm-up sets short of the reps don't hold the lift back", () => {
  const sets = { sets: [{ reps: 3, load: 40, unit: "kg" }, { reps: 5, load: 60, unit: "kg" }, { reps: 5, load: 60, unit: "kg" }] };
  assert.equal(progressionPrescription([sets], 5, 2.5, "kg").basis, "progress");
});

test("a lift logged in lb is progressed in the athlete's unit", () => {
  const next = progressionPrescription([session(135, [5, 5, 5], "lb")], 5, 5, "lb");
  assert.deepEqual([next.value, next.unit], [140, "lb"]);
});

test("a lift only ever logged without load (bodyweight) has no weight to build from yet", () => {
  assert.deepEqual(progressionPrescription([session(0, [10, 10])], 10, 2.5, "kg"), { basis: "first_time" });
});

test("increments: squat, hinge, single-leg and carries 2.5 kg / 5 lb; presses, pulls and isolation 1.25 kg / 2.5 lb", () => {
  assert.equal(progressionIncrement("squat", "kg"), 2.5);
  assert.equal(progressionIncrement("hinge", "kg"), 2.5);
  assert.equal(progressionIncrement("single_leg_squat", "kg"), 2.5);
  assert.equal(progressionIncrement("carry_bilateral", "lb"), 5);
  assert.equal(progressionIncrement("vertical_push", "kg"), 1.25);
  assert.equal(progressionIncrement("horizontal_pull", "lb"), 2.5);
});

test("a beginner who chooses % of max: an RPE 6 set of 5 becomes about 76% - and back again", () => {
  assert.equal(percentForRpe(6, 5), 76);
  assert.equal(rpeForPercentage(76, 5), 6);
});

test("the RPE chart: a 92.5% single is about RPE 8, a double at RPE 9 and five at RPE 8 sit where the chart puts them", () => {
  assert.equal(rpeForPercentage(92.5, 1), 8, "not RPE 7.5 - singles were underestimated");
  assert.equal(rpeForPercentage(92.2, 2), 9);
  assert.equal(rpeForPercentage(81.1, 5), 8);
  assert.equal(percentForRpe(8, 5), 81);
  assert.equal(percentForRpe(9, 2), 90, "92.2% on the chart, held to 90% when it comes from an effort target");
  assert.equal(rpeForPercentage(100, 1), 9, "never prescribed harder than RPE 9");
});

test("an athlete on RPE sees the wave: 70%, 75% and 80% for 5 are RPE 5, 5.5 and 7.5 - not 6, 6 and 7.5", () => {
  assert.deepEqual([70, 75, 80].map((percent) => rpeForPercentage(percent, 5)), [5, 5.5, 7.5]);
  assert.equal(rpeForPercentage(60, 5), 5, "a deload stays light, at about 5 reps in the tank");
});

test("an amateur with no max keeps the effort the programme wrote: band external rotations at 15 reps, RPE 6, stay RPE 6", () => {
  const { effortWithoutMax } = service;
  const percent = percentForRpe(6, 15);
  assert.equal(rpeForPercentage(percent, 15), 6.5, "the round trip through a % drifts (held at 50%)");
  assert.equal(effortWithoutMax({ type: "rpe", value: 6 }, percent, 15), 6);
  assert.equal(effortWithoutMax({ type: "percent_1rm", value: 80 }, 80, 5), rpeForPercentage(80, 5), "a % prescription still becomes an effort target");
});

test("a powerlifter on % of max rowing at RPE 8: the start weight follows what she rowed last time, not a fixed % of an old max", () => {
  const { startingLoadForEffort } = service;
  const fromMax = { value: 60, unit: "kg" };
  assert.deepEqual(startingLoadForEffort([], fromMax, "kg"), { value: 60, unit: "kg", basis: "max" }, "before she's logged it: from her max");
  const rowedHeavier = [session(67.5, [8, 8, 8]), session(60, [8, 8, 8])];
  assert.deepEqual(startingLoadForEffort(rowedHeavier, fromMax, "kg"), { value: 67.5, unit: "kg", basis: "last_session" }, "her last session, newest first");
  assert.deepEqual(startingLoadForEffort([session(150, [8, 8], "lb")], fromMax, "kg"), { value: 67.5, unit: "kg", basis: "last_session" }, "150 lb logged, shown in kg to a 2.5 kg plate");
  assert.deepEqual(startingLoadForEffort([session(0, [8, 8])], null, "kg"), null, "bodyweight sets and no max: just the effort target");
});

test("a lifter who reps out above her entered max trains from the new number; one bad day never lowers it", () => {
  const { effectiveMax } = service;
  const entered = { value: 140, unit: "kg", date: "2026-09-01" };
  assert.deepEqual(effectiveMax(entered, { value: 147.5, unit: "kg", date: "2026-09-20" }), { value: 147.5, unit: "kg", date: "2026-09-20", raised: true }, "week 3 rep-out: 147.5 e1RM");
  assert.deepEqual(effectiveMax(entered, { value: 130, unit: "kg", date: "2026-09-20" }), { ...entered, raised: false }, "a bad day doesn't shrink the max");
  assert.deepEqual(effectiveMax(entered, { value: 150, unit: "kg", date: "2026-08-15" }), { ...entered, raised: false }, "an estimate older than the max she entered doesn't override it");
  assert.equal(effectiveMax(entered, { value: 330, unit: "lb", date: "2026-09-20" }).value, 149.7, "converted to her unit");
  assert.deepEqual(effectiveMax(entered, null), { ...entered, raised: false });
});
