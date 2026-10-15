import assert from "node:assert/strict";
import test from "node:test";

import { topPersonalRecord } from "../utils/personalRecords";

test("a squat ramp of 102.5, 105, 107.5 and 110 kg - each heavier than the last, so each flagged when logged - shows one PR: the 110", () => {
  const sets = [
    { set_index: 1, load_value: 102.5, load_unit: "kg", is_pr: false },
    { set_index: 2, load_value: 105, load_unit: "kg", is_pr: true },
    { set_index: 3, load_value: 107.5, load_unit: "kg", is_pr: true },
    { set_index: 4, load_value: 110, load_unit: "kg", is_pr: true }
  ];
  assert.equal(topPersonalRecord(sets), sets[3]);
});

test("no set flagged, no PR; mixed units compare by weight", () => {
  assert.equal(topPersonalRecord([{ load_value: 100, load_unit: "kg", is_pr: false }]), null);
  const kg = { load_value: 100, load_unit: "kg", is_pr: true };
  const lb = { load_value: 225, load_unit: "lb", is_pr: true };
  assert.equal(topPersonalRecord([kg, lb]), lb, "225 lb (102 kg) beats 100 kg");
});
