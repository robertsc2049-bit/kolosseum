import { beta07LoadAtomicRegistryStore } from "./s_reg_04_legacy_to_canonical_registry_bridge.mjs";

export const BETA_08_SLICE_ID = "BETA-08";
export const BETA_08_GUARD_VERSION = "1.0.0";

export const BETA_08_FAILURE_TOKENS = Object.freeze({
  INPUT_INVALID: "CI_BETA_08_REGISTRY_FK_ENUM_INPUT_INVALID",
  UNKNOWN_ENUM_TOKEN: "CI_BETA_08_REGISTRY_FK_ENUM_UNKNOWN_ENUM_TOKEN",
  DUPLICATE_ENTRY_ID: "CI_BETA_08_REGISTRY_FK_ENUM_DUPLICATE_ENTRY_ID",
  UNRESOLVED_FK: "CI_BETA_08_REGISTRY_FK_ENUM_UNRESOLVED_FK",
  ACTIVITY_SUBDIVISION_MISMATCH: "CI_BETA_08_REGISTRY_FK_ENUM_ACTIVITY_SUBDIVISION_MISMATCH",
  METRIC_ACTIVITY_MISMATCH: "CI_BETA_08_REGISTRY_FK_ENUM_METRIC_ACTIVITY_MISMATCH",
  MISSING_METRIC_EXERCISE_LINK: "CI_BETA_08_REGISTRY_FK_ENUM_MISSING_METRIC_EXERCISE_LINK",
  DERIVED_ONLY_PHASE1_METRIC: "CI_BETA_08_REGISTRY_FK_ENUM_DERIVED_ONLY_PHASE1_METRIC",
  CROSS_DOMAIN_CONTAMINATION: "CI_BETA_08_REGISTRY_FK_ENUM_CROSS_DOMAIN_CONTAMINATION"
});

const BETA_08_REQUIRED_METRIC_REGISTRY_IDS = Object.freeze({
  sport_subdivision: "sport_subdivision",
  sport_metric: "sport_metric_registry_1c",
  metric_exercise_link: "metric_exercise_link_registry_1c_a"
});

const BETA_08_CROSS_DOMAIN_FORBIDDEN_KEYS = Object.freeze({
  activity: Object.freeze([
    "sport_metric_id",
    "metric_exercise_link_id",
    "sport_subdivision_id",
    "threshold_marker_id",
    "marker_evaluator"
  ]),
  movement: Object.freeze([
    "sport_metric_id",
    "metric_exercise_link_id",
    "sport_subdivision_id",
    "threshold_marker_id",
    "marker_evaluator"
  ]),
  exercise: Object.freeze([
    "sport_metric_id",
    "sport_metric_ids",
    "metric_exercise_link_id",
    "sport_subdivision_id",
    "threshold_marker_id",
    "marker_evaluator",
    "derived_metric_formula"
  ]),
  program: Object.freeze([
    "sport_metric_id",
    "metric_exercise_link_id",
    "threshold_marker_id",
    "marker_evaluator"
  ]),
  sport_subdivision: Object.freeze([
    "exercise_id",
    "sport_metric_id",
    "metric_exercise_link_id",
    "threshold_marker_id",
    "marker_evaluator"
  ]),
  sport_metric: Object.freeze([
    "exercise_id",
    "exercise_ids",
    "metric_exercise_link_id",
    "threshold_marker_id",
    "marker_status",
    "marker_evaluator",
    "readiness_status",
    "safety_status",
    "suitability_status",
    "recommendation_score",
    "ranking_score",
    "derived_metric_formula"
  ]),
  metric_exercise_link: Object.freeze([
    "threshold_marker_id",
    "marker_status",
    "marker_evaluator",
    "readiness_status",
    "safety_status",
    "suitability_status",
    "recommendation_score",
    "ranking_score",
    "phase1_runtime_schema_mutation"
  ])
});

