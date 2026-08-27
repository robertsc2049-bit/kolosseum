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

const BETA_07_SLICE_ID = "BETA-07";
const BETA_07_LOADER_VERSION = "1.0.0";
const BETA_07_CANONICAL_REGISTRY_ORDER = Object.freeze(["activity", "movement", "exercise", "program"]);
const BETA_07_FAILURE_TOKENS = Object.freeze({
  INPUT_INVALID: "CI_BETA_07_REGISTRY_LOADER_INPUT_INVALID",
  REGISTRY_ORDER_INVALID: "CI_BETA_07_REGISTRY_LOADER_ORDER_INVALID",
  MISSING_REGISTRY: "CI_BETA_07_REGISTRY_LOADER_MISSING_REGISTRY",
  DUPLICATE_REGISTRY_ID: "CI_BETA_07_REGISTRY_LOADER_DUPLICATE_REGISTRY_ID",
  REGISTRY_ID_MISMATCH: "CI_BETA_07_REGISTRY_LOADER_REGISTRY_ID_MISMATCH",
  UNKNOWN_REGISTRY_REFERENCE: "CI_BETA_07_REGISTRY_LOADER_UNKNOWN_REGISTRY_REFERENCE",
  FORWARD_REGISTRY_REFERENCE: "CI_BETA_07_REGISTRY_LOADER_FORWARD_REGISTRY_REFERENCE"
});

const BETA_07_ID_FIELDS = Object.freeze({
  activity: Object.freeze(["activity_id"]),
  movement: Object.freeze(["movement_pattern_id"]),
  exercise: Object.freeze(["exercise_id"]),
  program: Object.freeze(["template_id"])
});

const BETA_07_REFERENCE_FIELDS = Object.freeze({
  activity: Object.freeze([
    Object.freeze(["exercise_ids", "exercise"])
  ]),
  movement: Object.freeze([]),
  exercise: Object.freeze([
    Object.freeze(["movement_pattern_id", "movement"]),
    Object.freeze(["primary_activity_applicability", "activity"]),
    Object.freeze(["secondary_activity_applicability", "activity"])
  ]),
  program: Object.freeze([
    Object.freeze(["activity_id", "activity"]),
    Object.freeze(["exercise_eligibility", "exercise"])
  ])
});

function beta07Fail(failureToken, reason, message, details = {}) {
  const error = new Error(message);
  error.name = "Beta07RegistryLoaderCoreError";
  error.code = failureToken;
  error.reason = reason;
  error.failure_token = failureToken;
  error.details = Object.freeze({ ...details });
  throw error;
}

function beta07RequireObject(value, failureToken, reason, message, details = {}) {
  if (!isPlainRecord(value)) {
    beta07Fail(failureToken, reason, message, details);
  }
}

