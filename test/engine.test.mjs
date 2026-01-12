import test from "node:test";
import assert from "node:assert/strict";
import { runEngine } from "../dist/engine/src/index.js";

test("Phase 2 hash is deterministic for identical input", () => {
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

  const a = runEngine(input);
  const b = runEngine(input);

  assert.equal(a.ok, true);
  assert.equal(b.ok, true);

  assert.equal(a.phase2_hash, b.phase2_hash);
  assert.equal(a.phase2_canonical_json, b.phase2_canonical_json);
});
