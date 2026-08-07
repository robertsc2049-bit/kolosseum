import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_08_EQUIPMENT_DEPENDENCY_STATUS,
  S_REG_08_EXPECTED_EXERCISE_EQUIPMENT_IDS,
  S_REG_08_FAILURE_TOKEN,
  sReg08CandidatePaths,
  sReg08LoadCandidateSurfaces,
  sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate
} from "../ci/registry/s_reg_08_exercise_equipment_fk_closure_candidate_update.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const registryIndex = readJson("registries/registry_index.json");
const registryBundle = readJson("registries/registry_bundle.json");

const expectedCompactIds = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

test("S-REG-08 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order.slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, expectedCompactIds.length), expectedCompactIds);

  for (const registryId of [
    "exercise_registry_3a",
    "equipment_registry"
  ]) {
    assert.equal(fs.existsSync(`registries/${registryId}`), false);
  }
});

test("S-REG-08 candidate paths remain under the S-REG-05 candidate surface", () => {
  assert.deepEqual(sReg08CandidatePaths(), {
    exercise_registry_3a: "ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json"
  });
});

test("S-REG-08 validates exercise-equipment candidate FK closure", () => {
  const result = sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate();

  assert.equal(result.ok, true);
  assert.equal(result.exercise_count, 4);
  assert.equal(result.equipment_count, 6);
  assert.equal(result.equipment_dependency_status, S_REG_08_EQUIPMENT_DEPENDENCY_STATUS);
  assert.equal(result.activation_ready, false);
  assert.equal(result.runtime_status, "non_runtime");
});

test("S-REG-08 exercise candidate equipment IDs match the declared closure map", () => {
  const { exerciseDocument } = sReg08LoadCandidateSurfaces();

  for (const record of exerciseDocument.records) {
    assert.deepEqual(record.equipment_ids, S_REG_08_EXPECTED_EXERCISE_EQUIPMENT_IDS[record.exercise_id]);
    assert.equal(record.equipment_dependency_status, "candidate_equipment_fk_closed");
    assert.equal(record.equipment_fk_closed_by_slice_id, "S-REG-08");
    assert.equal(record.activation_ready, false);
  }
});

test("S-REG-08 fails closed when an exercise references unknown equipment", () => {
  const surfaces = JSON.parse(JSON.stringify(sReg08LoadCandidateSurfaces()));
  surfaces.exerciseDocument.records[0].equipment_ids = ["missing_equipment"];

  assert.throws(
    () => sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate(surfaces),
    (error) => {
      assert.equal(error.code, S_REG_08_FAILURE_TOKEN);
      assert.equal(error.reason, "exercise_equipment_ids_mismatch");
      return true;
    }
  );
});

test("S-REG-08 fails closed when equipment movement applicability does not cover the exercise movement", () => {
  const surfaces = JSON.parse(JSON.stringify(sReg08LoadCandidateSurfaces()));
  const barbell = surfaces.equipmentDocument.records.find((record) => record.equipment_id === "barbell");
  barbell.movement_pattern_applicability = ["brace"];

  assert.throws(
    () => sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate(surfaces),
    (error) => {
      assert.equal(error.code, S_REG_08_FAILURE_TOKEN);
      assert.equal(error.reason, "equipment_movement_fk_incompatible");
      return true;
    }
  );
});