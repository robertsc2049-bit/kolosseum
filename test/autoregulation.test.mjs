// DEV NOTE: Human-maintained repo surface. Autoregulation rules: what an athlete
// did last time holds the next prescription back - never adds load.

import test from "node:test";
import assert from "node:assert/strict";

import { heldIntensity, holdFor } from "../dist/src/api/autoregulation.js";

const last = (overrides) => ({ session_id: "s1", prescribed_reps: 5, set_reps: [5, 5, 5, 5, 5], rpe: 8, ...overrides });

test("autoregulation: a powerlifter who missed reps on 3 of 5 squat sets is held back 5% next time", () => {
  const hold = holdFor(last({ set_reps: [5, 5, 4, 3, 0] }));
  assert.deepEqual(hold, { reason: "missed_reps", detail: "3 of 5 sets short of 5 reps last time", from_session_id: "s1" });
  assert.deepEqual(heldIntensity({ type: "percent_1rm", value: 77.5 }), { type: "percent_1rm", value: 72.5 });
});

test("autoregulation: one short set out of five is normal fatigue, not a hold", () => {
  assert.equal(holdFor(last({ set_reps: [5, 5, 5, 5, 4] })), null);
  assert.equal(holdFor(last({ set_reps: [5, 4] }))?.reason, "missed_reps", "half the sets short is a hold");
});

test("autoregulation: a rugby player who rated his trap bar deadlift RPE 10 gets 1 RPE lower next time", () => {
  const hold = holdFor(last({ rpe: 10 }));
  assert.equal(hold?.reason, "too_hard");
  assert.deepEqual(heldIntensity({ type: "rpe", value: 8 }), { type: "rpe", value: 7 });
  assert.equal(holdFor(last({ rpe: 9 })), null, "RPE 9 is hard but planned for");
});

test("autoregulation: nothing logged, or a clean session, changes nothing - and holds never add load", () => {
  assert.equal(holdFor(undefined), null);
  assert.equal(holdFor(last({})), null);
  assert.equal(heldIntensity({ type: "bodyweight" }), null, "bodyweight work is left alone");
  assert.deepEqual(heldIntensity({ type: "percent_1rm", value: 42 }), { type: "percent_1rm", value: 40 }, "floor at 40%");
  assert.deepEqual(heldIntensity({ type: "rpe", value: 5 }), { type: "rpe", value: 5 }, "floor at RPE 5");
});
