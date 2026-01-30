// test/e2e_ticket011_actionable_constraints_substitution.test.mjs
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
  nd_mode: false,
  instruction_density: "standard",
  exposure_prompt_density: "standard",
  bias_mode: "none"
};

function assertSingleSubstitution(out) {
  assert.equal(out.ok, true);

  assert.ok(Array.isArray(out.phase5.adjustments));
  assert.equal(out.phase5.adjustments.length, 1);
  assert.equal(out.phase5.adjustments[0].adjustment_id, "SUBSTITUTE_EXERCISE");
  assert.equal(out.phase5.adjustments[0].applied, true);

  assert.equal(out.phase6.session_id, "SESSION_V1");
  assert.ok(Array.isArray(out.phase6.exercises));
  assert.equal(out.phase6.exercises.length, 1);
}

test("T011 E2E: powerlifting — avoid_joint_stress_tags drives substitution; Phase6 emits substituted exercise deterministically", () => {
  const out = runEngine({
    ...BASE,
    activity_id: "powerlifting",
    constraints: {
      constraints_version: "1.0.0",
      avoid_joint_stress_tags: ["shoulder_high"]
    }
  });

  assertSingleSubstitution(out);
  assert.equal(out.phase4.program_id, "PROGRAM_POWERLIFTING_V0");

  const ex = out.phase6.exercises[0];
  assert.equal(ex.exercise_id, "dumbbell_bench_press");
  assert.equal(ex.substituted_from, "bench_press");
});

test("T011 E2E: rugby_union — banned_equipment drives substitution; Phase6 emits substituted exercise deterministically", () => {
  const out = runEngine({
    ...BASE,
    activity_id: "rugby_union",
    constraints: {
      constraints_version: "1.0.0",
      banned_equipment: ["barbell"]
    }
  });

  assertSingleSubstitution(out);
  assert.equal(out.phase4.program_id, "PROGRAM_RUGBY_UNION_V0");

  const ex = out.phase6.exercises[0];
  assert.equal(ex.exercise_id, "goblet_squat");
  assert.equal(ex.substituted_from, "back_squat");
});

test("T011 E2E: general_strength — banned_equipment drives substitution; Phase6 emits substituted exercise deterministically", () => {
  const out = runEngine({
    ...BASE,
    activity_id: "general_strength",
    constraints: {
      constraints_version: "1.0.0",
      banned_equipment: ["barbell"]
    }
  });

  assertSingleSubstitution(out);
  assert.equal(out.phase4.program_id, "PROGRAM_GENERAL_STRENGTH_V0");

  const ex = out.phase6.exercises[0];
  assert.equal(ex.exercise_id, "kettlebell_deadlift");
  assert.equal(ex.substituted_from, "deadlift");
});
