import test from "node:test";
import assert from "node:assert/strict";

import { runEngine } from "../dist/engine/src/index.js";

test("Phase 4 emits minimal substitutable program for rugby_union", () => {
  const input = {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "rugby_union",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };

  const res = runEngine(input);
  assert.equal(res.ok, true);
  assert.notEqual(res.phase4.program_id, "PROGRAM_STUB");
  assert.equal(Array.isArray(res.phase4.planned_exercise_ids), true);
  assert.equal(res.phase4.planned_exercise_ids.length, 1);
  assert.equal(Array.isArray(res.phase4.exercises), true);
  assert.ok(res.phase4.exercises.length >= 2);
  assert.equal(typeof res.phase4.exercise_pool, "object");
  assert.ok(Object.keys(res.phase4.exercise_pool).length >= 2);
});

test("Phase 4 emits minimal substitutable program for general_strength", () => {
  const input = {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "general_strength",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };

  const res = runEngine(input);
  assert.equal(res.ok, true);
  assert.notEqual(res.phase4.program_id, "PROGRAM_STUB");
  assert.equal(Array.isArray(res.phase4.planned_exercise_ids), true);
  assert.equal(res.phase4.planned_exercise_ids.length, 1);
  assert.equal(Array.isArray(res.phase4.exercises), true);
  assert.ok(res.phase4.exercises.length >= 2);
  assert.equal(typeof res.phase4.exercise_pool, "object");
  assert.ok(Object.keys(res.phase4.exercise_pool).length >= 2);
});

test("Phase 4 emits minimal substitutable program for powerlifting", () => {
  const input = {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "powerlifting",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };

  const res = runEngine(input);
  assert.equal(res.ok, true);
  assert.equal(res.phase4.program_id, "PROGRAM_POWERLIFTING_V0");
});
