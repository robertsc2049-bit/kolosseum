import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPECTED_EXERCISE_COUNT,
  auditRegFull04,
  auditRegFull04Documents,
  loadRegFull04Documents,
  resolveExerciseRelations
} from "../ci/registry/reg_full_04_equipment_compatibility_applicability_closure.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function codes(result) { return new Set(result.errors.map(error => error.code)); }

function live() { return loadRegFull04Documents(process.cwd()); }

test("REG-FULL-04 closes every exercise against explicit movement, equipment and activity relations", () => {
  const result = auditRegFull04(process.cwd());
  assert.equal(result.ok, true, JSON.stringify(result.errors.slice(0, 20)));
  assert.equal(result.counts.exercise_count, EXPECTED_EXERCISE_COUNT);
  assert.equal(result.counts.resolved_exercise_count, EXPECTED_EXERCISE_COUNT);
  assert.ok(result.counts.compatibility_edge_count >= EXPECTED_EXERCISE_COUNT);
  assert.ok(result.counts.required_equipment_edge_count >= EXPECTED_EXERCISE_COUNT);
  assert.ok(result.counts.activity_relation_pair_count > EXPECTED_EXERCISE_COUNT);
});

test("REG-FULL-04 resolves a concrete exercise only from explicit relations", () => {
  const docs = live();
  const result = resolveExerciseRelations(docs, "back_squat");
  assert.equal(result.exercise_id, "back_squat");
  assert.equal(result.movement_pattern_id, "squat");
  assert.ok(result.required_equipment_ids.includes("barbell"));
  assert.ok(result.activity_ids.includes("powerlifting"));
  assert.equal(Object.isFrozen(result), true);
});

test("REG-FULL-04 does not infer equipment from movement vocabulary when an explicit required edge is missing", () => {
  const docs = clone(live());
  for (const [key, row] of Object.entries(docs.compatibility.entries)) {
    if (row.exercise_id === "back_squat" && row.compatibility_type === "required") delete docs.compatibility.entries[key];
  }
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("EXPLICIT_REQUIRED_EQUIPMENT_MISSING"), true);
  assert.throws(
    () => resolveExerciseRelations(docs, "back_squat"),
    error => error?.code === "REG_FULL_04_REQUIRED_EQUIPMENT_RELATION_MISSING"
  );
});

test("REG-FULL-04 rejects an equipment relation whose FK is absent", () => {
  const docs = clone(live());
  const source = Object.entries(docs.compatibility.entries).find(([, candidate]) => candidate.compatibility_type === "required");
  assert.ok(source, "expected at least one required equipment relation");
  const [sourceKey, row] = source;
  delete docs.compatibility.entries[sourceKey];
  const absentEquipmentId = "not_in_equipment_registry";
  const replacementKey = `${row.exercise_id}__${absentEquipmentId}`;
  docs.compatibility.entries[replacementKey] = {
    ...row,
    compatibility_id: replacementKey,
    equipment_id: absentEquipmentId
  };
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("COMPATIBILITY_EQUIPMENT_FK"), true);
});

test("REG-FULL-04 rejects generic fallback relation markers", () => {
  const docs = clone(live());
  const source = Object.entries(docs.compatibility.entries).find(([, candidate]) => candidate.compatibility_type === "required");
  assert.ok(source, "expected at least one required equipment relation");
  const [sourceKey, row] = source;
  delete docs.compatibility.entries[sourceKey];
  const fallbackEquipmentId = "default_equipment";
  const replacementKey = `${row.exercise_id}__${fallbackEquipmentId}`;
  docs.compatibility.entries[replacementKey] = {
    ...row,
    compatibility_id: replacementKey,
    equipment_id: fallbackEquipmentId
  };
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("GENERIC_FALLBACK_FORBIDDEN"), true);
});

test("REG-FULL-04 rejects movement-incompatible equipment even when the equipment id exists", () => {
  const docs = clone(live());
  const source = Object.entries(docs.compatibility.entries).find(([, candidate]) => {
    const exercise = docs.exercise.entries[candidate.exercise_id];
    const movement = docs.movement.entries[exercise?.movement_pattern_id];
    return movement && Object.keys(docs.equipment.entries).some(equipmentId => !movement.equipment_vocab.includes(equipmentId));
  });
  assert.ok(source, "expected at least one compatibility row with an incompatible existing equipment candidate");

  const [sourceKey, row] = source;
  const exercise = docs.exercise.entries[row.exercise_id];
  const movement = docs.movement.entries[exercise.movement_pattern_id];
  const incompatibleEquipmentId = Object.keys(docs.equipment.entries).find(equipmentId => !movement.equipment_vocab.includes(equipmentId));
  assert.ok(incompatibleEquipmentId, "expected an existing equipment id outside the movement vocabulary");

  delete docs.compatibility.entries[sourceKey];
  const replacementKey = `${row.exercise_id}__${incompatibleEquipmentId}`;
  docs.compatibility.entries[replacementKey] = {
    ...row,
    compatibility_id: replacementKey,
    equipment_id: incompatibleEquipmentId
  };

  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("MOVEMENT_EQUIPMENT_COMPATIBILITY"), true);
});

test("REG-FULL-04 rejects incomplete explicit exercise-to-activity context closure", () => {
  const docs = clone(live());
  delete docs.applicability.entries["back_squat__powerlifting__training"];
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("ACTIVITY_CONTEXT_CLOSURE"), true);
});

test("REG-FULL-04 rejects activity relations that are not compatible with the exercise movement", () => {
  const docs = clone(live());
  docs.movement.entries.squat.activity_applicability = docs.movement.entries.squat.activity_applicability.filter(id => id !== "powerlifting");
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("MOVEMENT_ACTIVITY_COMPATIBILITY"), true);
});

test("REG-FULL-04 treats embedded equipment arrays as compatibility projections, not independent truth", () => {
  const docs = clone(live());
  docs.exercise.entries.back_squat.equipment_requirements = ["bodyweight"];
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("EMBEDDED_REQUIRED_EQUIPMENT_PROJECTION_DRIFT"), true);
});

test("REG-FULL-04 treats embedded activity fields as compatibility projections, not independent truth", () => {
  const docs = clone(live());
  docs.exercise.entries.back_squat.secondary_activity_applicability = [];
  const result = auditRegFull04Documents(docs);
  assert.equal(result.ok, false);
  assert.equal(codes(result).has("EMBEDDED_ACTIVITY_PROJECTION_DRIFT"), true);
});

test("REG-FULL-04 resolver fails closed for an unregistered exercise instead of returning a generic fallback", () => {
  const docs = live();
  assert.throws(
    () => resolveExerciseRelations(docs, "not_a_real_exercise"),
    error => error?.code === "REG_FULL_04_UNKNOWN_EXERCISE"
  );
});
