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

test("T018: Phase1 refuses legacy constraint keys explicitly", () => {
  const legacyKey = "banned_equipment" + "_ids";

  const out = runEngine({
    ...BASE,
    constraints: {
      constraints_version: "1.0.0",
      [legacyKey]: ["barbell"]
    }
  });

  assert.equal(out.ok, false);
  assert.equal(out.failure_token, "legacy_constraints_keys_refused");
});

test("T018: Phase1 refuses missing/invalid constraints_version when envelope present", () => {
  const out = runEngine({
    ...BASE,
    constraints: {
      avoid_joint_stress_tags: ["shoulder_high"]
    }
  });

  assert.equal(out.ok, false);
  assert.equal(out.failure_token, "constraints_version_invalid_or_missing");
});

