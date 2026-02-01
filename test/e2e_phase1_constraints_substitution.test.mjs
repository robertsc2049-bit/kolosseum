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

function ids(exs) {
  return (Array.isArray(exs) ? exs : []).map((x) => String(x?.exercise_id ?? "")).filter(Boolean);
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

  assert.equal(out.phase6.session_id, "SESSION_V1");
  assert.ok(Array.isArray(out.phase6.exercises));

  // Multi-plan: Phase4 now emits 6 planned_items for supported activities (do not hardcode 2).
  assert.ok(out.phase6.exercises.length >= 2);

  const exIds = ids(out.phase6.exercises);
  assert.ok(exIds.includes("dumbbell_bench_press"), "expected substitute dumbbell_bench_press");
  assert.ok(exIds.includes("back_squat"), "expected back_squat to remain in plan");

  const substituted = out.phase6.exercises.filter(
    (e) => typeof e?.substituted_from === "string" && e.substituted_from.length > 0
  );
  assert.equal(substituted.length, 1, "expected exactly one substituted exercise in multi-plan");
});