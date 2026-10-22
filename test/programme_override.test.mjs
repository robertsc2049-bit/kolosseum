// A coach adjusts one player's session of the squad programme: fewer sets,
// a weight or an RPE, an exercise left out, a note - only in that session.
import assert from "node:assert/strict";
import test from "node:test";

import { applyProgrammeOverrides } from "../dist/src/api/programme_override.js";

const session = [
  { exercise_id: "back_squat", sets: 5, reps: 5, rep_range: { minimum: 4, maximum: 6 }, intensity: { type: "percent_1rm", value: 75 }, resolved_load: { value: 115, unit: "kg" } },
  { exercise_id: "bench_press", sets: 4, reps: 6, intensity: { type: "rpe", value: 8 } },
  { exercise_id: "barbell_row", sets: 3, reps: 8, intensity: { type: "rpe", value: 7 } }
];

test("sets, reps, a weight, an RPE, leaving out and a note - in this session only", () => {
  const overrides = [
    { assignment_id: "a1", session_index: 4, exercise_id: "back_squat", sets: 3, reps: 3, load_kg: 100, note: "Keep it pain-free" },
    { assignment_id: "a1", session_index: 4, exercise_id: "bench_press", rpe: 7 },
    { assignment_id: "a1", session_index: 4, exercise_id: "barbell_row", remove: true },
    { assignment_id: "a1", session_index: 5, exercise_id: "back_squat", sets: 1 }
  ];
  const { exercises, applied } = applyProgrammeOverrides(session, overrides, 4);
  assert.equal(applied, 3);
  assert.deepEqual(exercises.map((e) => e.exercise_id), ["back_squat", "bench_press"]);
  assert.deepEqual([exercises[0].sets, exercises[0].reps, exercises[0].rep_range, exercises[0].intensity, exercises[0].resolved_load], [3, 3, undefined, { type: "load", value: 100, unit: "kg" }, { value: 100, unit: "kg" }]);
  assert.equal(exercises[0].coaching_notes, "Your coach: Keep it pain-free");
  assert.deepEqual([exercises[1].intensity, exercises[1].resolved_load], [{ type: "rpe", value: 7 }, null]);
  assert.equal(applyProgrammeOverrides(session, overrides, 3).applied, 0, "another session is untouched");
});
