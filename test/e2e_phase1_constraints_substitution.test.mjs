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

function ids(xs) {
  return (Array.isArray(xs) ? xs : [])
    .map((x) => String(x?.exercise_id ?? x ?? ""))
    .filter(Boolean);
}

test("E2E: Phase1 constraints persist and drive a single deterministic substitution (multi-exercise plan)", () => {
  const out = runEngine({
    ...BASE,
    constraints: {
      constraints_version: "1.0.0",
      avoid_joint_stress_tags: ["shoulder_high"]
    }
  });

  assert.equal(out.ok, true);

  // Phase2 canonical JSON includes the constraint envelope
  assert.ok(typeof out.phase2_canonical_json === "string");
  assert.ok(out.phase2_canonical_json.includes('"constraints_version"'));
  assert.ok(out.phase2_canonical_json.includes('"1.0.0"'));
  assert.ok(out.phase2_canonical_json.includes('"avoid_joint_stress_tags"'));
  assert.ok(out.phase2_canonical_json.includes('"shoulder_high"'));

  // Phase4 program id should be powerlifting v0
  assert.equal(out.phase4.program_id, "PROGRAM_POWERLIFTING_V0");

  // Phase5: exactly one substitution adjustment (Ticket 011 rule: only substitute target)
  assert.ok(Array.isArray(out.phase5.adjustments));
  assert.equal(out.phase5.adjustments.length, 1);
  assert.equal(out.phase5.adjustments[0].adjustment_id, "SUBSTITUTE_EXERCISE");
  assert.equal(out.phase5.adjustments[0].applied, true);

  const d = out.phase5.adjustments[0].details ?? {};
  assert.equal(d.target_exercise_id, "bench_press");
  assert.equal(d.substitute_exercise_id, "dumbbell_bench_press");

  // Phase6: multi-exercise plan => 2 session exercises (unique final plan)
  assert.equal(out.phase6.session_id, "SESSION_V1");
  assert.ok(Array.isArray(out.phase6.exercises));

  const phase6Ids = ids(out.phase6.exercises);
  assert.equal(phase6Ids.length, 2);

  // Substitution applied to bench_press only; back_squat remains
  assert.ok(phase6Ids.includes("dumbbell_bench_press"));
  assert.ok(phase6Ids.includes("back_squat"));

  // Substitution trace: exactly one exercise should have substituted_from
  const substituted = (out.phase6.exercises ?? []).filter(
    (x) => typeof x?.substituted_from === "string" && x.substituted_from.length > 0
  );
  assert.equal(substituted.length, 1);
  assert.equal(substituted[0].exercise_id, "dumbbell_bench_press");
  assert.equal(substituted[0].substituted_from, "bench_press");
});
