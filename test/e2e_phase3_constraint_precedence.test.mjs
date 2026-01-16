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

test("T012 E2E: constraints envelope present (minimal versioned) suppresses Phase3 defaults", () => {
  const out = runEngine({
    ...BASE,
    constraints: {
      constraints_version: "1.0.0"
    }
  });

  assert.equal(out.ok, true);

  // Phase3 must NOT inject defaults when envelope present.
  assert.deepEqual(out.phase3.constraints, {});
});

