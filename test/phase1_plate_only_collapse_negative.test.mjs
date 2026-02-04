import assert from "node:assert/strict";
import test from "node:test";
import { phase1Validate } from "../dist/engine/src/phases/phase1.js";

test("Phase1: rejects plate-only when mixed with other available_equipment tokens", () => {
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
    bias_mode: "none",
    constraints: {
      constraints_version: "1.0.0",
      available_equipment: ["plate-only", "dumbbell", "plates"]
    }
  };

  const r = phase1Validate(input);

  assert.equal(r.ok, false, "expected ok=false");
  assert.equal(r.failure_token, "plate_only_mixed_with_other_tokens");
  assert.deepEqual(r.details?.list, "available_equipment");
});

test("Phase1: rejects plate-only when mixed with other banned_equipment tokens", () => {
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
    bias_mode: "none",
    constraints: {
      constraints_version: "1.0.0",
      banned_equipment: ["plates_only", "barbell"]
    }
  };

  const r = phase1Validate(input);

  assert.equal(r.ok, false, "expected ok=false");
  assert.equal(r.failure_token, "plate_only_mixed_with_other_tokens");
  assert.deepEqual(r.details?.list, "banned_equipment");
});