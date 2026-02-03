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
  nd_mode: false,
  instruction_density: "standard",
  exposure_prompt_density: "standard",
  bias_mode: "none"
};

function isNonEmptyString(x) {
  return typeof x === "string" && x.length > 0;
}

function isUniqueStable(xs) {
  const seen = new Set();
  for (const x of xs) {
    if (!isNonEmptyString(x)) return false;
    if (seen.has(x)) return false;
    seen.add(x);
  }
  return true;
}

function assertPhase4Surface(out, expectedProgramId) {
  assert.equal(out.ok, true);

  const p4 = out.phase4;
  assert.ok(p4, "phase4 missing");

  // Program identity
  assert.equal(p4.program_id, expectedProgramId);
  assert.ok(isNonEmptyString(p4.version));
  assert.ok(Array.isArray(p4.blocks));

  // Multi-exercise plan contract (v0+)
  assert.ok(Array.isArray(p4.planned_exercise_ids), "planned_exercise_ids missing");
  assert.ok(p4.planned_exercise_ids.length >= 2, "planned_exercise_ids must be >=2");
  assert.ok(isUniqueStable(p4.planned_exercise_ids), "planned_exercise_ids must be unique");

  // Target is first planned item (Ticket 011 single-target rule)
  assert.ok(isNonEmptyString(p4.target_exercise_id), "target_exercise_id missing");
  assert.equal(p4.target_exercise_id, p4.planned_exercise_ids[0]);

  // Pool surfaces present
  assert.ok(Array.isArray(p4.exercises), "exercises[] missing");
  assert.ok(p4.exercises.length >= p4.planned_exercise_ids.length);

  assert.ok(p4.exercise_pool && typeof p4.exercise_pool === "object", "exercise_pool missing");
  for (const id of p4.planned_exercise_ids) {
    assert.ok(
      p4.exercise_pool[id],
      `exercise_pool must include planned exercise id: ${id}`
    );
    assert.equal(
      p4.exercise_pool[id].exercise_id,
      id,
      `exercise_pool entry mismatch for: ${id}`
    );
  }

  // Canonical constraints carried through (Phase3 authoritative)
  // (Just check it exists as an object; Phase3 tests cover resolution)
  assert.ok("constraints" in p4, "constraints field missing on phase4 surface");
}

test("Phase4 output deterministic for powerlifting", () => {
  const out1 = runEngine({ ...BASE, activity_id: "powerlifting" });
  const out2 = runEngine({ ...BASE, activity_id: "powerlifting" });
  assert.equal(out1.ok, true);
  assert.equal(out2.ok, true);
  assert.deepEqual(out1.phase4, out2.phase4);
});

test("Phase4 output deterministic for rugby_union", () => {
  const out1 = runEngine({ ...BASE, activity_id: "rugby_union" });
  const out2 = runEngine({ ...BASE, activity_id: "rugby_union" });
  assert.equal(out1.ok, true);
  assert.equal(out2.ok, true);
  assert.deepEqual(out1.phase4, out2.phase4);
});

test("Phase4 output deterministic for general_strength", () => {
  const out1 = runEngine({ ...BASE, activity_id: "general_strength" });
  const out2 = runEngine({ ...BASE, activity_id: "general_strength" });
  assert.equal(out1.ok, true);
  assert.equal(out2.ok, true);
  assert.deepEqual(out1.phase4, out2.phase4);
});

test("Phase 4 emits minimal substitutable program for rugby_union", () => {
  const out = runEngine({ ...BASE, activity_id: "rugby_union" });
  assertPhase4Surface(out, "PROGRAM_RUGBY_UNION_V1");
});

test("Phase 4 emits minimal substitutable program for general_strength", () => {
  const out = runEngine({ ...BASE, activity_id: "general_strength" });
  assertPhase4Surface(out, "PROGRAM_GENERAL_STRENGTH_V1");
});

test("Phase 4 emits minimal substitutable program for powerlifting", () => {
  const out = runEngine({ ...BASE, activity_id: "powerlifting" });
  assertPhase4Surface(out, "PROGRAM_POWERLIFTING_V1");
});
