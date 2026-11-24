// A self-coached athlete's own "Adjust for breaks" tick.
import assert from "node:assert/strict";
import test from "node:test";

import { adjustsForReturn, breakAdjustmentOn } from "../dist/src/api/break_adjustment.js";

const NEW = "2026-12-01T09:00:00.000Z";
const OLD = "2026-09-01T09:00:00.000Z";

test("off for a new account until ticked; an account from before the tick keeps the adjustment until it chooses", () => {
  assert.equal(breakAdjustmentOn([], NEW, "2027-01-01T00:00:00.000Z"), false);
  assert.equal(breakAdjustmentOn([], OLD, "2027-01-01T00:00:00.000Z"), true);
  assert.equal(breakAdjustmentOn([{ enabled: false, at: "2026-12-02T00:00:00.000Z" }], OLD, "2027-01-01T00:00:00.000Z"), false);
  assert.equal(breakAdjustmentOn([{ enabled: true, at: "2026-12-02T00:00:00.000Z" }, { enabled: false, at: "2026-12-05T00:00:00.000Z" }], NEW, "2026-12-03T00:00:00.000Z"), true, "as it was then");
});

test("the week back follows the tick now; changing it later doesn't move the blocks after an earlier return", () => {
  const now = new Date("2027-01-20T12:00:00Z");
  const back = { returned_on: "2027-01-18", reentry_week: true };
  const earlier = { returned_on: "2027-01-04", reentry_week: false }; // a Monday: that week ends on the 10th
  const on = (at) => [{ enabled: true, at }];
  assert.equal(adjustsForReturn(back, on("2027-01-19T08:00:00.000Z"), NEW, now), true);
  assert.equal(adjustsForReturn(earlier, on("2027-01-10T20:00:00.000Z"), NEW, now), true, "on before that week ended");
  assert.equal(adjustsForReturn(earlier, on("2027-01-11T08:00:00.000Z"), NEW, now), false, "only ticked after it");
  assert.equal(adjustsForReturn(earlier, [...on("2027-01-05T08:00:00.000Z"), { enabled: false, at: "2027-01-15T08:00:00.000Z" }], NEW, now), true, "unticked after it");
});
