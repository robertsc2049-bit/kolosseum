import test from "node:test";
import assert from "node:assert/strict";
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

test("Phase 5 returns empty adjustments when Phase 4 is a stub (unsupported activity)", () => {
  const res = runEngine({
    ...BASE,
    activity_id: "rugby"
  });

  assert.equal(res.ok, true);
  assert.ok(res.phase5);
  assert.deepEqual(res.phase5.adjustments, []);
});

test("Phase 5 targets Phase4 pruned plan order (planned_items preferred when present) and substitutes when constraints require it", () => {
  const res = runEngine({
    ...BASE,
    activity_id: "powerlifting",
    constraints: {
      constraints_version: "1.0.0",
      avoid_joint_stress_tags: ["shoulder_high"]
    }
  });

  assert.equal(res.ok, true);
  assert.ok(res.phase4);
  assert.ok(res.phase5);

  // Expected target is Phase4's post-prune plan head:
  // Prefer planned_items[0].exercise_id if Phase4 exposes it; otherwise planned_exercise_ids[0].
  let expectedTarget = null;

  if (res.phase4.planned_items && Array.isArray(res.phase4.planned_items) && res.phase4.planned_items.length > 0) {
    const first = res.phase4.planned_items[0];
    if (first && typeof first.exercise_id === "string" && first.exercise_id.length > 0) {
      expectedTarget = first.exercise_id;
    }
  }

  if (!expectedTarget) {
    assert.ok(Array.isArray(res.phase4.planned_exercise_ids));
    assert.ok(res.phase4.planned_exercise_ids.length > 0);
    expectedTarget = res.phase4.planned_exercise_ids[0];
  }

  assert.equal(res.phase5.adjustments.length, 1);
  assert.equal(res.phase5.adjustments[0].adjustment_id, "SUBSTITUTE_EXERCISE");

  const details = res.phase5.adjustments[0].details;
  assert.ok(details && typeof details === "object");

  assert.equal(details.target_exercise_id, expectedTarget);
  assert.equal(typeof details.substitute_exercise_id, "string");
  assert.ok(details.substitute_exercise_id.length > 0);
});