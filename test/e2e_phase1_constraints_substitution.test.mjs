import assert from "node:assert/strict";
import test from "node:test";
import { runEngine } from "../dist/engine/src/index.js";

const BASE = {
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

test("E2E: Phase1 constraints envelope persists into Phase2 canonical JSON and drives substitution end-to-end", () => {
  const out = runEngine({
    ...BASE,
    constraints: {
      constraints_version: "1.0.0",
      avoid_joint_stress_tags: ["shoulder_high"]
    }
  });

  assert.equal(out.ok, true);

  assert.ok(typeof out.phase2_canonical_json === "string");
  assert.ok(out.phase2_canonical_json.includes('"constraints_version"'));
  assert.ok(out.phase2_canonical_json.includes('"1.0.0"'));
  assert.ok(out.phase2_canonical_json.includes('"avoid_joint_stress_tags"'));
  assert.ok(out.phase2_canonical_json.includes('"shoulder_high"'));

  assert.equal(out.phase4.program_id, "PROGRAM_POWERLIFTING_V0");

  assert.ok(Array.isArray(out.phase5.adjustments));
  assert.equal(out.phase5.adjustments.length, 1);
  assert.equal(out.phase5.adjustments[0].adjustment_id, "SUBSTITUTE_EXERCISE");

  assert.equal(out.phase6.session_id, "SESSION_V1");
  assert.ok(Array.isArray(out.phase6.exercises));
  assert.equal(out.phase6.exercises.length, 1);

  const ex = out.phase6.exercises[0];
  assert.equal(ex.exercise_id, "dumbbell_bench_press");
  assert.equal(ex.substituted_from, "bench_press");
});


