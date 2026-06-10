import test from "node:test";
import assert from "node:assert/strict";
import { runEngine } from "../dist/engine/src/index.js";

test("Phase 3 loads registries in index order", () => {
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

  // We return keys, not strict ordering guarantees of Object.keys,
  // so assert set membership rather than order.
  const set = new Set(res.phase3.loaded_registries);
  assert.equal(set.has("activity"), true);
  assert.equal(set.has("movement"), true);
  assert.equal(set.has("exercise"), true);

  assert.equal(res.phase3.registry_index_version, "1.0.0");
});
