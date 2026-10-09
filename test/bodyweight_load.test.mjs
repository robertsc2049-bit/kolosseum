// A bodyweight exercise's load is the athlete's bodyweight (their share of it)
// plus anything added on top (src/api/bodyweight_load.ts).
import test from "node:test";
import assert from "node:assert/strict";

import { bodyweightShare, latestBodyweightKg, systemLoadKg } from "../dist/src/api/bodyweight_load.js";
import { setE1rmKg } from "../dist/src/api/training_e1rm.js";

test("an 80 kg street lifter's pull-up is 80 kg unweighted and 100 kg with 20 kg on the belt", () => {
  assert.equal(systemLoadKg("pull_up", 0, 80), 80);
  assert.equal(systemLoadKg("pull_up", 20, 80), 100);
  assert.equal(systemLoadKg("dip", 32.5, 80), 112.5);
  assert.equal(systemLoadKg("muscle_up", null, 80), 80);
});

test("a push-up moves about 64% of bodyweight, 70% with the feet raised; exercises with no known share aren't guessed", () => {
  assert.equal(systemLoadKg("push_up", 0, 80), 51.2);
  assert.equal(systemLoadKg("push_up", 10, 80), 61.2, "a 10 kg plate on the back adds 10 kg");
  assert.equal(systemLoadKg("feet_elevated_push_up", 0, 80), 56);
  assert.equal(bodyweightShare("back_squat"), 0);
  assert.equal(systemLoadKg("back_squat", 100, 80), null, "a barbell lift's load is the bar");
  assert.equal(systemLoadKg("pull_up", 20, null), null, "no known bodyweight: nothing invented");
});

test("the e1RM of a weighted pull-up uses the bodyweight logged with the set, not today's", () => {
  const set = { exercise_id: "pull_up", reps: 5, load_value: 20, load_unit: "kg", date: "2026-10-01", bodyweight_kg: 82 };
  assert.equal(Math.round(setE1rmKg(set, 78).e1rm_kg * 10) / 10, Math.round(102 * (1 + 5 / 30) * 10) / 10);
  assert.equal(setE1rmKg({ ...set, bodyweight_kg: null }, 78).e1rm_kg, 98 * (1 + 5 / 30), "older sets fall back to today's bodyweight");
});

test("bodyweight comes from the coach's strength profile first, else the latest weigh-in", () => {
  assert.equal(latestBodyweightKg({ bodyweight: 176, bodyweight_unit: "lb" }, []).toFixed(1), "79.8");
  assert.equal(latestBodyweightKg(null, [{ metric_type: "body_weight_kg", value: 81, effective_date: "2026-09-01" }, { metric_type: "body_weight_kg", value: 80, effective_date: "2026-10-01" }]), 80);
  assert.equal(latestBodyweightKg(null, []), null);
});