/**
 * DEV NOTE: BETA-08 registry FK and enum guard.
 * Purpose: validates beta registry enum tokens and cross-registry references as a closed-world CI guard.
 * Boundary: composes the existing BETA-07 atomic registry loader; it does not load files, discover
 * registries, activate candidate registries, add metric semantics, create threshold evaluators, or mutate
 * Phase 1/runtime engine behaviour.
 * Determinism: all accepted tokens, registries, FKs, and Phase 1 metric declarations are explicit inputs.
 * Failure: invalid enum tokens, duplicate entry ids, unresolved FKs, activity/subdivision mismatch,
 * metric/activity mismatch, missing 1C-A links, derived-only Phase 1 metric declarations, and
 * cross-domain contamination fail closed with stable BETA-08 CI tokens.
 */
export function beta08ValidateRegistryFkEnumGuard(input = {}) {
  requirePlainRecord(input, BETA_08_FAILURE_TOKENS.INPUT_INVALID, "guard_input_invalid", "BETA-08 input must be an object.");

  const runtimeStore = beta07LoadAtomicRegistryStore({
    registry_index: input.registry_index,
    registry_bundle: input.registry_bundle
  });

  const enumBundle = requireEnumBundle(input.enum_bundle);
  const metricRegistries = requireMetricRegistries(input.beta_metric_registries);
  const phase1Declaration = requirePlainRecord(
    input.phase1_declaration,
    BETA_08_FAILURE_TOKENS.INPUT_INVALID,
    "phase1_declaration_invalid",
    "BETA-08 phase1_declaration must be an object."
  );

  const activityIds = collectUniqueEntries(runtimeStore.registries.activity, ["activity_id", "id"], "activity");
  const movementIds = collectUniqueEntries(runtimeStore.registries.movement, ["movement_id", "id"], "movement");
  const exerciseRecords = collectUniqueRecords(runtimeStore.registries.exercise, ["exercise_id", "id"], "exercise");
  const programIds = collectUniqueEntries(runtimeStore.registries.program, ["program_id", "id"], "program");

  assertCrossDomainClean("activity", recordsOf(runtimeStore.registries.activity));
  assertCrossDomainClean("movement", recordsOf(runtimeStore.registries.movement));
  assertCrossDomainClean("exercise", exerciseRecords.records);
  assertCrossDomainClean("program", recordsOf(runtimeStore.registries.program));

  for (const activityId of activityIds) {
    assertEnumToken(enumBundle.activity_ids, activityId, "activity_id", { registry_id: "activity" });
  }

  for (const movementId of movementIds) {
    if (typeof movementId !== "string" || movementId.length === 0) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "movement_id_invalid", "Movement ids must be non-empty strings.");
    }
  }

  for (const programId of programIds) {
    if (typeof programId !== "string" || programId.length === 0) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "program_id_invalid", "Program ids must be non-empty strings.");
    }
  }

  const exerciseById = new Map(exerciseRecords.records.map((record) => [record.__beta08_entry_id, record]));
  for (const exercise of exerciseRecords.records) {
    for (const activityId of activityIdsForExercise(exercise)) {
      assertEnumToken(enumBundle.activity_ids, activityId, "exercise.activity_id", {
        exercise_id: exercise.__beta08_entry_id
      });
      assertKnown(activityIds, activityId, "activity", "exercise_activity_fk_unknown", {
        exercise_id: exercise.__beta08_entry_id,
        activity_id: activityId
      });
    }
  }

  const subdivisionRecords = collectUniqueRecords(
    metricRegistries.sport_subdivision,
    ["sport_subdivision_id", "id"],
    "sport_subdivision"
  );
  const metricRecords = collectUniqueRecords(
    metricRegistries.sport_metric,
    ["sport_metric_id", "id"],
    "sport_metric"
  );
  const linkRecords = collectUniqueRecords(
    metricRegistries.metric_exercise_link,
    ["metric_exercise_link_id", "id"],
    "metric_exercise_link"
  );

  assertCrossDomainClean("sport_subdivision", subdivisionRecords.records);
  assertCrossDomainClean("sport_metric", metricRecords.records);
  assertCrossDomainClean("metric_exercise_link", linkRecords.records);

  const subdivisionById = new Map(subdivisionRecords.records.map((record) => [record.__beta08_entry_id, record]));
  const metricById = new Map(metricRecords.records.map((record) => [record.__beta08_entry_id, record]));
  const linkByMetricAndActivity = new Map();

  for (const subdivision of subdivisionRecords.records) {
    const activityId = requireString(subdivision.activity_id, "activity_id", {
      registry_id: "sport_subdivision",
      sport_subdivision_id: subdivision.__beta08_entry_id
    });

    assertEnumToken(enumBundle.activity_ids, activityId, "sport_subdivision.activity_id", {
      sport_subdivision_id: subdivision.__beta08_entry_id
    });
    assertKnown(activityIds, activityId, "activity", "sport_subdivision_activity_fk_unknown", {
      sport_subdivision_id: subdivision.__beta08_entry_id,
      activity_id: activityId
    });
  }

  for (const metric of metricRecords.records) {
    const sportMetricId = metric.__beta08_entry_id;
    const activityId = requireString(metric.activity_id, "activity_id", { sport_metric_id: sportMetricId });
    const subdivisionId = requireString(metric.sport_subdivision_id, "sport_subdivision_id", {
      sport_metric_id: sportMetricId
    });
    const metricKind = requireString(metric.metric_kind, "metric_kind", { sport_metric_id: sportMetricId });
    const valueType = requireString(metric.value_type, "value_type", { sport_metric_id: sportMetricId });
    const metricSource = requireString(metric.metric_source, "metric_source", { sport_metric_id: sportMetricId });

    assertEnumToken(enumBundle.activity_ids, activityId, "sport_metric.activity_id", { sport_metric_id: sportMetricId });
    assertEnumToken(enumBundle.metric_kinds, metricKind, "sport_metric.metric_kind", { sport_metric_id: sportMetricId });
    assertEnumToken(enumBundle.metric_value_types, valueType, "sport_metric.value_type", { sport_metric_id: sportMetricId });
    assertEnumToken(enumBundle.metric_sources, metricSource, "sport_metric.metric_source", { sport_metric_id: sportMetricId });
    assertKnown(activityIds, activityId, "activity", "sport_metric_activity_fk_unknown", {
      sport_metric_id: sportMetricId,
      activity_id: activityId
    });

    const subdivision = subdivisionById.get(subdivisionId);
    if (!subdivision) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "sport_metric_subdivision_fk_unknown", "Sport metric references an unknown subdivision.", {
        sport_metric_id: sportMetricId,
        sport_subdivision_id: subdivisionId
      });
    }

    if (subdivision.activity_id !== activityId) {
      fail(BETA_08_FAILURE_TOKENS.ACTIVITY_SUBDIVISION_MISMATCH, "sport_metric_subdivision_activity_mismatch", "Sport metric activity must match referenced subdivision activity.", {
        sport_metric_id: sportMetricId,
        metric_activity_id: activityId,
        subdivision_activity_id: subdivision.activity_id
      });
    }
  }

  for (const link of linkRecords.records) {
    const linkId = link.__beta08_entry_id;
    const sportMetricId = requireString(link.sport_metric_id, "sport_metric_id", { metric_exercise_link_id: linkId });
    const exerciseId = requireString(link.exercise_id, "exercise_id", { metric_exercise_link_id: linkId });
    const activityId = requireString(link.activity_id, "activity_id", { metric_exercise_link_id: linkId });

    assertEnumToken(enumBundle.activity_ids, activityId, "metric_exercise_link.activity_id", {
      metric_exercise_link_id: linkId
    });
    assertKnown(activityIds, activityId, "activity", "metric_exercise_link_activity_fk_unknown", {
      metric_exercise_link_id: linkId,
      activity_id: activityId
    });

    const metric = metricById.get(sportMetricId);
    if (!metric) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "metric_exercise_link_metric_fk_unknown", "Metric-exercise link references an unknown sport metric.", {
        metric_exercise_link_id: linkId,
        sport_metric_id: sportMetricId
      });
    }

    if (metric.activity_id !== activityId) {
      fail(BETA_08_FAILURE_TOKENS.METRIC_ACTIVITY_MISMATCH, "metric_exercise_link_metric_activity_mismatch", "Metric-exercise link activity must match referenced metric activity.", {
        metric_exercise_link_id: linkId,
        sport_metric_id: sportMetricId,
        metric_activity_id: metric.activity_id,
        link_activity_id: activityId
      });
    }

    const exercise = exerciseById.get(exerciseId);
    if (!exercise) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "metric_exercise_link_exercise_fk_unknown", "Metric-exercise link references an unknown exercise.", {
        metric_exercise_link_id: linkId,
        exercise_id: exerciseId
      });
    }

    if (!activityIdsForExercise(exercise).includes(activityId)) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "metric_exercise_link_exercise_activity_fk_unknown", "Metric-exercise link activity must be declared on the referenced exercise.", {
        metric_exercise_link_id: linkId,
        exercise_id: exerciseId,
        activity_id: activityId
      });
    }

    const key = `${sportMetricId}::${activityId}`;
    const existing = linkByMetricAndActivity.get(key) ?? [];
    existing.push(linkId);
    linkByMetricAndActivity.set(key, existing);
  }

  const phase1ActivityId = requireString(phase1Declaration.activity_id, "activity_id", {
    surface: "phase1_declaration"
  });
  assertEnumToken(enumBundle.activity_ids, phase1ActivityId, "phase1.activity_id", {
    surface: "phase1_declaration"
  });
  assertKnown(activityIds, phase1ActivityId, "activity", "phase1_activity_fk_unknown", {
    activity_id: phase1ActivityId
  });

  const declaredMetricIds = declaredPhase1MetricIds(phase1Declaration);
  for (const sportMetricId of declaredMetricIds) {
    const metric = metricById.get(sportMetricId);
    if (!metric) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "phase1_metric_fk_unknown", "Phase 1 declaration references an unknown sport metric.", {
        sport_metric_id: sportMetricId
      });
    }

    if (metric.activity_id !== phase1ActivityId) {
      fail(BETA_08_FAILURE_TOKENS.METRIC_ACTIVITY_MISMATCH, "phase1_metric_activity_mismatch", "Phase 1 metric activity must match Phase 1 activity.", {
        sport_metric_id: sportMetricId,
        metric_activity_id: metric.activity_id,
        phase1_activity_id: phase1ActivityId
      });
    }

    if (metric.metric_source === "derived_only") {
      fail(BETA_08_FAILURE_TOKENS.DERIVED_ONLY_PHASE1_METRIC, "derived_only_metric_declared_in_phase1", "Derived-only metrics must not be declared as Phase 1 metrics.", {
        sport_metric_id: sportMetricId
      });
    }

    if (!linkByMetricAndActivity.has(`${sportMetricId}::${phase1ActivityId}`)) {
      fail(BETA_08_FAILURE_TOKENS.MISSING_METRIC_EXERCISE_LINK, "declared_metric_missing_metric_exercise_link", "Declared Phase 1 metric requires at least one matching 1C-A metric-to-exercise link.", {
        sport_metric_id: sportMetricId,
        activity_id: phase1ActivityId
      });
    }
  }

  return deepFreeze({
    ok: true,
    guard_slice_id: BETA_08_SLICE_ID,
    guard_version: BETA_08_GUARD_VERSION,
    checked_activity_id: phase1ActivityId,
    checked_metric_ids: declaredMetricIds,
    activity_count: activityIds.size,
    exercise_count: exerciseById.size,
    sport_subdivision_count: subdivisionById.size,
    sport_metric_count: metricById.size,
    metric_exercise_link_count: linkRecords.records.length,
    enum_bundle_version: enumBundle.enum_bundle_version,
    closed_world: true,
    failure_domain: "ci_registry_fk_enum_guard"
  });
}

