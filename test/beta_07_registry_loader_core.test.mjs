import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  BETA_07_CANONICAL_REGISTRY_ORDER,
  BETA_07_FAILURE_TOKENS,
  beta07LoadAtomicRegistryStore
} from "../ci/registry/s_reg_04_legacy_to_canonical_registry_bridge.mjs";

const fixtureDir = path.join(process.cwd(), "ci", "fixtures", "beta_07_registry_loader_core");

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
}

function assertFailureToken(name, expectedToken) {
  const fixture = readFixture(name);

  assert.equal(fixture.slice_id, "BETA-07");
  assert.equal(fixture.expected_failure_token, expectedToken);

  assert.throws(
    () => beta07LoadAtomicRegistryStore({
      registry_index: fixture.registry_index,
      registry_bundle: fixture.registry_bundle
    }),
    (error) =>
      error?.code === expectedToken &&
      error?.failure_token === expectedToken &&
      typeof error?.reason === "string" &&
      error.reason.length > 0
  );
}

test("BETA-07 loads the minimal beta registry fixture atomically in canonical order", () => {
  const fixture = readFixture("positive_beta_registry_load.json");

  const store = beta07LoadAtomicRegistryStore({
    registry_index: fixture.registry_index,
    registry_bundle: fixture.registry_bundle
  });

  assert.equal(store.ok, true);
  assert.equal(store.loader_slice_id, "BETA-07");
  assert.deepEqual(store.registry_order, [...BETA_07_CANONICAL_REGISTRY_ORDER]);
  assert.deepEqual(store.loaded_registry_ids, [...BETA_07_CANONICAL_REGISTRY_ORDER]);
  assert.equal(store.atomic_load, true);
  assert.equal(store.partial_consumption_allowed, false);
  assert.equal(store.fallback_allowed, false);
  assert.equal(store.discovery_allowed, false);
  assert.equal(store.runtime_mutation_allowed, false);
  assert.deepEqual(Object.keys(store.registries), [...BETA_07_CANONICAL_REGISTRY_ORDER]);
});

test("BETA-07 returns a read-only runtime registry store", () => {
  const fixture = readFixture("positive_beta_registry_load.json");
  const store = beta07LoadAtomicRegistryStore({
    registry_index: fixture.registry_index,
    registry_bundle: fixture.registry_bundle
  });

  assert.equal(Object.isFrozen(store), true);
  assert.equal(Object.isFrozen(store.registries), true);
  assert.equal(Object.isFrozen(store.registries.activity), true);
  assert.equal(Object.isFrozen(store.registries.activity.entries), true);
  assert.equal(Object.isFrozen(store.registries.activity.entries.powerlifting), true);

  assert.throws(
    () => {
      store.registries.activity.entries.powerlifting.activity_id = "mutated";
    },
    TypeError
  );

  assert.equal(store.registries.activity.entries.powerlifting.activity_id, "powerlifting");
});

test("BETA-07 loader clones source registries before exposing the runtime store", () => {
  const fixture = readFixture("positive_beta_registry_load.json");
  const store = beta07LoadAtomicRegistryStore({
    registry_index: fixture.registry_index,
    registry_bundle: fixture.registry_bundle
  });

  fixture.registry_bundle.registries.activity.entries.powerlifting.activity_id = "mutated_after_load";

  assert.equal(store.registries.activity.entries.powerlifting.activity_id, "powerlifting");
});

test("BETA-07 missing registry fixture fails before any partial store exists", () => {
  assertFailureToken("negative_missing_registry.json", BETA_07_FAILURE_TOKENS.MISSING_REGISTRY);
});

test("BETA-07 wrong order fixture fails with stable order token", () => {
  assertFailureToken("negative_wrong_order.json", BETA_07_FAILURE_TOKENS.REGISTRY_ORDER_INVALID);
});

test("BETA-07 duplicate registry id fixture fails with stable duplicate token", () => {
  assertFailureToken("negative_duplicate_registry_id.json", BETA_07_FAILURE_TOKENS.DUPLICATE_REGISTRY_ID);
});

test("BETA-07 unknown upstream registry reference fixture fails with stable reference token", () => {
  assertFailureToken("negative_unknown_registry_reference.json", BETA_07_FAILURE_TOKENS.UNKNOWN_REGISTRY_REFERENCE);
});

test("BETA-07 downstream forward reference fixture fails with stable forward reference token", () => {
  assertFailureToken("negative_forward_reference.json", BETA_07_FAILURE_TOKENS.FORWARD_REGISTRY_REFERENCE);
});

test("BETA-07 validates the current active registry bundle through the atomic loader", () => {
  const registry_index = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "registry_index.json"), "utf8"));
  const registry_bundle = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "registry_bundle.json"), "utf8"));

  const store = beta07LoadAtomicRegistryStore({
    registry_index,
    registry_bundle
  });

  assert.equal(store.ok, true);
  assert.deepEqual(store.registry_order, registry_index.order);
  assert.deepEqual(Object.keys(store.registries), registry_index.order);
});

test("BETA-07 does not create a duplicate loader surface", () => {
  const modulePath = path.join(process.cwd(), "ci", "registry", "s_reg_04_legacy_to_canonical_registry_bridge.mjs");
  const source = fs.readFileSync(modulePath, "utf8");

  assert.match(source, /function beta07LoadAtomicRegistryStore/);
  assert.match(source, /DEV NOTE: BETA-07 registry loader core/);
  assert.doesNotMatch(source, /readFileSync\(.*registry_bundle/u);
  assert.doesNotMatch(source, /writeFileSync/u);
});
