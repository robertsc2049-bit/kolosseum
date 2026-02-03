import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Phase4 is compiled under dist/engine/... (node runs .mjs tests, so import JS output).
import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";
import { loadExerciseEntriesFromPath } from "../dist/engine/src/registries/loadExerciseEntries.js";

function mkPhase3(constraints = { constraints_version: "1.0.0" }) {
  return { constraints };
}

function assertNonEmptyString(v, label) {
  assert.equal(typeof v, "string");
  assert.ok(v.trim().length > 0, `${label} must be non-empty`);
}

function assertPositiveInt(v, label) {
  assert.equal(typeof v, "number");
  assert.ok(Number.isInteger(v), `${label} must be an integer`);
  assert.ok(v > 0, `${label} must be > 0`);
}

function assertPlannedItem(it, index) {
  assertNonEmptyString(it.block_id, `planned_items[${index}].block_id`);
  assertNonEmptyString(it.item_id, `planned_items[${index}].item_id`);
  assertNonEmptyString(it.exercise_id, `planned_items[${index}].exercise_id`);

  assertPositiveInt(it.sets, `planned_items[${index}].sets`);
  assertPositiveInt(it.reps, `planned_items[${index}].reps`);
}

function assertStableUnique(list, label) {
  assert.ok(Array.isArray(list), `${label} must be an array`);
  const trimmed = list.map((x) => String(x).trim());

  for (let i = 0; i < trimmed.length; i++) {
    assert.ok(trimmed[i].length > 0, `${label}[${i}] must be non-empty`);
  }

  const set = new Set(trimmed);
  assert.equal(set.size, trimmed.length, `${label} must contain unique ids`);
}

function assertPhase4PlanContract(program, { minItems = 2 } = {}) {
  assertNonEmptyString(program.program_id, "program.program_id");
  assertNonEmptyString(program.version, "program.version");

  assert.ok(Array.isArray(program.planned_items), "program.planned_items must be an array");
  assert.ok(program.planned_items.length >= minItems, `program.planned_items must have >= ${minItems} items`);

  assert.ok(Array.isArray(program.planned_exercise_ids), "program.planned_exercise_ids must be an array");
  assert.equal(
    program.planned_exercise_ids.length,
    program.planned_items.length,
    "program.planned_exercise_ids length must equal planned_items length"
  );

  for (let i = 0; i < program.planned_items.length; i++) {
    assertPlannedItem(program.planned_items[i], i);
  }

  const fromItems = program.planned_items.map((x) => x.exercise_id);
  assert.deepEqual(
    program.planned_exercise_ids,
    fromItems,
    "program.planned_exercise_ids must equal planned_items.exercise_id (same order)"
  );

  assertStableUnique(program.planned_exercise_ids, "program.planned_exercise_ids");

  assertNonEmptyString(program.target_exercise_id, "program.target_exercise_id");
  assert.equal(
    program.target_exercise_id,
    program.planned_exercise_ids[0],
    "program.target_exercise_id must equal planned_exercise_ids[0]"
  );

  assert.ok(Array.isArray(program.exercises), "program.exercises must be an array");

  assert.ok(program.exercise_pool !== null && program.exercise_pool !== undefined, "program.exercise_pool must exist");
  assert.equal(typeof program.exercise_pool, "object");
  assert.ok(!Array.isArray(program.exercise_pool), "program.exercise_pool must be a map/object");

  for (const id of program.planned_exercise_ids) {
    assert.ok(program.exercise_pool[id], `exercise_pool must include planned id: ${id}`);
  }
}

function mkInput(activity_id, tbMinutes) {
  const base = { activity_id };
  if (typeof tbMinutes === "number") {
    base.constraints = {
      constraints_version: "1.0.0",
      schedule: { session_timebox_minutes: tbMinutes }
    };
  }
  return base;
}

function assertTimeboxPlan(program, expectedLen, expectedAccessoryCount) {
  assertPhase4PlanContract(program, { minItems: Math.min(2, expectedLen) });

  assert.equal(program.planned_items.length, expectedLen, `planned_items length must be ${expectedLen}`);

  const primaries = program.planned_items.filter((x) => x.role === "primary");
  const accessories = program.planned_items.filter((x) => x.role === "accessory");

  assert.equal(primaries.length, 4, "must keep all 4 primaries");
  assert.equal(accessories.length, expectedAccessoryCount, `accessory count must be ${expectedAccessoryCount}`);
}

function registryPathFromRepoRoot() {
  return path.join(process.cwd(), "registries", "exercise", "exercise.registry.json");
}

function loadEntriesForTest() {
  const regPath = registryPathFromRepoRoot();
  const entries = loadExerciseEntriesFromPath(regPath);
  return { regPath, entries };
}