function requirePlainRecord(value, token, reason, message, details = {}) {
  if (!isPlainRecord(value)) {
    fail(token, reason, message, details);
  }

  return value;
}

function requireEnumBundle(enumBundle) {
  requirePlainRecord(enumBundle, BETA_08_FAILURE_TOKENS.INPUT_INVALID, "enum_bundle_invalid", "BETA-08 enum_bundle must be an object.");

  const requiredLists = [
    "activity_ids",
    "metric_value_types",
    "metric_kinds",
    "metric_sources",
    "registry_domains"
  ];

  for (const field of requiredLists) {
    requireStringArray(enumBundle[field], field, { surface: "enum_bundle" });
  }

  if (enumBundle.enum_bundle_version !== "EB2-1.0.0") {
    fail(BETA_08_FAILURE_TOKENS.UNKNOWN_ENUM_TOKEN, "enum_bundle_version_unknown", "BETA-08 enum bundle version must be EB2-1.0.0.", {
      enum_bundle_version: enumBundle.enum_bundle_version
    });
  }

  return enumBundle;
}

function requireMetricRegistries(value) {
  requirePlainRecord(value, BETA_08_FAILURE_TOKENS.INPUT_INVALID, "metric_registries_invalid", "BETA-08 beta_metric_registries must be an object.");

  for (const [field, registryId] of Object.entries(BETA_08_REQUIRED_METRIC_REGISTRY_IDS)) {
    requirePlainRecord(value[field], BETA_08_FAILURE_TOKENS.INPUT_INVALID, "metric_registry_missing", "BETA-08 required metric registry is missing.", {
      registry_key: field
    });

    if (value[field].registry_id !== registryId) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "metric_registry_id_invalid", "BETA-08 metric registry id does not match required registry.", {
        registry_key: field,
        expected_registry_id: registryId,
        actual_registry_id: value[field].registry_id
      });
    }
  }

  return value;
}

