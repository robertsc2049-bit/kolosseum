import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_07_CANDIDATE_PATHS,
  S_REG_07_FAILURE_TOKEN,
  S_REG_07_REGISTRY_ID,
  S_REG_07_REQUIRED_SEED_EQUIPMENT_IDS,
  sReg07CandidatePaths,
  sReg07LoadEquipmentCandidateSeedFile,
  sReg07ValidateEquipmentCandidateSeedSurface
} from "../ci/registry/s_reg_07_equipment_candidate_seed_records.mjs";

import {
  sReg06LoadCandidateSeedFiles
} from "../ci/registry/s_reg_06_candidate_seed_records.mjs";

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

test("S-REG-07 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order, expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries), expectedCompactIds);
  assert.equal(fs.existsSync("registries/equipment_registry"), false);
});

test("S-REG-07 equipment candidate path matches the S-REG-05 candidate surface convention", () => {
  assert.deepEqual(sReg07CandidatePaths(), S_REG_07_CANDIDATE_PATHS);
  assert.equal(
    S_REG_07_CANDIDATE_PATHS.equipment_registry,
    "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json"
  );
  assert.equal(fs.existsSync(S_REG_07_CANDIDATE_PATHS.equipment_registry), true);
});

test("S-REG-07 equipment candidates are inert and FK-closed to S-REG-06 activity and movement candidates", () => {
  const equipmentDocument = sReg07LoadEquipmentCandidateSeedFile();
  const result = sReg07ValidateEquipmentCandidateSeedSurface({ equipmentDocument });

  assert.equal(result.ok, true);
  assert.equal(result.registry_id, S_REG_07_REGISTRY_ID);
  assert.equal(result.equipment_count, 6);
  assert.equal(result.required_seed_equipment_count, S_REG_07_REQUIRED_SEED_EQUIPMENT_IDS.length);
  assert.equal(result.upstream_activity_count, 3);
  assert.equal(result.upstream_movement_count, 4);
  assert.equal(result.s_reg_06_exercise_dependency_status, "candidate_equipment_fk_closed");
  assert.equal(result.s_reg_08_dependency, "exercise_equipment_fk_closure");
  assert.equal(result.runtime_status, "non_runtime");
});

test("S-REG-07 reads S-REG-08 exercise candidate equipment FK closure without activation", () => {
  const upstream = sReg06LoadCandidateSeedFiles();

  for (const exercise of upstream.exercise_registry_3a.records) {
    assert.equal(Array.isArray(exercise.equipment_ids), true);
    assert.notEqual(exercise.equipment_ids.length, 0);
    assert.equal(exercise.equipment_dependency_status, "candidate_equipment_fk_closed");
    assert.equal(exercise.activation_ready, false);
  }
});

test("S-REG-07 fails closed when equipment references an unknown activity", () => {
  const equipmentDocument = JSON.parse(JSON.stringify(sReg07LoadEquipmentCandidateSeedFile()));
  equipmentDocument.records[0].activity_applicability = ["missing_activity"];

  assert.throws(
    () => sReg07ValidateEquipmentCandidateSeedSurface({ equipmentDocument }),
    (error) => {
      assert.equal(error.code, S_REG_07_FAILURE_TOKEN);
      assert.equal(error.reason, "fk_reference_unknown");
      return true;
    }
  );
});

test("S-REG-07 fails closed when equipment references an unknown movement", () => {
  const equipmentDocument = JSON.parse(JSON.stringify(sReg07LoadEquipmentCandidateSeedFile()));
  equipmentDocument.records[0].movement_pattern_applicability = ["missing_movement"];

  assert.throws(
    () => sReg07ValidateEquipmentCandidateSeedSurface({ equipmentDocument }),
    (error) => {
      assert.equal(error.code, S_REG_07_FAILURE_TOKEN);
      assert.equal(error.reason, "fk_reference_unknown");
      return true;
    }
  );
});