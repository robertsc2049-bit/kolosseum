import test from "node:test";
import assert from "node:assert/strict";
import { runEngine } from "../dist/engine/src/index.js";

const BASE = {
  consent_granted: true,
  engine_version: "EB2-1.0.0",
  enum_bundle_version: "EB2-1.0.0",
  phase1_schema_version: "1.0.0",
  actor_type: "athlete",
  execution_scope: "individual",
  nd_mode: false,
  instruction_density: "standard",
  exposure_prompt_density: "standard",
  bias_mode: "none"
};

function assertPhase4Surface(res) {
  assert.equal(res.ok, true);

  assert.notEqual(res.phase4.program_id, "PROGRAM_STUB");

  // planned
  assert.equal(Array.isArray(res.phase4.planned_exercise_ids), true);
  assert.equal(res.phase4.planned_exercise_ids.length, 1);

  // target
  assert.equal(typeof res.phase4.target_exercise_id, "string");
  assert.equal(
    res.phase4.target_exercise_id,
    res.phase4.planned_exercise_ids[0]
  );

  // candidates
  assert.equal(Array.isArray(res.phase4.exercises), true);
  assert.ok(res.phase4.exercises.length >= 2);

  // pool
  assert.equal(typeof res.phase4.exercise_pool, "object");
  assert.ok(
    res.phase4.exercise_pool[res.phase4.target_exercise_id],
    "exercise_pool must contain the planned/target exercise"
  );
  assert.ok(Object.keys(res.phase4.exercise_pool).length >= 2);
}

test("Phase 4 emits minimal substitutable program for rugby_union", () => {
  const res = runEngine({
    ...BASE,
    activity_id: "rugby_union"
  });

  assertPhase4Surface(res);
  assert.equal(res.phase4.program_id, "PROGRAM_RUGBY_UNION_V0");
});

test("Phase 4 emits minimal substitutable program for general_strength", () => {
  const res = runEngine({
    ...BASE,
    activity_id: "general_strength"
  });

  assertPhase4Surface(res);
  assert.equal(res.phase4.program_id, "PROGRAM_GENERAL_STRENGTH_V0");
});

test("Phase 4 emits minimal substitutable program for powerlifting", () => {
  const res = runEngine({
    ...BASE,
    activity_id: "powerlifting"
  });

  assertPhase4Surface(res);
  assert.equal(res.phase4.program_id, "PROGRAM_POWERLIFTING_V0");
});
