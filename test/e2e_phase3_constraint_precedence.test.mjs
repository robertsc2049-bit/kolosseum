import assert from "node:assert/strict";
import test from "node:test";
import { runEngine } from "../dist/engine/src/index.js";

test("T012 E2E: constraints envelope present (empty {}) suppresses Phase3 defaults", () => {
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

    // Presence matters: must suppress Phase3 default injection.
    constraints: {}
  };

  const out = runEngine(input);
  assert.equal(out.ok, true);

  // Phase2 must preserve presence (Ticket 011 regression guard)
  assert.ok(typeof out.phase2_canonical_json === "string");
  assert.ok(out.phase2_canonical_json.includes('"constraints":{}'));

  // Phase3 must not inject demo defaults when envelope present
  assert.deepEqual(out.phase3.constraints, {});

  // Phase5 should no-op
  assert.equal(out.phase5.adjustments.length, 0);

  // Phase6 must emit planned bench, no substitution trace
  assert.equal(out.phase6.exercises.length, 1);
  assert.equal(out.phase6.exercises[0].exercise_id, "bench_press");
  assert.equal(out.phase6.exercises[0].substituted_from, undefined);
});
