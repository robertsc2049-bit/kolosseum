import test from "node:test";
import assert from "node:assert/strict";
import { runEngine } from "../dist/engine/src/index.js";

test("Phase 5 returns deterministic empty adjustments", () => {
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

  assert.deepEqual(res.phase5.adjustments, []);
});
