import test from "node:test";
import assert from "node:assert/strict";

// Phase4 is compiled under dist/engine/... (node runs .mjs tests, so import JS output).
import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";

function mkPhase3(constraints = { constraints_version: "1.0.0" }) {
  return { constraints };
}

function assertNonEmptyString(v, label) {
  assert.equal(typeof v, "string", `${label} must be a string`);
  assert.ok(v.trim().length > 0, `${label} must be non-empty`);
}

function assertPositiveInt(v, label) {
  assert.equal(typeof v, "number", `${label} must be a number`);
  assert.ok(Number.isInteger(v), `${label} must be an integer`);
  assert.ok(v > 0, `${label} must be > 0`);
}

function assertPlannedItem(it, index) {
  assertNonEmptyString(it.block_id, `planned_items[${index}].block_id`);
  assertNonEmptyString(it.item_id, `planned_items[${index}].item_id`);
  assertNonEmptyString(it.exercise_id, `planned_items[${index}].exercise_id`);

  // These are required for Phase6 emission + rendered_text formatting.
  assertPositiveInt(it.sets, `planned_items[${index}].sets`);
  assertPositiveInt(it.reps, `planned_items[${index}].reps`);
}

function assertStableUnique(list, label) {
  assert.ok(Array.isArray(list), `${label} must be an array`);
  const asStrings = list.map((x) => String(x));
  const trimmed = asStrings.map((s) => s.trim());

  // No blanks
  for (let i = 0; i < trimmed.length; i++) {
    assert.ok(trimmed[i].length > 0, `${label}[${i}] must be non-empty`);
  }

  // Uniqueness
  const set = new Set(trimmed);
  assert.equal(set.size, trimmed.length, `${label} must contain unique ids`);

  // Stable order requirement is implicit: we compare arrays later.
}

function assertPhase4PlanContract(program, { minItems = 2 } = {}) {
  assertNonEmptyString(program.program_id, "program.program_id");
  assertNonEmptyString(program.version, "program.version");

  // planned_items is the authoritative plan surface (rich path used by Phase6).
  assert.ok(Array.isArray(program.planned_items), "program.planned_items must be an array");
  assert.ok(program.planned_items.length >= minItems, `program.planned_items must have >= ${minItems} items`);

  // planned_exercise_ids must exist and be 1:1 with planned_items, same order.
  assert.ok(Array.isArray(program.planned_exercise_ids), "program.planned_exercise_ids must be an array");
  assert.equal(
    program.planned_exercise_ids.length,
    program.planned_items.length,
    "program.planned_exercise_ids length must equal planned_items length"
  );

  // Validate every planned item shape + content.
  for (let i = 0; i < program.planned_items.length; i++) {
    assertPlannedItem(program.planned_items[i], i);
  }

  const fromItems = program.planned_items.map((x) => x.exercise_id);
  assert.deepEqual(
    program.planned_exercise_ids,
    fromItems,
    "program.planned_exercise_ids must equal planned_items.exercise_id (same order)"
  );

  // Must be stable unique ids.
  assertStableUnique(program.planned_exercise_ids, "program.planned_exercise_ids");

  // Deterministic target: first planned id.
  assertNonEmptyString(program.target_exercise_id, "program.target_exercise_id");
  assert.equal(
    program.target_exercise_id,
    program.planned_exercise_ids[0],
    "program.target_exercise_id must equal planned_exercise_ids[0]"
  );

  // Candidate pool for substitution (Phase5) must be present and consistent.
  assert.ok(Array.isArray(program.exercises), "program.exercises must be an array");
  assert.equal(typeof program.exercise_pool, "object", "program.exercise_pool must be an object");
  assert.ok(program.exercise_pool && !Array.isArray(program.exercise_pool), "program.exercise_pool must be a map/object");

  // The pool must at least include all planned ids (otherwise Phase5 can’t score safely).
  for (const id of program.planned_exercise_ids) {
    assert.ok(program.exercise_pool[id], `exercise_pool must include planned id: ${id}`);
  }
}

test("Phase4: supported activities emit a rich, stable plan contract (powerlifting)", () => {
  const canonicalInput = { activity_id: "powerlifting" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assert.ok(r.program, "result.program must exist");

  assertPhase4PlanContract(r.program, { minItems: 2 });

  // Powerlifting currently emits a 6-slot plan (guardrail). If this changes intentionally,
  // update this test in the same commit as the engine change.
  assert.equal(r.program.planned_items.length, 6, "powerlifting planned_items length must be 6");
});

test("Phase4: supported activities emit a rich, stable plan contract (rugby_union)", () => {
  const canonicalInput = { activity_id: "rugby_union" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assertPhase4PlanContract(r.program, { minItems: 2 });

  // Same 6-slot plan contract for now.
  assert.equal(r.program.planned_items.length, 6, "rugby_union planned_items length must be 6");
});

test("Phase4: supported activities emit a rich, stable plan contract (general_strength)", () => {
  const canonicalInput = { activity_id: "general_strength" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assertPhase4PlanContract(r.program, { minItems: 2 });

  // Same 6-slot plan contract for now.
  assert.equal(r.program.planned_items.length, 6, "general_strength planned_items length must be 6");
});

test("Phase4: unsupported activity returns stub program with empty plan + carries Phase3 constraints", () => {
  const constraints = { constraints_version: "1.0.0", demo: true };
  const canonicalInput = { activity_id: "unknown_activity" };
  const phase3 = mkPhase3(constraints);

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed (stub)");
  assert.ok(r.program, "result.program must exist");

  assert.equal(r.program.program_id, "PROGRAM_STUB");
  assert.equal(r.program.version, "1.0.0");

  assert.deepEqual(r.program.planned_items, [], "stub planned_items must be empty");
  assert.deepEqual(r.program.planned_exercise_ids, [], "stub planned_exercise_ids must be empty");
  assert.equal(r.program.target_exercise_id, "", "stub target_exercise_id must be empty");

  // Constraints must be carried forward.
  assert.deepEqual(r.program.constraints, constraints, "stub must carry Phase3 constraints");
});