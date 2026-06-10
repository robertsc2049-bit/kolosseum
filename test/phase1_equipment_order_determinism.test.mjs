import test from "node:test";
import assert from "node:assert/strict";
import { phase1Validate } from "../dist/engine/src/phases/phase1.js";

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

test("Phase1 canonicalizes equipment lists independent of input order", () => {
  const a = phase1Validate({
    ...BASE,
    constraints: {
      constraints_version: "1.0.0",
      available_equipment: ["eq_barbell", "eq_dumbbell", "eq_plate", "eq_rack", "eq_bench"]
    }
  });

  const b = phase1Validate({
    ...BASE,
    constraints: {
      constraints_version: "1.0.0",
      available_equipment: ["eq_bench", "eq_rack", "eq_plate", "eq_dumbbell", "eq_barbell"]
    }
  });

  assert.equal(a.ok, true, "a should pass phase1Validate");
  assert.equal(b.ok, true, "b should pass phase1Validate");

  const ae = a.canonical_input.constraints?.available_equipment;
  const be = b.canonical_input.constraints?.available_equipment;

  assert.ok(Array.isArray(ae) && ae.length > 0, "a canonical available_equipment should exist");
  assert.ok(Array.isArray(be) && be.length > 0, "b canonical available_equipment should exist");

  assert.deepEqual(ae, be, "canonical available_equipment must match regardless of input order");

  const sorted = ae.slice().sort((x, y) => String(x).localeCompare(String(y)));
  assert.deepEqual(ae, sorted, "canonical available_equipment must be sorted deterministically");
});