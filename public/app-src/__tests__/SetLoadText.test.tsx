import assert from "node:assert/strict";
import test from "node:test";

import { setLoadText } from "../utils/format";

test("a pull-up shows the athlete's bodyweight in the load: 'bodyweight (80 kg)', and 'bodyweight + 20 kg (100 kg)' with a belt", () => {
  assert.equal(setLoadText({ reps: 8, load_value: null, load_unit: null, system_load_kg: 80 }), "bodyweight (80 kg)");
  assert.equal(setLoadText({ reps: 5, load_value: 20, load_unit: "kg", system_load_kg: 100 }), "bodyweight + 20 kg (100 kg)");
  assert.equal(setLoadText({ reps: 5, load_value: 45, load_unit: "lb", system_load_kg: 100 }), "bodyweight + 45 lb (220.5 lb)", "in the athlete's unit");
});

test("a barbell set shows its load as before; a set with no load shows nothing", () => {
  assert.equal(setLoadText({ reps: 5, load_value: 140, load_unit: "kg" }), "140 kg");
  assert.equal(setLoadText({ reps: 5, load_value: null, load_unit: null }), "");
  assert.equal(setLoadText({ reps: 8, load_value: 10, load_unit: "kg", system_load_kg: null }), "10 kg", "bodyweight unknown: the added load");
});
