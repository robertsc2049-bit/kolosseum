import test from "node:test";
import assert from "node:assert/strict";

import { phase1Validate } from "../dist/engine/src/phases/phase1.js";
import { phase2CanonicaliseAndHash } from "../dist/engine/src/phases/phase2.js";

function compileLikeApiFromRawJson(rawBodyJson) {
  const body = JSON.parse(rawBodyJson);

  assert.ok(body && typeof body === "object", "body must be object");
  assert.ok(Object.prototype.hasOwnProperty.call(body, "phase1_input"), "body.phase1_input missing");

  const p1 = phase1Validate(body.phase1_input);
  assert.equal(p1.ok, true, "phase1Validate should pass");
  const canonical_input = p1.canonical_input;

  const p2 = phase2CanonicaliseAndHash(canonical_input);
  assert.equal(p2.ok, true, "phase2CanonicaliseAndHash should pass");

  return {
    canonical_hash: p2.phase2.phase2_hash,
    phase2_canonical_json: p2.phase2.phase2_canonical_json
  };
}

test("API boundary: canonical_hash identical for permuted available_equipment order", () => {
  const phase1Base = {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "general_strength",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none",
    constraints: {
      constraints_version: "1.0.0"
    }
  };

  const rawA = JSON.stringify({
    phase1_input: {
      ...phase1Base,
      constraints: {
        ...phase1Base.constraints,
        available_equipment: ["eq_barbell", "eq_dumbbell", "eq_bench", "eq_rack", "eq_plate"]
      }
    }
  });

  const rawB = JSON.stringify({
    phase1_input: {
      ...phase1Base,
      constraints: {
        ...phase1Base.constraints,
        available_equipment: ["eq_plate", "eq_rack", "eq_bench", "eq_dumbbell", "eq_barbell"]
      }
    }
  });

  const a = compileLikeApiFromRawJson(rawA);
  const b = compileLikeApiFromRawJson(rawB);

  assert.equal(
    a.canonical_hash,
    b.canonical_hash,
    "canonical_hash must not depend on the order of available_equipment"
  );

  // Stronger: canonical JSON must contain the sorted equipment list
  const parsed = JSON.parse(a.phase2_canonical_json);
  const equip = parsed?.constraints?.available_equipment;

  assert.ok(Array.isArray(equip) && equip.length === 5, "canonical constraints.available_equipment must be present");

  const sorted = equip.slice().sort((x, y) => String(x).localeCompare(String(y)));
  assert.deepEqual(equip, sorted, "canonical constraints.available_equipment must be sorted deterministically");

  assert.deepEqual(
    equip,
    ["eq_barbell", "eq_bench", "eq_dumbbell", "eq_plate", "eq_rack"],
    "canonical constraints.available_equipment must equal the expected sorted list"
  );
});