test("Phase4: supported activities emit a rich, stable plan contract (powerlifting)", () => {
  const canonicalInput = { activity_id: "powerlifting" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assert.ok(r.program, "result.program must exist");

  assertPhase4PlanContract(r.program, { minItems: 2 });
  assert.equal(r.program.planned_items.length, 6, "powerlifting planned_items length must be 6");
});

test("Phase4: supported activities emit a rich, stable plan contract (rugby_union)", () => {
  const canonicalInput = { activity_id: "rugby_union" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assertPhase4PlanContract(r.program, { minItems: 2 });
  assert.equal(r.program.planned_items.length, 6, "rugby_union planned_items length must be 6");
});

test("Phase4: supported activities emit a rich, stable plan contract (general_strength)", () => {
  const canonicalInput = { activity_id: "general_strength" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true, "phase4AssembleProgram should succeed");
  assertPhase4PlanContract(r.program, { minItems: 2 });
  assert.equal(r.program.planned_items.length, 6, "general_strength planned_items length must be 6");
});

test("Phase4: timebox pruning (powerlifting) tb<30 drops all accessories; tb<45 keeps 1; tb>=45 keeps all", () => {
  const phase3 = mkPhase3();

  {
    const r = phase4AssembleProgram(mkInput("powerlifting", 25), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 4, 0);
  }

  {
    const r = phase4AssembleProgram(mkInput("powerlifting", 40), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 5, 1);
  }

  {
    const r = phase4AssembleProgram(mkInput("powerlifting", 60), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 6, 2);
  }
});

test("Phase4: timebox pruning (rugby_union) tb<30 drops all accessories; tb<45 keeps 1; tb>=45 keeps all", () => {
  const phase3 = mkPhase3();

  {
    const r = phase4AssembleProgram(mkInput("rugby_union", 25), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 4, 0);
  }

  {
    const r = phase4AssembleProgram(mkInput("rugby_union", 40), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 5, 1);
  }

  {
    const r = phase4AssembleProgram(mkInput("rugby_union", 60), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 6, 2);
  }
});

test("Phase4: timebox pruning (general_strength) tb<30 drops all accessories; tb<45 keeps 1; tb>=45 keeps all", () => {
  const phase3 = mkPhase3();

  {
    const r = phase4AssembleProgram(mkInput("general_strength", 25), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 4, 0);
  }

  {
    const r = phase4AssembleProgram(mkInput("general_strength", 40), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 5, 1);
  }

  {
    const r = phase4AssembleProgram(mkInput("general_strength", 60), phase3);
    assert.equal(r.ok, true);
    assertTimeboxPlan(r.program, 6, 2);
  }
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

  assert.deepEqual(r.program.constraints, constraints, "stub must carry Phase3 constraints");
});

test("Phase4: Phase3 timebox is sovereign over raw input when both are present and disagree", () => {
  const canonicalInput = mkInput("powerlifting", 60);
  const phase3 = mkPhase3({
    constraints_version: "1.0.0",
    schedule: { session_timebox_minutes: 25 }
  });

  const r = phase4AssembleProgram(canonicalInput, phase3);
  assert.equal(r.ok, true);
  assertTimeboxPlan(r.program, 4, 0);
});

test("Phase4: FAIL HARD if any planned exercise_id is missing from registry (no silent omission) — no disk mutation", () => {
  const { regPath, entries } = loadEntriesForTest();

  assert.ok(entries && typeof entries === "object", "entries must load");
  assert.ok(entries.bench_press, "registry must include bench_press for this test");

  // Remove bench_press from the injected entries map (no filesystem writes).
  const injected = { ...entries };
  delete injected.bench_press;

  const canonicalInput = { activity_id: "powerlifting" };
  const phase3 = mkPhase3();

  const r = phase4AssembleProgram(canonicalInput, phase3, { entries: injected });

  assert.equal(r.ok, false, "phase4AssembleProgram must fail when planned id missing");
  assert.equal(r.failure_token, "PHASE4_MISSING_PLANNED_EXERCISE");
  assert.ok(r.details, "details must exist");
  assert.equal(r.details.registry_path, "INJECTED_ENTRIES", "should report injected registry source");
  assert.ok(Array.isArray(r.details.missing_exercise_ids), "details.missing_exercise_ids must be an array");
  assert.ok(r.details.missing_exercise_ids.includes("bench_press"), "missing list must include bench_press");

  // Extra guard: regPath exists and we didn't touch it; this variable is here to prevent accidental removal.
  assert.ok(typeof regPath === "string" && regPath.length > 0, "regPath must be present");
});