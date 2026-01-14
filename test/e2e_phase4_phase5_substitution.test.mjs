import assert from "node:assert/strict";
import test from "node:test";
import { runEngine } from "../dist/engine/src/index.js";

const min = {
  activity_id: "powerlifting",
  actor_type: "athlete",
  bias_mode: "none",
  consent_granted: true,
  engine_version: "EB2-1.0.0",
  enum_bundle_version: "EB2-1.0.0",
  execution_scope: "individual",
  exposure_prompt_density: "standard",
  instruction_density: "standard",
  nd_mode: false,
  phase1_schema_version: "1.0.0"
};

test("E2E: Phase 4 planned list; Phase 5 substitutes once; Phase 6 emits no duplicates", () => {
  const out = runEngine(min);
  assert.equal(out.ok, true);

  // Phase 4: planned should be exactly one exercise in v0
  assert.equal(out.phase4.program_id, "PROGRAM_POWERLIFTING_V0");

  // Phase 5: should substitute bench -> dumbbell bench given shoulder_high avoidance
  assert.ok(Array.isArray(out.phase5.adjustments));
  assert.equal(out.phase5.adjustments.length, 1);
  assert.equal(out.phase5.adjustments[0].adjustment_id, "SUBSTITUTE_EXERCISE");
  assert.equal(out.phase5.adjustments[0].applied, true);

  // Phase 6: must emit exactly one planned exercise, substituted
  assert.equal(out.phase6.session_id, "SESSION_V1");
  assert.ok(Array.isArray(out.phase6.exercises));
  assert.equal(out.phase6.exercises.length, 1);

  assert.equal(out.phase6.exercises[0].exercise_id, "dumbbell_bench_press");
  assert.equal(out.phase6.exercises[0].substituted_from, "bench_press");
});
