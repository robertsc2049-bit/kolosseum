import assert from "node:assert/strict";
import test from "node:test";
import { runEngine } from "../dist/engine/src/index.js";

const MIN_PHASE1 = {
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
  bias_mode: "none",

  // Pin envelope present (versioned) so Phase3 defaults cannot inject disqualifiers.
  constraints: { constraints_version: "1.0.0" }
};

test("E2E: Phase 4 planned list; Phase 5 no-op under empty constraints; Phase 6 emits single planned exercise", () => {
  const out = runEngine(MIN_PHASE1);

  assert.equal(out.ok, true);

  assert.ok(out.phase4);
  assert.equal(out.phase4.program_id, "PROGRAM_POWERLIFTING_V0");

  assert.ok(out.phase5);
  assert.ok(Array.isArray(out.phase5.adjustments));
  assert.equal(out.phase5.adjustments.length, 0);

  assert.ok(out.phase6);
  assert.equal(out.phase6.session_id, "SESSION_V1");
  assert.ok(Array.isArray(out.phase6.exercises));
  assert.equal(out.phase6.exercises.length, 1);

  const ex = out.phase6.exercises[0];
  assert.equal(ex.exercise_id, "bench_press");
  assert.equal(ex.substituted_from, undefined);
});