function recordsOf(registryDocument) {
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

function collectUniqueEntries(registryDocument, idFields, registryId) {
  return collectUniqueRecords(registryDocument, idFields, registryId).ids;
}

function collectUniqueRecords(registryDocument, idFields, registryId) {
  const ids = new Set();
  const records = [];

  for (const record of recordsOf(registryDocument)) {
    requirePlainRecord(record, BETA_08_FAILURE_TOKENS.INPUT_INVALID, "registry_record_invalid", "BETA-08 registry record must be an object.", {
      registry_id: registryId
    });

    const id = firstString(record, idFields);
    if (!id) {
      fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, "registry_record_id_missing", "BETA-08 registry record id must be a non-empty string.", {
        registry_id: registryId,
        id_fields: idFields
      });
    }

    if (ids.has(id)) {
      fail(BETA_08_FAILURE_TOKENS.DUPLICATE_ENTRY_ID, "duplicate_entry_id", "BETA-08 registry entry id must be unique.", {
        registry_id: registryId,
        entry_id: id
      });
    }

    ids.add(id);
    records.push({ ...record, __beta08_entry_id: id });
  }

  return Object.freeze({
    ids,
    records
  });
}

function assertCrossDomainClean(registryDomain, records) {
  const forbidden = BETA_08_CROSS_DOMAIN_FORBIDDEN_KEYS[registryDomain] ?? [];
  for (const record of records) {
    for (const field of forbidden) {
      if (Object.prototype.hasOwnProperty.call(record, field)) {
        fail(BETA_08_FAILURE_TOKENS.CROSS_DOMAIN_CONTAMINATION, "registry_cross_domain_contamination", "BETA-08 registry record contains a field from another registry domain.", {
          registry_domain: registryDomain,
          entry_id: record.__beta08_entry_id ?? firstString(record, ["id", "activity_id", "movement_id", "exercise_id", "program_id", "sport_subdivision_id", "sport_metric_id", "metric_exercise_link_id"]),
          field
        });
      }
    }
  }
}

