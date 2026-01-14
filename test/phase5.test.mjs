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

test("Phase 5 returns empty adjustments when Phase 4 is a stub (non-powerlifting)", () => {
  const res = runEngine({
    ...BASE,
    activity_id: "rugby"
  });

  assert.equal(res.ok, true);
  assert.ok(res.phase5);
  assert.deepEqual(res.phase5.adjustments, []);
});

test("Phase 5 performs substitution for powerlifting v0 program when constraints require it", () => {
  const res = runEngine({
    ...BASE,
    activity_id: "powerlifting",
    constraints: {
      avoid_joint_stress_tags: ["shoulder_high"]
    }
  });

  assert.equal(res.ok, true);
  assert.ok(res.phase5);
  assert.equal(res.phase5.adjustments.length, 1);
  assert.equal(res.phase5.adjustments[0].adjustment_id, "SUBSTITUTE_EXERCISE");
});
