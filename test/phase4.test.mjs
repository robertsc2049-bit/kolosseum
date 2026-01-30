import test from "node:test";
import assert from "node:assert/strict";

import { runEngine } from "../dist/engine/src/index.js";

test("Phase 4 returns PROGRAM_STUB for unknown activity", () => {
  const input = {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "unknown_activity",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };

  const res = runEngine(input);
  assert.equal(res.ok, true);
  assert.equal(res.phase4.program_id, "PROGRAM_STUB");
});

test("Phase 4 emits minimal substitutable program for powerlifting", () => {
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
  assert.equal(res.phase4.program_id, "PROGRAM_POWERLIFTING_V0");
});
