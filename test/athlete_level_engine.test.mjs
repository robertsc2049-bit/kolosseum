
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";

import { phase1Validate } from "../dist/engine/src/phases/phase1.js";
import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";
import { templateForLevel } from "../dist/engine/src/phases/phase4/templates.js";

function phase1Input(extra = {}) {
  return {
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
    ...extra
  };
}

test("athlete level: phase 1 accepts each declared level and carries it into the canonical input", () => {
  for (const level of ["beginner", "amateur", "pro"]) {
    const r = phase1Validate(phase1Input({ experience_level: level }));
    assert.equal(r.ok, true, `${level} must validate`);
    assert.equal(r.canonical_input.experience_level, level);
  }
});

test("athlete level: an undeclared level stays absent so pre-level inputs keep their canonical shape", () => {
  const r = phase1Validate(phase1Input());
  assert.equal(r.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(r.canonical_input, "experience_level"), false);
});

test("athlete level: an unknown level is refused, never silently mapped", () => {
  for (const bad of ["expert", "intermediate", "", "PRO"]) {
    const r = phase1Validate(phase1Input({ experience_level: bad }));
    assert.equal(r.ok, false, `${JSON.stringify(bad)} must be refused`);
    assert.equal(r.failure_token, "type_mismatch");
  }
});

const ENTRY = {
  activity_id: "powerlifting",
  template_id: "PROGRAM_TEST_V1",
  exercise_eligibility: ["back_squat", "deadlift"],
  item_prescriptions: [
    { sets: 5, reps: 3, intensity: { type: "percent_1rm", value: 80 }, rest_seconds: 180 },
    { sets: 3, reps: 3, intensity: { type: "percent_1rm", value: 82 }, rest_seconds: 240 }
  ],
  level_variants: {
    beginner: {
      exercise_eligibility: ["goblet_squat"],
      item_prescriptions: [{ sets: 3, reps: 8, intensity: { type: "rpe", value: 6 }, rest_seconds: 90 }]
    }
  }
};

test("athlete level: a declared variant wins; amateur, unknown and variant-less levels use the base entry", () => {
  assert.deepEqual(templateForLevel(ENTRY, "beginner").intent, ["goblet_squat"]);
  assert.deepEqual(templateForLevel(ENTRY, "amateur").intent, ["back_squat", "deadlift"]);
  assert.deepEqual(templateForLevel(ENTRY, "pro").intent, ["back_squat", "deadlift"], "no pro variant falls back to base");
  assert.deepEqual(templateForLevel(ENTRY, undefined).intent, ["back_squat", "deadlift"]);
  assert.equal(templateForLevel(ENTRY, "beginner").program_id, "PROGRAM_TEST_V1");
});

test("athlete level: phase 4 reads the canonical level and falls back to the base programme when no variant exists", () => {
  const base = phase4AssembleProgram({ activity_id: "powerlifting" }, { constraints: { constraints_version: "1.0.0" } });
  const pro = phase4AssembleProgram({ activity_id: "powerlifting", experience_level: "pro" }, { constraints: { constraints_version: "1.0.0" } });
  assert.equal(base.ok, true);
  assert.equal(pro.ok, true);
  assert.deepEqual(pro.program.planned_exercise_ids, base.program.planned_exercise_ids);
});
