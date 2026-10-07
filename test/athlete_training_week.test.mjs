// An athlete without a coach builds their own week (src/api/
// athlete_training_week_service.ts): it repeats day by day, with a lighter
// 4th week if they want one.
import test from "node:test";
import assert from "node:assert/strict";

const { validateTrainingWeek, ownTrainingStamp, ownTrainingProgram, exerciseOptionsFor } = await import(new URL("../dist/src/api/athlete_training_week.js", import.meta.url).href);

const threeDays = {
  week_id: "training_week_1", lighter_every_fourth: true, saved_at: "2026-10-07T00:00:00Z",
  days: [
    { items: [{ exercise_id: "back_squat", sets: 3, reps: 5 }, { exercise_id: "bench_press", sets: 3, reps: 5 }] },
    { items: [{ exercise_id: "deadlift", sets: 1, reps: 5 }] },
    { items: [{ exercise_id: "back_squat", sets: 3, reps: 5 }, { exercise_id: "walking_lunge", sets: 3, reps: 10 }] }
  ]
};

test("a rugby player can choose from the exercises the registry allows for rugby in training", () => {
  const rugby = exerciseOptionsFor("rugby_union").map((o) => o.exercise_id);
  assert.ok(rugby.includes("back_squat") && rugby.includes("nordic_curl"));
  assert.ok(exerciseOptionsFor(undefined).length > 0, "no sport yet: the general strength list");
});

test("a week that would confuse a session is refused: the same lift twice in a day, an empty day, silly sets or reps, an exercise not for their sport", () => {
  assert.throws(() => validateTrainingWeek({ days: [{ items: [{ exercise_id: "back_squat", sets: 3, reps: 5 }, { exercise_id: "back_squat", sets: 3, reps: 5 }] }] }, "rugby_union"),
    (e) => e.fieldErrors.day_1_2 === "This exercise is already in this day.");
  assert.throws(() => validateTrainingWeek({ days: [{ items: [] }] }, "rugby_union"), (e) => Boolean(e.fieldErrors.day_1));
  assert.throws(() => validateTrainingWeek({ days: [{ items: [{ exercise_id: "back_squat", sets: 12, reps: 0 }] }] }, "rugby_union"), (e) => Boolean(e.fieldErrors.day_1_1_sets && e.fieldErrors.day_1_1_reps));
  assert.throws(() => validateTrainingWeek({ days: [{ items: [{ exercise_id: "not_an_exercise", sets: 3, reps: 5 }] }] }, "rugby_union"), (e) => Boolean(e.fieldErrors.day_1_1));
  assert.throws(() => validateTrainingWeek({ days: Array.from({ length: 7 }, () => ({ items: [{ exercise_id: "back_squat", sets: 3, reps: 5 }] })) }, "rugby_union"), (e) => Boolean(e.fieldErrors.days));
  assert.deepEqual(validateTrainingWeek({ days: threeDays.days, lighter_every_fourth: true }, "rugby_union"), { days: threeDays.days, lighter_every_fourth: true });
});

test("sessions follow the week in order - Day 1, 2, 3, then Day 1 of week 2 - and every 4th week is lighter if chosen", () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => ownTrainingStamp(threeDays, i)).map((s) => [s.day_number, s.week_number]), [[1, 1], [2, 1], [3, 1], [1, 2]]);
  assert.equal(ownTrainingStamp(threeDays, 9).lighter, true, "session 10 is week 4");
  assert.equal(ownTrainingStamp(threeDays, 12).lighter, false, "week 5");
  assert.equal(ownTrainingStamp({ ...threeDays, lighter_every_fourth: false }, 9).lighter, false);
});

test("today's session is the day's exercises as written, each an effort target the athlete's own loading turns into weights; a set off in the lighter week", () => {
  const program = ownTrainingProgram({ program_id: "engine" }, threeDays, ownTrainingStamp(threeDays, 0));
  assert.deepEqual(program.planned_items.map((i) => [i.exercise_id, i.sets, i.reps, i.intensity.type]), [["back_squat", 3, 5, "rpe"], ["bench_press", 3, 5, "rpe"]]);
  assert.deepEqual(program.planned_exercise_ids, ["back_squat", "bench_press"]);
  assert.ok(program.exercise_pool.back_squat);
  const lighter = ownTrainingProgram({}, threeDays, ownTrainingStamp(threeDays, 9));
  assert.deepEqual(lighter.planned_items.map((i) => i.sets), [2, 2]);
});

test("with no week of their own, an athlete logs what they train today: today's exercises as a one-off session, checked like a week", async () => {
  const { todaysSession } = await import(new URL("../dist/src/api/athlete_training_week.js", import.meta.url).href);
  const { week, stamp } = todaysSession([{ exercise_id: "back_squat", sets: 5, reps: 5 }, { exercise_id: "pull_up", sets: 3, reps: 8 }], "rugby_union", "abc");
  assert.equal(week.week_id, "today_abc");
  assert.deepEqual(stamp, { week_id: "today_abc", day_number: 1, days_total: 1, week_number: 1, lighter: false, today: true });
  const program = ownTrainingProgram({}, week, stamp);
  assert.deepEqual(program.planned_items.map((i) => [i.exercise_id, i.sets, i.reps]), [["back_squat", 5, 5], ["pull_up", 3, 8]]);
  assert.throws(() => todaysSession([], "rugby_union", "x"), (e) => Boolean(e.fieldErrors.day_1));
  assert.throws(() => todaysSession([{ exercise_id: "back_squat", sets: 3, reps: 5 }, { exercise_id: "back_squat", sets: 3, reps: 5 }], "rugby_union", "x"), (e) => Boolean(e.fieldErrors.day_1_2));
});
