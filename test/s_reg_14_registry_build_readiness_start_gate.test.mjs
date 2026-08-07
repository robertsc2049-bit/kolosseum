import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_14_BLOCKED_UNTIL_LATER,
  S_REG_14_BUILD_QUEUE,
  S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER,
  S_REG_14_COMPLETED_FOUNDATION,
  S_REG_14_CONTENT_PRODUCTION_STATUS,
  S_REG_14_FAILURE_TOKEN,
  S_REG_14_GATE_STATUS,
  S_REG_14_READY_TO_BUILD_NOW,
  S_REG_14_RUNTIME_STATUS,
  sReg14BuildDependencyClosureMap,
  sReg14LoadRegistryBuildReadinessManifest,
  sReg14ValidateBuildQueueOrder,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "../ci/registry/s_reg_14_registry_build_readiness_start_gate.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const registryIndex = readJson("registries/registry_index.json");
const registryBundle = readJson("registries/registry_bundle.json");

test("S-REG-14 keeps the active registry surface compact", () => {
  assert.deepEqual(registryIndex.order.slice(0, S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER.length), S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER);
  assert.deepEqual(Object.keys(registryBundle.registries).slice(0, S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER.length), S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER);
});

test("S-REG-14 validates the registry build-readiness manifest", () => {
  const result = sReg14ValidateRegistryBuildReadinessStartGate();

  assert.equal(result.ok, true);
  assert.equal(result.token, S_REG_14_FAILURE_TOKEN);
  assert.equal(result.gate_status, S_REG_14_GATE_STATUS);
  assert.equal(result.runtime_status, S_REG_14_RUNTIME_STATUS);
  assert.equal(result.activation_ready, false);
  assert.equal(result.content_production_status, S_REG_14_CONTENT_PRODUCTION_STATUS);
  assert.equal(result.ready_to_build_count, S_REG_14_READY_TO_BUILD_NOW.length);
  assert.equal(result.blocked_until_later_count, S_REG_14_BLOCKED_UNTIL_LATER.length);
  assert.equal(result.build_queue_length, S_REG_14_BUILD_QUEUE.length);
  assert.equal(result.first_content_slice, "S-REG-15");
  assert.equal(result.final_review_slice, "S-REG-22");
});

test("S-REG-14 records S-REG-04 through S-REG-13 as closed foundation", () => {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();

  assert.deepEqual(
    manifest.completed_foundation.map((entry) => entry.slice_id),
    S_REG_14_COMPLETED_FOUNDATION.map((entry) => entry.slice_id)
  );

  assert.deepEqual(manifest.completed_foundation.map((entry) => entry.slice_id), [
    "S-REG-04",
    "S-REG-05",
    "S-REG-06",
    "S-REG-07",
    "S-REG-08",
    "S-REG-09",
    "S-REG-10",
    "S-REG-11",
    "S-REG-12",
    "S-REG-13"
  ]);

  for (const entry of manifest.completed_foundation) {
    assert.equal(entry.status, "complete");
    assert.ok(String(entry.runtime_status).includes("non_runtime"));
  }
});

test("S-REG-14 build queue is dependency-safe and explicit", () => {
  const result = sReg14ValidateBuildQueueOrder();

  assert.equal(result.ok, true);
  assert.equal(result.queue_length, 8);

  for (const entry of S_REG_14_BUILD_QUEUE) {
    assert.match(entry.slice_id, /^S-REG-\d+$/);
    assert.match(entry.proof_command, /^npm\.cmd run proof:s-reg-\d+$/);
    assert.ok(entry.registry_target.length > 0);
    assert.ok(entry.dependency_inputs.length > 0);
    assert.ok(entry.non_scope_boundary.length > 0);
  }
});

test("S-REG-14 fails closed when build queue dependencies are out of order", () => {
  const invalidQueue = S_REG_14_BUILD_QUEUE.map((entry) => ({ ...entry }));
  invalidQueue[0] = {
    ...invalidQueue[0],
    dependency_inputs: ["S-REG-20"]
  };

  assert.throws(
    () => sReg14ValidateBuildQueueOrder(invalidQueue),
    (error) => {
      assert.equal(error.code, S_REG_14_FAILURE_TOKEN);
      assert.equal(error.reason, "build_queue_dependency_not_closed_before_use");
      return true;
    }
  );
});

test("S-REG-14 fails closed when manifest claims activation or content production", () => {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();

  for (const mutation of [
    { activation_ready: true },
    { content_production_status: "started" },
    { gate_status: "active_registry_activation_gate" }
  ]) {
    assert.throws(
      () => sReg14ValidateRegistryBuildReadinessStartGate({ ...manifest, ...mutation }),
      (error) => {
        assert.equal(error.code, S_REG_14_FAILURE_TOKEN);
        return true;
      }
    );
  }
});

test("S-REG-14 refuses forbidden content production and runtime fields", () => {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();

  for (const forbiddenField of [
    "records",
    "seed_records",
    "active_registry_activation",
    "engine_runtime_change",
    "marker_evaluator",
    "substitution_runtime_change",
    "recommendation",
    "ranking",
    "optimisation",
    "readiness_status",
    "safety_status",
    "suitability_status",
    "capability_score",
    "tactical_status",
    "return_to_play_status",
    "outcome_inference"
  ]) {
    assert.throws(
      () => sReg14ValidateRegistryBuildReadinessStartGate({
        ...manifest,
        [forbiddenField]: true
      }),
      (error) => {
        assert.equal(error.code, S_REG_14_FAILURE_TOKEN);
        assert.equal(error.reason, "forbidden_key_present");
        return true;
      }
    );
  }
});

test("S-REG-14 dependency closure map blocks activation and leaves content not started", () => {
  const map = sReg14BuildDependencyClosureMap();

  assert.deepEqual(map.closed_foundation, [
    "S-REG-04",
    "S-REG-05",
    "S-REG-06",
    "S-REG-07",
    "S-REG-08",
    "S-REG-09",
    "S-REG-10",
    "S-REG-11",
    "S-REG-12",
    "S-REG-13"
  ]);

  assert.deepEqual(map.open_content_batches, [
    "S-REG-15",
    "S-REG-16",
    "S-REG-17",
    "S-REG-18",
    "S-REG-19",
    "S-REG-20",
    "S-REG-21",
    "S-REG-22"
  ]);

  assert.equal(map.activation_gate_blocked_until, "S-REG-22");
  assert.equal(map.active_registry_activation_status, "not_authorised");
  assert.equal(map.content_production_status, "not_started");
});

test("S-REG-14 does not create candidate content records", () => {
  const manifest = sReg14LoadRegistryBuildReadinessManifest();

  assert.equal(Object.hasOwn(manifest, "records"), false);
  assert.equal(Object.hasOwn(manifest, "seed_records"), false);
  assert.equal(Object.hasOwn(manifest, "candidate_records_created"), false);
  assert.equal(manifest.content_production_status, "not_started");
});