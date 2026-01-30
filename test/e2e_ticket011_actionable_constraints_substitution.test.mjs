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

function phase6Ids(out) {
  return (Array.isArray(out?.phase6?.exercises) ? out.phase6.exercises : [])
    .map((x) => String(x?.exercise_id ?? ""))
    .filter(Boolean);
}

function substitutions(out) {
  return (Array.isArray(out?.phase6?.exercises) ? out.phase6.exercises : []).filter(
    (x) => typeof x?.substituted_from === "string" && x.substituted_from.length > 0
  );
}

/**
 * Ticket 011 contract (current engine behavior):
 * - Phase4 emits a multi-exercise plan (>=2 planned ids).
 * - Phase5 applies AT MOST ONE substitution adjustment (target exercise only).
 * - Phase6 mirrors the plan, applying that single substitution to any occurrence of the target.
 * - Other planned exercises remain untouched even if they would be disqualified by constraints.
 */
function assertSingleSubstitutionMultiPlan(out, expected) {
  assert.equal(out.ok, true);

  // Phase5 must emit exactly one adjustment
  assert.ok(Array.isArray(out.phase5.adjustments));
  assert.equal(out.phase5.adjustments.length, 1);

  const adj = out.phase5.adjustments[0];
  assert.equal(adj.adjustment_id, "SUBSTITUTE_EXERCISE");
  assert.equal(adj.applied, true);

  const d = adj.details ?? {};
  assert.equal(d.target_exercise_id, expected.target);
  assert.equal(d.substitute_exercise_id, expected.substitute);

  // Phase6 must emit the multi-exercise plan (unique final ids)
  assert.equal(out.phase6.session_id, "SESSION_V1");
  assert.ok(Array.isArray(out.phase6.exercises));

  const ids = phase6Ids(out);
  assert.equal(ids.length, 2);

  // Must contain the substituted exercise and the untouched "other" exercise
  assert.ok(ids.includes(expected.substitute));
  assert.ok(ids.includes(expected.other_untouched));

  // Exactly one exercise in the session should carry substituted_from
  const subs = substitutions(out);
  assert.equal(subs.length, 1);
  assert.equal(subs[0].exercise_id, expected.substitute);
  assert.equal(subs[0].substituted_from, expected.target);
}

test("T011 E2E: powerlifting — avoid_joint_stress_tags drives substitution; Phase6 emits substituted exercise deterministically (multi-plan)", () => {
  const out = runEngine({
    ...BASE,
    activity_id: "powerlifting",
    constraints: {
      constraints_version: "1.0.0",
      avoid_joint_stress_tags: ["shoulder_high"]
    }
  });

  assertSingleSubstitutionMultiPlan(out, {
    target: "bench_press",
    substitute: "dumbbell_bench_press",
    other_untouched: "back_squat"
  });
});

test("T011 E2E: rugby_union — banned_equipment drives substitution; Phase6 emits substituted exercise deterministically (multi-plan)", () => {
  const out = runEngine({
    ...BASE,
    activity_id: "rugby_union",
    constraints: {
      constraints_version: "1.0.0",
      banned_equipment: ["barbell"]
    }
  });

  // Note: bench_press remains as the other planned exercise (unchanged).
  assertSingleSubstitutionMultiPlan(out, {
    target: "back_squat",
    substitute: "goblet_squat",
    other_untouched: "bench_press"
  });
});

test("T011 E2E: general_strength — banned_equipment drives substitution; Phase6 emits substituted exercise deterministically (multi-plan)", () => {
  const out = runEngine({
    ...BASE,
    activity_id: "general_strength",
    constraints: {
      constraints_version: "1.0.0",
      banned_equipment: ["barbell"]
    }
  });

  // Note: bench_press remains as the other planned exercise (unchanged).
  assertSingleSubstitutionMultiPlan(out, {
    target: "deadlift",
    substitute: "kettlebell_deadlift",
    other_untouched: "bench_press"
  });
});