function declaredPhase1MetricIds(phase1Declaration) {
  const declared = phase1Declaration.declared_metric_ids ?? [];
  if (!Array.isArray(declared)) {
    fail(BETA_08_FAILURE_TOKENS.INPUT_INVALID, "phase1_declared_metric_ids_invalid", "Phase 1 declared_metric_ids must be an array when present.");
  }

  const out = [];
  for (const value of declared) {
    if (typeof value !== "string" || value.length === 0) {
      fail(BETA_08_FAILURE_TOKENS.INPUT_INVALID, "phase1_declared_metric_id_invalid", "Phase 1 declared metric ids must be non-empty strings.");
    }

    out.push(value);
  }

  return out;
}

function activityIdsForExercise(exercise) {
  if (Array.isArray(exercise.activity_ids)) return exercise.activity_ids;
  if (Array.isArray(exercise.activity_applicability)) return exercise.activity_applicability;
  const out = [];
  if (typeof exercise.activity_id === "string") out.push(exercise.activity_id);
  if (typeof exercise.primary_activity_applicability === "string") out.push(exercise.primary_activity_applicability);
  if (Array.isArray(exercise.secondary_activity_applicability)) out.push(...exercise.secondary_activity_applicability);
  return out;
}

function assertEnumToken(allowedSet, value, field, context) {
  if (!allowedSet.includes(value)) {
    fail(BETA_08_FAILURE_TOKENS.UNKNOWN_ENUM_TOKEN, "unknown_enum_token", "BETA-08 enum token is not in the beta enum bundle.", {
      ...context,
      field,
      value
    });
  }
}

