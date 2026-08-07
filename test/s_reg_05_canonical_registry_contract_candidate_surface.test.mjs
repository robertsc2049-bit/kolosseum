import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_05_ACTIVE_COMPACT_REGISTRY_IDS,
  S_REG_05_ALLOWED_CANDIDATE_STATUSES,
  S_REG_05_CANONICAL_REGISTRY_IDS,
  S_REG_05_DEPENDENCY_ORDER,
  S_REG_05_FAILURE_TOKEN,
  sReg05CandidateSurfaceManifest,
  sReg05CanonicalRegistryContract,
  sReg05CanonicalRegistryIds,
  sReg05DependencyOrder,
  sReg05ValidateCandidateContract
} from "../ci/registry/s_reg_05_canonical_registry_contract.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const registryIndex = readJson("registries/registry_index.json");
const registryBundle = readJson("registries/registry_bundle.json");
const contractManifest = readJson("ci/registry/s_reg_05_canonical_registry_contract_manifest.json");
const dependencyManifest = readJson("ci/registry/s_reg_05_canonical_registry_dependency_manifest.json");

const expectedCompactIds = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const expectedCanonicalIds = Object.freeze([
  "activity_registry_1",
  "sport_subdivision_registry_1a",
  "sport_metric_registry_1c",
  "metric_exercise_link_registry_1c_a",
  "sport_role_registry_2",
  "movement_registry_3",
  "exercise_token_registry_3b",
  "exercise_registry_3a",
  "equipment_registry",
  "exercise_activity_applicability_registry",
  "sport_program_profile_registry_5d",
  "sport_event_model_registry_5e",
  "sport_program_template_registry_5f",
  "substitution_registry"
]);

const expectedDependencyOrder = Object.freeze([
  "activity_registry_1",
  "sport_subdivision_registry_1a",
  "sport_metric_registry_1c",
  "sport_role_registry_2",
  "movement_registry_3",
  "equipment_registry",
  "exercise_token_registry_3b",
  "exercise_registry_3a",
  "metric_exercise_link_registry_1c_a",
  "exercise_activity_applicability_registry",
  "sport_program_profile_registry_5d",
  "sport_event_model_registry_5e",
  "sport_program_template_registry_5f",
  "substitution_registry"
]);

test("S-REG-05 keeps active registry law compact", () => {
  assert.deepEqual(S_REG_05_ACTIVE_COMPACT_REGISTRY_IDS, expectedCompactIds);
  assert.deepEqual(registryIndex.order.slice(0, expectedCompactIds.length), expectedCompactIds);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, expectedCompactIds.length), expectedCompactIds);
});

test("S-REG-05 declares the full canonical registry id set without activating it", () => {
  assert.deepEqual(S_REG_05_CANONICAL_REGISTRY_IDS, expectedCanonicalIds);
  assert.deepEqual(sReg05CanonicalRegistryIds(), expectedCanonicalIds);
  assert.deepEqual(contractManifest.canonical_registry_ids, expectedCanonicalIds);

  for (const registryId of expectedCanonicalIds) {
    assert.equal(fs.existsSync(`registries/${registryId}`), false);
  }
});

test("S-REG-05 declares a deterministic dependency order", () => {
  assert.deepEqual(S_REG_05_DEPENDENCY_ORDER, expectedDependencyOrder);
  assert.deepEqual(sReg05DependencyOrder(), expectedDependencyOrder);
  assert.deepEqual(dependencyManifest.dependency_order, expectedDependencyOrder);
  assert.equal(new Set(expectedDependencyOrder).size, expectedCanonicalIds.length);

  for (const registryId of expectedCanonicalIds) {
    assert.ok(expectedDependencyOrder.includes(registryId));
  }
});

test("S-REG-05 contract records are candidate-only and non-runtime", () => {
  const contract = sReg05CanonicalRegistryContract();
  const result = sReg05ValidateCandidateContract(contract);

  assert.equal(result.ok, true);
  assert.equal(result.canonical_registry_count, 14);
  assert.equal(result.candidate_status, "candidate_contract_only");

  for (const [registryId, record] of Object.entries(contract)) {
    assert.equal(record.registry_id, registryId);
    assert.equal(record.candidate_status, "candidate_contract_only");
    assert.ok(record.candidate_surface.startsWith("ci/registry/candidates/"));
    assert.equal(record.future_active_path, `registries/${registryId}/${registryId}.registry.json`);
    assert.equal(typeof record.activation_gate, "string");
    assert.notEqual(record.activation_gate.length, 0);

    for (const dependency of record.depends_on) {
      assert.ok(expectedCanonicalIds.includes(dependency));
    }
  }
});

test("S-REG-05 candidate manifest is inert and rejects active mutation claims", () => {
  const manifest = sReg05CandidateSurfaceManifest();

  assert.equal(manifest.surface_status, "candidate_contract_only");
  assert.equal(manifest.runtime_status, "non_runtime");
  assert.equal(manifest.active_registry_mutation, false);
  assert.equal(manifest.active_bundle_mutation, false);
  assert.equal(manifest.registry_law_mutation, false);
  assert.equal(manifest.engine_runtime_mutation, false);
  assert.equal(manifest.high_volume_content_added, false);
  assert.equal(manifest.candidate_surface_root, "ci/registry/candidates");
  assert.equal(manifest.future_active_surface_root, "registries");
  assert.deepEqual(manifest.canonical_registry_ids, expectedCanonicalIds);
  assert.deepEqual(manifest.allowed_candidate_statuses, S_REG_05_ALLOWED_CANDIDATE_STATUSES);
});

test("S-REG-05 fails closed for invalid canonical contract shape", () => {
  const badContract = JSON.parse(JSON.stringify(sReg05CanonicalRegistryContract()));
  delete badContract.activity_registry_1;

  assert.throws(
    () => sReg05ValidateCandidateContract(badContract),
    (error) => {
      assert.equal(error.code, S_REG_05_FAILURE_TOKEN);
      assert.equal(error.reason, "canonical_registry_order_invalid");
      return true;
    }
  );
});