// Fight camp for a fighter who competes at a weight class: strength kept,
// no muscle-building volume in the 4 weeks before the fight.
import test from "node:test";
import assert from "node:assert/strict";

import { applyFightCamp, fightCampFor, validateWeightClass } from "../dist/src/api/weight_class.js";

const pattern = { trap_bar_deadlift: "hinge", bulgarian_split_squat: "single_leg_squat", chin_up: "vertical_pull", lateral_bound: "jump_horizontal", farmers_carry: "carry_bilateral", rotational_medicine_ball_throw: "throw_slam", face_pull: "scapular_retraction" };
const rx = (exercise_id, sets, reps, intensity, extra = {}) => ({ exercise_id, sets, reps, intensity, ...extra });

test("a lightweight boxer 3 weeks out: 3 x 10 accessory work becomes 3 x 6, heavy lifts and power stay, and each change says why", () => {
  const camp = fightCampFor(["2026-10-22"], "2026-10-01");
  assert.deepEqual(camp, { fight_date: "2026-10-22", days_out: 21 });
  const out = applyFightCamp([
    rx("trap_bar_deadlift", 4, 4, { type: "percent_1rm", value: 78 }),
    rx("bulgarian_split_squat", 4, 8, { type: "rpe", value: 8 }),
    rx("face_pull", 3, 15, { type: "rpe", value: 7 }),
    rx("lateral_bound", 3, 4, { type: "bodyweight" }),
    rx("rotational_medicine_ball_throw", 4, 8, { type: "rpe", value: 7 }),
    rx("farmers_carry", 3, 1, { type: "rpe", value: 8 }, { distance_m: 30 })
  ], camp, (id) => pattern[id]);
  const by = Object.fromEntries(out.map((e) => [e.exercise_id, e]));
  assert.equal(by.trap_bar_deadlift.fight_camp, undefined, "heavy, low-rep strength work is unchanged");
  assert.deepEqual([by.bulgarian_split_squat.sets, by.bulgarian_split_squat.reps], [3, 6]);
  assert.deepEqual(by.bulgarian_split_squat.fight_camp, { fight_date: "2026-10-22", days_out: 21, planned_sets: 4, planned_reps: 8 });
  assert.deepEqual([by.face_pull.sets, by.face_pull.reps], [3, 6]);
  assert.equal(by.lateral_bound.fight_camp, undefined, "bodyweight power work is left alone");
  assert.equal(by.rotational_medicine_ball_throw.reps, 8, "a throw is power work, not mass-building");
  assert.equal(by.farmers_carry.fight_camp, undefined, "distance work is left alone");
});

test("fight camp is the 4 weeks before the nearest fight; a past fight or one 5 weeks away is not camp", () => {
  assert.equal(fightCampFor(["2026-11-05"], "2026-10-01"), null);
  assert.equal(fightCampFor(["2026-09-20"], "2026-10-01"), null);
  assert.deepEqual(fightCampFor(["2026-11-30", "2026-10-10"], "2026-10-01"), { fight_date: "2026-10-10", days_out: 9 });
  assert.deepEqual(fightCampFor(["2026-10-01"], "2026-10-01"), { fight_date: "2026-10-01", days_out: 0 });
});

test("a weight class is a declared fact: yes/no, with an optional class in kg", () => {
  assert.deepEqual(validateWeightClass({ competes_at_weight_class: true, weight_class_kg: 63.5 }), { ok: true, weight_class: { competes_at_weight_class: true, weight_class_kg: 63.5 } });
  assert.deepEqual(validateWeightClass({ competes_at_weight_class: false, weight_class_kg: 70 }), { ok: true, weight_class: { competes_at_weight_class: false, weight_class_kg: null } });
  assert.equal(validateWeightClass({ competes_at_weight_class: "yes" }).ok, false);
  assert.equal(validateWeightClass({ competes_at_weight_class: true, weight_class_kg: 12 }).ok, false);
  assert.equal(validateWeightClass({ competes_at_weight_class: true, target_weight: 60 }).ok, false, "nothing else is stored");
});