function assertKnown(set, value, targetRegistryId, reason, context) {
  if (!set.has(value)) {
    fail(BETA_08_FAILURE_TOKENS.UNRESOLVED_FK, reason, "BETA-08 foreign key does not resolve in the loaded registry store.", {
      ...context,
      target_registry_id: targetRegistryId,
      referenced_id: value
    });
  }
}

function requireString(value, field, context) {
  if (typeof value !== "string" || value.length === 0) {
    fail(BETA_08_FAILURE_TOKENS.INPUT_INVALID, "required_string_invalid", "BETA-08 required string field is invalid.", {
      ...context,
      field
    });
  }

  return value;
}

function requireStringArray(value, field, context) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    fail(BETA_08_FAILURE_TOKENS.INPUT_INVALID, "required_string_array_invalid", "BETA-08 required enum array field is invalid.", {
      ...context,
      field
    });
  }

  if (new Set(value).size !== value.length) {
    fail(BETA_08_FAILURE_TOKENS.DUPLICATE_ENTRY_ID, "duplicate_enum_token", "BETA-08 enum bundle contains duplicate tokens.", {
      ...context,
      field
    });
  }

  return value;
}

function firstString(record, fields) {
  for (const field of fields) {
    if (typeof record[field] === "string" && record[field].length > 0) return record[field];
  }

  return null;
}

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(failureToken, reason, message, details = {}) {
  const error = new Error(message);
  error.name = "Beta08RegistryFkEnumGuardError";
  error.code = failureToken;
  error.failure_token = failureToken;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  throw error;
}

function deepFreeze(value) {
  if (!isPlainRecord(value) && !Array.isArray(value)) return value;

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return Object.freeze(value);
}
