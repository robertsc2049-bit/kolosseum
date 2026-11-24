// What a coach sees about a session before opening it (review_signals.ts).
import assert from "node:assert/strict";
import test from "node:test";

import { reviewSignals } from "../dist/src/api/review_signals.js";

const planned = { exercises: [
  { exercise_id: "back_squat", display_name: "Back squat", sets: 2, reps: 5 },
  { exercise_id: "row", display_name: "Barbell row", sets: 2, rep_range: { minimum: 6, maximum: 8 } },
  { exercise_id: "stretch", segment: "cool_down", sets: 1 }
] };
const set = (exercise_id, set_index, reps) => ({ type: "SET_LOG_REPORT", exercise_id, set_index, reps, load_value: 100 });
const all = [set("back_squat", 1, 5), set("back_squat", 2, 5), set("row", 1, 6), set("row", 2, 7)];

test("done as planned: one line and nothing flagged", () => {
  assert.deepEqual(reviewSignals(planned, all, "completed", { srpe: 7, minutes: 60 }), { summary: "4 of 4 sets · rated 7/10, 60 min", flags: [] });
});

test("pain, missed reps, very hard ratings and skips are said, with what and where", () => {
  const events = [...all, set("back_squat", 2, 3), { type: "PAIN_REPORT", exercise_id: "back_squat", pain_area: "lower_back" }, { type: "RPE_REPORT", exercise_id: "back_squat", rpe_value: 10 }, { type: "SKIP_EXERCISE", exercise_id: "row" }];
  assert.deepEqual(reviewSignals(planned, events, "partial", { srpe: 9, minutes: 50 }).flags, ["Pain reported: lower back", "Reps missed: Back squat", "Very hard: Back squat RPE 10", "Skipped: Barbell row", "Session rated 9/10"]);
});

test("a corrected set or rating counts as it was last logged", () => {
  const events = [set("back_squat", 1, 2), { type: "RPE_REPORT", exercise_id: "back_squat", rpe_value: 10 }, ...all, { type: "RPE_REPORT", exercise_id: "back_squat", rpe_value: 8 }];
  assert.deepEqual(reviewSignals(planned, events, "completed").flags, []);
});

test("finished early with nothing skipped, set by set targets, and a session with nothing in it", () => {
  assert.deepEqual(reviewSignals(planned, [set("back_squat", 1, 5)], "partial").flags, ["Finished early"]);
  const perSet = { exercises: [{ exercise_id: "bench_press", sets: 2, reps: 5, set_targets: [{ reps: 5 }, { reps: 3 }] }] };
  assert.deepEqual(reviewSignals(perSet, [set("bench_press", 1, 5), set("bench_press", 2, 3)], "completed").flags, []);
  assert.deepEqual(reviewSignals(null, [], "completed"), { summary: "", flags: [] });
});
