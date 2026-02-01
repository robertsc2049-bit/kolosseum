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

function substitutedExercises(exs) {
  return (Array.isArray(exs) ? exs : []).filter(
    (e) => typeof e?.substituted_from === "string" && e.substituted_from.length > 0
  );
}

function assertSingleSubstitutionMultiPlan(out) {
  assert.equal(out.ok, true);
  assert.equal(out.phase6.session_id, "SESSION_V1");
  assert.ok(Array.isArray(out.phase6.exercises));

  const exs = out.phase6.exercises;
  assert.ok(exs.length >= 2, "multi-plan must have >=2 exercises");

  const subs = substitutedExercises(exs);
  assert.equal(subs.length, 1, "expected exactly one substituted exercise");

  // Sanity: a substitution must actually change the id.
  assert.notEqual(subs[0].exercise_id, subs[0].substituted_from, "substitution must change exercise_id");
}

function assertSingleSubstitutionMultiPlanAndContains(out, expectedSubId) {
  assertSingleSubstitutionMultiPlan(out);
  const ids = out.phase6.exercises.map((x) => String(x?.exercise_id ?? "")).filter(Boolean);
  assert.ok(ids.includes(expectedSubId), `expected substituted exercise id ${expectedSubId} to be present`);
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

  // Powerlifting case is already proven to land on this deterministic substitute.
  assertSingleSubstitutionMultiPlanAndContains(out, "dumbbell_bench_press");
});

test("T011 E2E: rugby_union — banned_equipment drives substitution; Phase6 emits a single substituted exercise deterministically (multi-plan)", () => {
  const out = runEngine({
    ...BASE,
    activity_id: "rugby_union",
    constraints: {
      constraints_version: "1.0.0",
      banned_equipment: ["barbell"]
    }
  });

  // Do NOT hardcode the exact substitute id here unless you want the registry to be frozen by this test.
  assertSingleSubstitutionMultiPlan(out);
});

test("T011 E2E: general_strength — banned_equipment drives substitution; Phase6 emits a single substituted exercise deterministically (multi-plan)", () => {
  const out = runEngine({
    ...BASE,
    activity_id: "general_strength",
    constraints: {
      constraints_version: "1.0.0",
      banned_equipment: ["barbell"]
    }
  });

  // Do NOT hardcode the exact substitute id here unless you want the registry to be frozen by this test.
  assertSingleSubstitutionMultiPlan(out);
});