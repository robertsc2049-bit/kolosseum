// DEV NOTE: Human-maintained repo surface. Readiness rules: a low check-in
// trims that day's session; it never adds work.

import test from "node:test";
import assert from "node:assert/strict";

import { applyReadiness, isLowReadiness, validateReadiness } from "../dist/src/api/readiness.js";

const check = (sleep, soreness, stress) => ({ date: "2026-09-27", sleep, soreness, stress });
const session = [
  { exercise_id: "back_squat", sets: 5, reps: 5, intensity: { type: "percent_1rm", value: 77.5 } },
  { exercise_id: "barbell_row", sets: 1, reps: 8, intensity: { type: "rpe", value: 8 } },
  { exercise_id: "countermovement_jump", sets: 3, reps: 3, intensity: { type: "bodyweight" } }
];

test("readiness: a lifter who slept 2 hours before a squat day gets a lighter session with the reason attached", () => {
  assert.equal(isLowReadiness(check(1, 4, 4)), true, "any 1 is low");
  const trimmed = applyReadiness(session, check(1, 4, 4));
  assert.deepEqual(trimmed.map((e) => e.sets), [4, 1, 2], "a set fewer, never below 1");
  assert.deepEqual(trimmed[0].intensity, { type: "percent_1rm", value: 72.5 });
  assert.deepEqual(trimmed[1].intensity, { type: "rpe", value: 7 });
  assert.deepEqual(trimmed[0].readiness, { sleep: 1, soreness: 4, stress: 4, low: true });
});

test("readiness: a tired-but-fine day (total 8+) or no check-in leaves the session as planned", () => {
  assert.equal(isLowReadiness(check(3, 2, 3)), false);
  assert.equal(isLowReadiness(check(2, 2, 3)), true, "total 7 is low");
  assert.equal(applyReadiness(session, check(3, 3, 3)), session);
  assert.equal(applyReadiness(session, null), session);
});

test("readiness: answers must be whole numbers 1 to 5", () => {
  assert.equal(validateReadiness({ sleep: 3, soreness: 4, stress: 5 }, "2026-09-27").ok, true);
  assert.equal(validateReadiness({ sleep: 0, soreness: 4, stress: 5 }, "2026-09-27").ok, false);
  assert.equal(validateReadiness({ sleep: 3, soreness: 4 }, "2026-09-27").ok, false);
  assert.equal(validateReadiness({ sleep: 3, soreness: 4, stress: 5, mood: 2 }, "2026-09-27").ok, false);
});
