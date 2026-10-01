// The first week back after a concussion stand-down, the way a rugby S&C
// coach runs it: a lighter week, with nothing that jars the head or loads the neck.
import test from "node:test";
import assert from "node:assert/strict";

import { HEAD_INJURY_RETURN_DAYS, headInjuryReturnFor, holdBackAfterHeadInjury, returnedOn } from "../dist/src/api/head_injury_return.js";

const concussion = { reason: "head_injury", from_date: "2026-09-01", until_date: "2026-09-21", ended_on: null };

test("a prop stood down 1-21 September returns on the 22nd and is in his return week until the 28th", () => {
  assert.equal(returnedOn(concussion), "2026-09-22");
  assert.equal(headInjuryReturnFor([concussion], "2026-09-21"), null, "still stood down");
  assert.deepEqual(headInjuryReturnFor([concussion], "2026-09-22"), { returned_on: "2026-09-22", stood_down_days: 21 });
  assert.ok(headInjuryReturnFor([concussion], "2026-09-28"));
  assert.equal(headInjuryReturnFor([concussion], "2026-09-29"), null, `${HEAD_INJURY_RETURN_DAYS} days, then normal training`);
});

test("cleared early by his doctor on the 15th, the return week starts on the 15th", () => {
  const cleared = { ...concussion, ended_on: "2026-09-15" };
  assert.deepEqual(headInjuryReturnFor([cleared], "2026-09-16"), { returned_on: "2026-09-15", stood_down_days: 14 });
});

test("a stand-down for another medical reason has no head-injury return week", () => {
  assert.equal(headInjuryReturnFor([{ ...concussion, reason: "medical" }], "2026-09-22"), null);
});

test("a winger's first session back loses the sprints, jumps and neck work and keeps his strength work", () => {
  const pattern = { ten_metre_acceleration: "sprint_acceleration", countermovement_jump: "jump_vertical", trap_bar_deadlift: "hinge",
    bulgarian_split_squat: "single_leg_squat", nordic_curl: "knee_flexion_isolation", self_resisted_neck_isometric: "neck_isometric" };
  const session = Object.keys(pattern).map((exercise_id) => ({ exercise_id }));
  const { exercises, held_back } = holdBackAfterHeadInjury(session, (id) => pattern[id]);
  assert.deepEqual(exercises.map((e) => e.exercise_id), ["trap_bar_deadlift", "bulgarian_split_squat", "nordic_curl"]);
  assert.deepEqual(held_back, ["ten_metre_acceleration", "countermovement_jump", "self_resisted_neck_isometric"]);
});

test("a session that is all sprints and jumps is held back entirely, never served as-is", () => {
  const { exercises } = holdBackAfterHeadInjury([{ exercise_id: "a" }, { exercise_id: "b" }], () => "sprint_max_velocity");
  assert.equal(exercises.length, 0);
});

test("a coach's session in the return week is lighter: a set fewer, RPE work a point easier, the coach's loads kept", async () => {
  const { lighterAfterHeadInjury } = await import("../dist/src/api/head_injury_return.js");
  const out = lighterAfterHeadInjury([
    { exercise_id: "back_squat", sets: 4, reps: 5, intensity: { type: "percent_1rm", value: 75 }, resolved_load: { value: 112.5, unit: "kg" } },
    { exercise_id: "chin_up", sets: 3, reps: 8, intensity: { type: "rpe", value: 8 } },
    { exercise_id: "dead_bug", sets: 1, reps: 8, intensity: { type: "bodyweight" } }
  ]);
  assert.deepEqual(out.map((e) => [e.sets, e.intensity]), [[3, { type: "percent_1rm", value: 75 }], [2, { type: "rpe", value: 7 }], [1, { type: "bodyweight" }]]);
  assert.equal(out[0].resolved_load.value, 112.5);
});
