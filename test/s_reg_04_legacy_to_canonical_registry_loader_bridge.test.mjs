import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_04_FAILURE_TOKEN,
  sReg04CanonicalAliasMap,
  sReg04ResolveCanonicalRegistry,
  sReg04ResolveCanonicalRegistryMap,
  sReg04SupportedCanonicalRegistryIds
} from "../ci/registry/s_reg_04_legacy_to_canonical_registry_bridge.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const registryIndex = readJson("registries/registry_index.json");
const registryBundle = readJson("registries/registry_bundle.json");

const expectedCompactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const expectedAliasMap = Object.freeze({
  activity_registry_1: {
    legacy_registry_id: "activity",
    alias_scope: "legacy_compact_activity_alias"
  },
  movement_registry_3: {
    legacy_registry_id: "movement",
    alias_scope: "legacy_compact_movement_alias"
  },
  exercise_registry_3a: {
    legacy_registry_id: "exercise",
    alias_scope: "legacy_compact_exercise_alias"
  },
  sport_program_profile_registry_5d: {
    legacy_registry_id: "program",
    alias_scope: "legacy_compact_program_profile_alias_no_template_structure"
  }
});

const expectedEntryCounts = Object.freeze({
  activity_registry_1: 3,
  movement_registry_3: 4,
  exercise_registry_3a: 19,
  sport_program_profile_registry_5d: 3
});

test("S-REG-04 keeps active registry order and bundle compact", () => {
  assert.deepEqual(registryIndex.order, expectedCompactOrder);
  assert.deepEqual(Object.keys(registryBundle.registries), expectedCompactOrder);
});

test("S-REG-04 exposes only the explicit canonical alias map", () => {
  assert.deepEqual(sReg04CanonicalAliasMap(), expectedAliasMap);
  assert.deepEqual(sReg04SupportedCanonicalRegistryIds(), Object.keys(expectedAliasMap));
});

test("S-REG-04 resolves approved canonical ids over compact source registries", () => {
  for (const [canonicalRegistryId, mapping] of Object.entries(expectedAliasMap)) {
    const resolved = sReg04ResolveCanonicalRegistry(registryBundle, canonicalRegistryId);

    assert.equal(resolved.bridge_slice_id, "S-REG-04");
    assert.equal(resolved.bridge_status, "legacy_canonical_alias");
    assert.equal(resolved.canonical_registry_id, canonicalRegistryId);
    assert.equal(resolved.legacy_registry_id, mapping.legacy_registry_id);
    assert.equal(resolved.source_registry_id, mapping.legacy_registry_id);
    assert.equal(resolved.alias_scope, mapping.alias_scope);
    assert.equal(resolved.source_collection_key, "entries");
    assert.equal(resolved.source_entry_count, expectedEntryCounts[canonicalRegistryId]);
    assert.equal(resolved.registry_completion_claim, false);
    assert.equal(resolved.content_migration_claim, false);
    assert.equal(resolved.template_structure_claim, false);
    assert.deepEqual(resolved.registry_document, registryBundle.registries[mapping.legacy_registry_id]);
    assert.notEqual(resolved.registry_document, registryBundle.registries[mapping.legacy_registry_id]);
    assert.equal(Object.isFrozen(resolved), true);
    assert.equal(Object.isFrozen(resolved.registry_document), true);
  }
});

test("S-REG-04 resolves a deterministic canonical registry map", () => {
  const first = sReg04ResolveCanonicalRegistryMap(registryBundle);
  const second = sReg04ResolveCanonicalRegistryMap(registryBundle);

  assert.deepEqual(Object.keys(first), Object.keys(expectedAliasMap));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Object.isFrozen(first), true);
});

test("S-REG-04 refuses unsupported canonical ids with a closed failure token", () => {
  assert.throws(
    () => sReg04ResolveCanonicalRegistry(registryBundle, "equipment_registry"),
    (error) => {
      assert.equal(error.code, S_REG_04_FAILURE_TOKEN);
      assert.equal(error.reason, "unsupported_canonical_registry_id");
      assert.deepEqual(error.details.supported_canonical_registry_ids, Object.keys(expectedAliasMap));
      return true;
    }
  );
});

test("S-REG-04 does not mutate the compact registry bundle", () => {
  const before = JSON.stringify(registryBundle);
  const resolved = sReg04ResolveCanonicalRegistry(registryBundle, "activity_registry_1");

  assert.throws(
    () => {
      resolved.registry_document.entries.powerlifting.activity_id = "mutated";
    },
    TypeError
  );

  const after = JSON.stringify(registryBundle);
  assert.equal(after, before);
});

test("S-REG-04 program alias does not invent template structure", () => {
  const resolved = sReg04ResolveCanonicalRegistry(registryBundle, "sport_program_profile_registry_5d");

  assert.equal(resolved.legacy_registry_id, "program");
  assert.equal(resolved.alias_scope, "legacy_compact_program_profile_alias_no_template_structure");
  assert.equal(resolved.template_structure_claim, false);
  assert.equal(resolved.registry_completion_claim, false);
});