function beta07Values(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function beta07Collection(registryDocument) {
  if (Array.isArray(registryDocument)) return registryDocument;
  if (!isPlainRecord(registryDocument)) return [];
  if (Array.isArray(registryDocument.entries)) return registryDocument.entries;
  if (isPlainRecord(registryDocument.entries)) return Object.values(registryDocument.entries);

  for (const key of Object.keys(registryDocument)) {
    if (key === "registry_id" || key === "version") continue;
    if (Array.isArray(registryDocument[key])) return registryDocument[key];
    if (isPlainRecord(registryDocument[key])) return Object.values(registryDocument[key]);
  }

  return [];
}

function beta07FirstString(record, fields) {
  for (const field of fields) {
    if (typeof record[field] === "string" && record[field].length > 0) return record[field];
  }

  return null;
}

function beta07AssertCanonicalOrder(order) {
  if (!Array.isArray(order)) {
    beta07Fail(BETA_07_FAILURE_TOKENS.REGISTRY_ORDER_INVALID, "registry_order_not_array", "BETA-07 registry_index.order must be an array.");
  }

  const seen = new Set();
  for (const registryId of order) {
    if (typeof registryId !== "string" || registryId.length === 0) {
      beta07Fail(BETA_07_FAILURE_TOKENS.REGISTRY_ORDER_INVALID, "registry_order_entry_invalid", "BETA-07 registry ids must be non-empty strings.");
    }

    if (seen.has(registryId)) {
      beta07Fail(BETA_07_FAILURE_TOKENS.DUPLICATE_REGISTRY_ID, "duplicate_registry_id", "BETA-07 registry order contains a duplicate id.", { registry_id: registryId });
    }

    seen.add(registryId);
  }

  // The 4 canonical beta ids must remain the leading, unreordered prefix of
  // the real active registry order - a later, separately-authorised
  // activation slice may legitimately append further domains after them
  // (e.g. S-REG-25 appending "equipment"), same as every other guard in
  // this codebase that checks the live registry_index/registry_bundle.
  if (JSON.stringify(order.slice(0, BETA_07_CANONICAL_REGISTRY_ORDER.length)) !== JSON.stringify(BETA_07_CANONICAL_REGISTRY_ORDER)) {
    beta07Fail(BETA_07_FAILURE_TOKENS.REGISTRY_ORDER_INVALID, "non_canonical_registry_order", "BETA-07 registry load order must start with the canonical beta order.", {
      expected_order: [...BETA_07_CANONICAL_REGISTRY_ORDER],
      actual_order: [...order]
    });
  }
}

function beta07CollectIds(registryId, registryDocument) {
  const ids = new Set();
  const fields = BETA_07_ID_FIELDS[registryId] || [];

  for (const record of beta07Collection(registryDocument)) {
    if (!isPlainRecord(record)) continue;
    const id = beta07FirstString(record, fields);
    if (id) ids.add(id);
  }

  return ids;
}

function beta07ValidateReferences(registries, idsByRegistry) {
  const orderPosition = new Map(BETA_07_CANONICAL_REGISTRY_ORDER.map((registryId, index) => [registryId, index]));

  for (const registryId of BETA_07_CANONICAL_REGISTRY_ORDER) {
    for (const record of beta07Collection(registries[registryId])) {
      if (!isPlainRecord(record)) continue;
      const recordId = beta07FirstString(record, BETA_07_ID_FIELDS[registryId] || []) || "unknown_record";

      for (const [field, targetRegistryId] of BETA_07_REFERENCE_FIELDS[registryId] || []) {
        if (!Object.prototype.hasOwnProperty.call(record, field)) continue;

        for (const referencedId of beta07Values(record[field])) {
          if (typeof referencedId !== "string" || referencedId.length === 0) {
            beta07Fail(BETA_07_FAILURE_TOKENS.UNKNOWN_REGISTRY_REFERENCE, "registry_reference_invalid", "BETA-07 registry references must be non-empty strings.", {
              registry_id: registryId,
              record_id: recordId,
              field,
              target_registry_id: targetRegistryId
            });
          }

          if (orderPosition.get(targetRegistryId) > orderPosition.get(registryId)) {
            beta07Fail(BETA_07_FAILURE_TOKENS.FORWARD_REGISTRY_REFERENCE, "forward_registry_reference", "BETA-07 registries must not reference downstream registries during load.", {
              registry_id: registryId,
              record_id: recordId,
              field,
              target_registry_id: targetRegistryId,
              referenced_id: referencedId
            });
          }

          if (!idsByRegistry[targetRegistryId]?.has(referencedId)) {
            beta07Fail(BETA_07_FAILURE_TOKENS.UNKNOWN_REGISTRY_REFERENCE, "unknown_registry_reference", "BETA-07 registry reference does not resolve to a loaded upstream registry entry.", {
              registry_id: registryId,
              record_id: recordId,
              field,
              target_registry_id: targetRegistryId,
              referenced_id: referencedId
            });
          }
        }
      }
    }
  }
}

/**
 * DEV NOTE: BETA-07 registry loader core.
 * Purpose: atomically materialise the beta registry runtime store in canonical order.
 * Boundary: extends the existing registry bridge module only; it does not discover files,
 * mutate registries, activate candidate registries, create fallback loads, or change engine
 * runtime semantics.
 * Determinism: consumes explicit registry_index and registry_bundle objects, validates the
 * closed beta order, clones validated documents, and returns a deep-frozen read-only store.
 * Failure: any invalid registry, order, duplicate id, missing source, unknown reference, or
 * forward reference fails before a runtime store is returned.
 */
function beta07LoadAtomicRegistryStore(input) {
  beta07RequireObject(input, BETA_07_FAILURE_TOKENS.INPUT_INVALID, "loader_input_invalid", "BETA-07 loader input must be an object.");
  beta07RequireObject(input.registry_index, BETA_07_FAILURE_TOKENS.INPUT_INVALID, "registry_index_invalid", "BETA-07 registry_index must be an object.");
  beta07RequireObject(input.registry_bundle, BETA_07_FAILURE_TOKENS.INPUT_INVALID, "registry_bundle_invalid", "BETA-07 registry_bundle must be an object.");
  beta07RequireObject(input.registry_bundle.registries, BETA_07_FAILURE_TOKENS.INPUT_INVALID, "registry_bundle_registries_invalid", "BETA-07 registry_bundle.registries must be an object.");

  beta07AssertCanonicalOrder(input.registry_index.order);

  // The real active order (already verified above to start with the 4
  // canonical beta ids, unreordered) drives everything below, so a later,
  // separately-authorised activation that legitimately appends further
  // domains (e.g. S-REG-25's "equipment") is loaded too, not silently
  // dropped.
  const actualOrder = input.registry_index.order;

  for (const registryId of actualOrder) {
    if (!Object.prototype.hasOwnProperty.call(input.registry_bundle.registries, registryId)) {
      beta07Fail(BETA_07_FAILURE_TOKENS.MISSING_REGISTRY, "missing_registry", "BETA-07 required registry is missing from the bundle.", { registry_id: registryId });
    }
  }

  const bundleKeys = Object.keys(input.registry_bundle.registries);
  if (JSON.stringify(bundleKeys) !== JSON.stringify(actualOrder)) {
    beta07Fail(BETA_07_FAILURE_TOKENS.REGISTRY_ORDER_INVALID, "registry_bundle_key_order_mismatch", "BETA-07 registry_bundle.registries key order must match the active registry order.", {
      expected_order: [...actualOrder],
      actual_order: bundleKeys
    });
  }

  const seenRegistryDocumentIds = new Set();
  const orderedRegistries = {};
  const idsByRegistry = {};

  for (const registryId of actualOrder) {
    const registryDocument = input.registry_bundle.registries[registryId];
    beta07RequireObject(registryDocument, BETA_07_FAILURE_TOKENS.INPUT_INVALID, "registry_document_invalid", "BETA-07 registry document must be an object.", { registry_id: registryId });

    const documentRegistryId = typeof registryDocument.registry_id === "string" && registryDocument.registry_id.length > 0 ? registryDocument.registry_id : registryId;

    if (seenRegistryDocumentIds.has(documentRegistryId)) {
      beta07Fail(BETA_07_FAILURE_TOKENS.DUPLICATE_REGISTRY_ID, "duplicate_registry_id", "BETA-07 registry document id duplicates another registry.", {
        registry_id: registryId,
        document_registry_id: documentRegistryId
      });
    }

    if (documentRegistryId !== registryId) {
      beta07Fail(BETA_07_FAILURE_TOKENS.REGISTRY_ID_MISMATCH, "registry_id_mismatch", "BETA-07 registry document id must match the registry key.", {
        registry_id: registryId,
        document_registry_id: documentRegistryId
      });
    }

    seenRegistryDocumentIds.add(documentRegistryId);
    orderedRegistries[registryId] = registryDocument;
    idsByRegistry[registryId] = beta07CollectIds(registryId, registryDocument);
  }

  // Reference/forward-reference validation only ever runs over the 4
  // canonical beta ids' own FK matrix (BETA_07_REFERENCE_FIELDS) - domains
  // appended after them neither declare nor receive references in that
  // matrix, so they need no additional validation here.
  beta07ValidateReferences(orderedRegistries, idsByRegistry);

  const clonedRegistries = {};
  for (const registryId of actualOrder) {
    clonedRegistries[registryId] = cloneJson(orderedRegistries[registryId]);
  }

  return deepFreeze({
    ok: true,
    loader_slice_id: BETA_07_SLICE_ID,
    loader_version: BETA_07_LOADER_VERSION,
    registry_order: [...actualOrder],
    registry_count: actualOrder.length,
    atomic_load: true,
    partial_consumption_allowed: false,
    fallback_allowed: false,
    discovery_allowed: false,
    runtime_mutation_allowed: false,
    loaded_registry_ids: [...actualOrder],
    registries: clonedRegistries
  });
}

export {
  BETA_07_CANONICAL_REGISTRY_ORDER,
  BETA_07_FAILURE_TOKENS,
  BETA_07_LOADER_VERSION,
  BETA_07_SLICE_ID,
  S_REG_04_BRIDGE_VERSION,
  S_REG_04_CANONICAL_ALIAS_MAP,
  S_REG_04_FAILURE_TOKEN,
  S_REG_04_SLICE_ID,
  beta07LoadAtomicRegistryStore,
  sReg04CanonicalAliasMap,
  sReg04ResolveCanonicalRegistry,
  sReg04ResolveCanonicalRegistryMap,
  sReg04SupportedCanonicalRegistryIds
};
