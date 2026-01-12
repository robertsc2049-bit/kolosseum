import test from "node:test";
import assert from "node:assert/strict";

import { runEngine } from "../dist/engine/src/index.js";

test("E2E: Phase 4 emits exercises[] and Phase 5 performs substitution (no CLI demo)", () => {
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

  // Phase 4 is now real enough to drive Phase 5
  assert.equal(res.phase4.program_id, "PROGRAM_POWERLIFTING_V0");

  // Phase 5 must contain substitution
  assert.ok(Array.isArray(res.phase5.adjustments));
  assert.equal(res.phase5.adjustments.length, 1);
  assert.equal(res.phase5.adjustments[0].adjustment_id, "SUBSTITUTE_EXERCISE");
  assert.equal(res.phase5.adjustments[0].details.substitute_exercise_id, "dumbbell_bench_press");
});
