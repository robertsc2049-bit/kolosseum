import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_06_CANDIDATE_PATHS,
  S_REG_06_FAILURE_TOKEN,
  S_REG_06_TARGET_REGISTRY_IDS,
  sReg06CandidatePaths,
  sReg06LoadCandidateSeedFiles,
  sReg06ValidateCandidateSeedSurface
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

test("S-REG-06 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order.slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, expectedCompactIds.length), expectedCompactIds);

  for (const registryId of S_REG_06_TARGET_REGISTRY_IDS) {
    assert.equal(fs.existsSync(`registries/${registryId}`), false);
  }
});

test("S-REG-06 candidate paths match the S-REG-05 candidate surface convention", () => {
  assert.deepEqual(sReg06CandidatePaths(), S_REG_06_CANDIDATE_PATHS);

  for (const [registryId, candidatePath] of Object.entries(S_REG_06_CANDIDATE_PATHS)) {
    assert.equal(candidatePath, `ci/registry/candidates/${registryId}/${registryId}.candidate.registry.json`);
    assert.equal(fs.existsSync(candidatePath), true);
  }
});

test("S-REG-06 candidate seeds are inert and FK-closed across activity, movement, token, and exercise", () => {
  const surface = sReg06LoadCandidateSeedFiles();
  const result = sReg06ValidateCandidateSeedSurface(surface);

  assert.equal(result.ok, true);
  assert.equal(result.target_registry_count, 4);
  assert.equal(result.activity_count, 3);
  assert.equal(result.movement_count, 4);
  assert.equal(result.exercise_token_count, 4);
  assert.equal(result.exercise_count, 4);
  assert.equal(result.equipment_dependency_status, "candidate_equipment_fk_closed");
  assert.equal(result.runtime_status, "non_runtime");
});

test("S-REG-06 exercise records can hold S-REG-08 candidate equipment FK closure without activation", () => {
  const surface = sReg06LoadCandidateSeedFiles();

  for (const record of surface.exercise_registry_3a.records) {
    assert.equal(Array.isArray(record.equipment_ids), true);
    assert.notEqual(record.equipment_ids.length, 0);
    assert.equal(record.equipment_dependency_status, "candidate_equipment_fk_closed");
    assert.equal(record.activation_ready, false);
    assert.equal(record.runtime_status, "non_runtime");
  }
});

test("S-REG-06 fails closed when a candidate FK points at an unknown movement", () => {
  const surface = JSON.parse(JSON.stringify(sReg06LoadCandidateSeedFiles()));
  surface.exercise_registry_3a.records[0].movement_id = "missing_movement";

  assert.throws(
    () => sReg06ValidateCandidateSeedSurface(surface),
    (error) => {
      assert.equal(error.code, S_REG_06_FAILURE_TOKEN);
      assert.equal(error.reason, "fk_reference_unknown");
      return true;
    }
  );
});