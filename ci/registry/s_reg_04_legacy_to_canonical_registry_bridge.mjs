const S_REG_04_SLICE_ID = "S-REG-04";
const S_REG_04_BRIDGE_VERSION = "1.0.0";
const S_REG_04_FAILURE_TOKEN = "CI_S_REG_04_LEGACY_CANONICAL_REGISTRY_BRIDGE";

const S_REG_04_CANONICAL_ALIAS_MAP = Object.freeze({
  activity_registry_1: Object.freeze({
    legacy_registry_id: "activity",
    alias_scope: "legacy_compact_activity_alias"
  }),
  movement_registry_3: Object.freeze({
    legacy_registry_id: "movement",
    alias_scope: "legacy_compact_movement_alias"
  }),
  exercise_registry_3a: Object.freeze({
    legacy_registry_id: "exercise",
    alias_scope: "legacy_compact_exercise_alias"
  }),
  sport_program_profile_registry_5d: Object.freeze({
    legacy_registry_id: "program",
    alias_scope: "legacy_compact_program_profile_alias_no_template_structure"
  })
});

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "SReg04LegacyCanonicalRegistryBridgeError";
  error.code = S_REG_04_FAILURE_TOKEN;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  throw error;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!isPlainRecord(value) && !Array.isArray(value)) {
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}

function registriesFrom(input) {
  if (isPlainRecord(input) && isPlainRecord(input.registries)) {
    return input.registries;
  }

  if (isPlainRecord(input)) {
    return input;
  }

  fail(
    "registry_store_invalid",
    "S-REG-04 registry bridge requires a registry bundle or registries object.",
    { received_type: typeof input }
  );
}

function collectionInfo(registryDocument) {
  if (!isPlainRecord(registryDocument)) {
    return Object.freeze({
      source_collection_key: null,
      source_entry_count: 0
    });
  }

  if (Array.isArray(registryDocument.entries)) {
    return Object.freeze({
      source_collection_key: "entries",
      source_entry_count: registryDocument.entries.length
    });
  }

  if (isPlainRecord(registryDocument.entries)) {
    return Object.freeze({
      source_collection_key: "entries",
      source_entry_count: Object.keys(registryDocument.entries).length
    });
  }

  const candidateKeys = Object.keys(registryDocument).filter((key) => key !== "registry_id" && key !== "version");

  if (candidateKeys.length === 1) {
    const key = candidateKeys[0];
    const value = registryDocument[key];

    if (Array.isArray(value)) {
      return Object.freeze({
        source_collection_key: key,
        source_entry_count: value.length
      });
    }

    if (isPlainRecord(value)) {
      return Object.freeze({
        source_collection_key: key,
        source_entry_count: Object.keys(value).length
      });
    }
  }

  return Object.freeze({
    source_collection_key: null,
    source_entry_count: 0
  });
}

/**
 * DEV NOTE: S-REG-04 bridge boundary.
 * Purpose: expose explicit canonical registry aliases over the current compact
 * registry bundle while the active registry source remains compact.
 * Boundary: this module does not read files, alter registry_index, write bundles,
 * add registry rows, create templates, or change engine runtime behaviour.
 * Determinism: alias mapping is a frozen closed set and returned registry
 * documents are cloned then deep-frozen.
 * Failure: unknown canonical IDs and missing legacy sources fail closed with
 * CI_S_REG_04_LEGACY_CANONICAL_REGISTRY_BRIDGE.
 */
function sReg04ResolveCanonicalRegistry(input, canonicalRegistryId) {
  if (typeof canonicalRegistryId !== "string" || canonicalRegistryId.length === 0) {
    fail(
      "canonical_registry_id_invalid",
      "S-REG-04 canonical registry id must be a non-empty string.",
      { canonical_registry_id: canonicalRegistryId }
    );
  }

  const mapping = S_REG_04_CANONICAL_ALIAS_MAP[canonicalRegistryId];

  if (!mapping) {
    fail(
      "unsupported_canonical_registry_id",
      "S-REG-04 bridge does not support this canonical registry id.",
      {
        canonical_registry_id: canonicalRegistryId,
        supported_canonical_registry_ids: Object.keys(S_REG_04_CANONICAL_ALIAS_MAP)
      }
    );
  }

  const registries = registriesFrom(input);
  const sourceDocument = registries[mapping.legacy_registry_id];

  if (!sourceDocument) {
    fail(
      "legacy_source_registry_missing",
      "S-REG-04 bridge source registry is missing from the compact bundle.",
      {
        canonical_registry_id: canonicalRegistryId,
        legacy_registry_id: mapping.legacy_registry_id
      }
    );
  }

  const sourceInfo = collectionInfo(sourceDocument);
  const clonedDocument = deepFreeze(cloneJson(sourceDocument));

  return deepFreeze({
    bridge_slice_id: S_REG_04_SLICE_ID,
    bridge_version: S_REG_04_BRIDGE_VERSION,
    bridge_status: "legacy_canonical_alias",
    canonical_registry_id: canonicalRegistryId,
    legacy_registry_id: mapping.legacy_registry_id,
    source_registry_id: mapping.legacy_registry_id,
    alias_scope: mapping.alias_scope,
    source_collection_key: sourceInfo.source_collection_key,
    source_entry_count: sourceInfo.source_entry_count,
    registry_completion_claim: false,
    content_migration_claim: false,
    template_structure_claim: false,
    registry_document: clonedDocument
  });
}

function sReg04ResolveCanonicalRegistryMap(input, canonicalRegistryIds = Object.keys(S_REG_04_CANONICAL_ALIAS_MAP)) {
  if (!Array.isArray(canonicalRegistryIds) || canonicalRegistryIds.length === 0) {
    fail(
      "canonical_registry_id_list_invalid",
      "S-REG-04 canonical registry id list must be a non-empty array.",
      { canonical_registry_ids: canonicalRegistryIds }
    );
  }

  const out = {};

  for (const canonicalRegistryId of canonicalRegistryIds) {
    out[canonicalRegistryId] = sReg04ResolveCanonicalRegistry(input, canonicalRegistryId);
  }

  return deepFreeze(out);
}

function sReg04CanonicalAliasMap() {
  return deepFreeze(cloneJson(S_REG_04_CANONICAL_ALIAS_MAP));
}

function sReg04SupportedCanonicalRegistryIds() {
  return Object.freeze(Object.keys(S_REG_04_CANONICAL_ALIAS_MAP));
}

export {
  S_REG_04_BRIDGE_VERSION,
  S_REG_04_CANONICAL_ALIAS_MAP,
  S_REG_04_FAILURE_TOKEN,
  S_REG_04_SLICE_ID,
  sReg04CanonicalAliasMap,
  sReg04ResolveCanonicalRegistry,
  sReg04ResolveCanonicalRegistryMap,
  sReg04SupportedCanonicalRegistryIds
};