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

function run(activity_id) {
  return runEngine({ ...BASE, activity_id });
}

for (const activity_id of ["powerlifting", "rugby_union", "general_strength"]) {
  test(`Phase4 output deterministic for ${activity_id}`, () => {
    const a = run(activity_id);
    const b = run(activity_id);

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.deepEqual(a.phase4, b.phase4);
  });
}
