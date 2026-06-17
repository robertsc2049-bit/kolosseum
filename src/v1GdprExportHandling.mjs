import { createHash } from "node:crypto";

// DEV NOTE: S-V1-L-02 is a legal/data access export surface only. It is
// permission-scoped to the requesting user's own data and must not import the
// engine, produce evidence artefacts, expose organisation export, or widen into
// analytics. The deterministic probe is hashed only to prove this surface does
// not mutate engine truth.

export const S_V1_L_02_GDPR_EXPORT_HANDLING_VERSION = "1.0.0";
export const GDPR_EXPORT_HANDLING_SURFACE_ID = "gdpr_export_handling";

export const GDPR_EXPORT_ALLOWED_REQUEST_TYPES = Object.freeze([
  "subject_data_access_json"
]);

export const GDPR_EXPORT_ALLOWED_ACTOR_TYPES = Object.freeze([
  "athlete",
  "coach"
]);

export const GDPR_EXPORT_ALLOWED_INPUT_KEYS = Object.freeze([
  "request_id",
  "actor_user_id",
  "actor_type",
  "target_user_id",
  "requested_export_type",
  "requested_at",
  "deterministic_probe",
  "data_sources"
]);

export const GDPR_EXPORT_ALLOWED_DATA_CATEGORIES = Object.freeze([
  "account",
  "phase1_declarations",
  "relationships",
  "programme_assignments",
  "session_records",
  "runtime_events",
  "coach_notes_authored",
  "legal_document_acknowledgements",
  "billing_records"
]);

export const GDPR_EXPORT_COPY_IDS = Object.freeze([
  "gdpr_export.available",
  "gdpr_export.blocked",
  "gdpr_export.own_data_only",
  "gdpr_export.legal_data_access_only",
  "gdpr_export.neutral_notice"
]);

export const GDPR_EXPORT_BOUNDARY = Object.freeze({
  legal_data_access_only: true,
  permission_scoped: true,
  own_user_data_only: true,
  proof_layer_export: false,
  organisation_export: false,
  broad_analytics_export: false,
  engine_truth_changed: false,
  coaching_correctness_claim: false,
  training_value_claim: false,
  external_approval_claim: false
});

const allowedInputKeySet = new Set(GDPR_EXPORT_ALLOWED_INPUT_KEYS);
const allowedRequestTypeSet = new Set(GDPR_EXPORT_ALLOWED_REQUEST_TYPES);
const allowedActorTypeSet = new Set(GDPR_EXPORT_ALLOWED_ACTOR_TYPES);
const allowedDataCategorySet = new Set(GDPR_EXPORT_ALLOWED_DATA_CATEGORIES);

const blockedPayloadKeySet = new Set([
  "aggregate_export",
  "analytics",
  "analytics_export",
  "broad_analytics_export",
  "bulk_data_export",
  "coaching_correctness",
  "coach_notes_export",
  "correctness_claim",
  "evidence",
  "evidence_envelope",
  "evidence_export",
  "external_approval",
  "organisation",
  "organisation_export",
  "organization",
  "organization_export",
  "org_export",
  "proof",
  "proof_artefact",
  "proof_export",
  "raw_runtime_events_export",
  "sealed_evidence",
  "training_value_claim"
]);

const subjectOwnershipKeys = Object.freeze([
  "user_id",
  "owner_user_id",
  "subject_user_id",
  "athlete_user_id",
  "coach_user_id",
  "customer_user_id"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = stableValue(value[key]);
    }
    return output;
  }

  return value;
}

export function stableGdprExportJson(value) {
  return JSON.stringify(stableValue(value));
}

export function hashGdprExportValue(value) {
  return createHash("sha256")
    .update(stableGdprExportJson(value))
    .digest("hex");
}

function errorResult(code, details = {}) {
  return {
    ok: false,
    surface_id: GDPR_EXPORT_HANDLING_SURFACE_ID,
    version: S_V1_L_02_GDPR_EXPORT_HANDLING_VERSION,
    code,
    copy_id: "gdpr_export.blocked",
    product_permission_state_only: true,
    engine_visible: false,
    engine_truth_changed: false,
    details: stableValue(details)
  };
}

function assertNonEmptyString(value, code, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return errorResult(code, { field });
  }
  return null;
}

function findUnknownTopLevelKey(input) {
  for (const key of Object.keys(input)) {
    if (!allowedInputKeySet.has(key)) {
      return key;
    }
  }
  return null;
}

function findBlockedPayloadKey(value, path = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findBlockedPayloadKey(value[index], path + "[" + index + "]");
      if (found !== null) {
        return found;
      }
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of Object.keys(value)) {
    if (blockedPayloadKeySet.has(key)) {
      return { path: path + "." + key, key };
    }

    const found = findBlockedPayloadKey(value[key], path + "." + key);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

function normaliseCategoryRecords(category, value) {
  if (value === undefined) {
    return [];
  }

  const records = Array.isArray(value) ? value : [value];

  return records.map((record, index) => {
    if (!isPlainObject(record)) {
      throw new TypeError("gdpr_export_category_record_must_be_object:" + category + ":" + index);
    }

    return stableValue(record);
  });
}

function getTemporalSortKey(record) {
  const candidates = [
    record.recorded_at,
    record.created_at,
    record.updated_at,
    record.accepted_at,
    record.started_at,
    record.completed_at,
    record.event_at,
    record.id,
    record.record_id
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return stableGdprExportJson(record);
}

function sortRecords(records) {
  return records
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const leftKey = getTemporalSortKey(left.record);
      const rightKey = getTemporalSortKey(right.record);
      if (leftKey < rightKey) return -1;
      if (leftKey > rightKey) return 1;
      return left.index - right.index;
    })
    .map((item) => item.record);
}

function assertRecordBelongsToSubject(record, targetUserId, category, index) {
  for (const key of subjectOwnershipKeys) {
    if (Object.hasOwn(record, key) && record[key] !== targetUserId) {
      return errorResult("gdpr_export_record_permission_denied", {
        category,
        index,
        field: key
      });
    }
  }

  return null;
}

function buildSubjectData(input) {
  const source = isPlainObject(input.data_sources) ? input.data_sources : {};
  const unknownCategory = Object.keys(source).find((key) => !allowedDataCategorySet.has(key));
  if (unknownCategory) {
    return errorResult("gdpr_export_unknown_data_category", { category: unknownCategory });
  }

  const subjectData = {};
  const counts = {};

  for (const category of GDPR_EXPORT_ALLOWED_DATA_CATEGORIES) {
    let records;
    try {
      records = normaliseCategoryRecords(category, source[category]);
    } catch (error) {
      return errorResult("gdpr_export_data_record_invalid", {
        category,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    const sorted = sortRecords(records);

    for (let index = 0; index < sorted.length; index += 1) {
      const permissionError = assertRecordBelongsToSubject(
        sorted[index],
        input.target_user_id,
        category,
        index
      );

      if (permissionError !== null) {
        return permissionError;
      }
    }

    subjectData[category] = sorted;
    counts[category] = sorted.length;
  }

  return {
    ok: true,
    subject_data: stableValue(subjectData),
    included_category_counts: stableValue(counts)
  };
}

export function createGdprExportHandling(input) {
  if (!isPlainObject(input)) {
    return errorResult("gdpr_export_input_object_required");
  }

  const unknownKey = findUnknownTopLevelKey(input);
  if (unknownKey !== null) {
    return errorResult("gdpr_export_unknown_input_key", { key: unknownKey });
  }

  for (const field of [
    "request_id",
    "actor_user_id",
    "actor_type",
    "target_user_id",
    "requested_export_type",
    "requested_at"
  ]) {
    const stringError = assertNonEmptyString(
      input[field],
      "gdpr_export_required_string_missing",
      field
    );

    if (stringError !== null) {
      return stringError;
    }
  }

  if (!allowedActorTypeSet.has(input.actor_type)) {
    return errorResult("gdpr_export_actor_type_not_allowed", {
      actor_type: input.actor_type
    });
  }

  if (!allowedRequestTypeSet.has(input.requested_export_type)) {
    return errorResult("gdpr_export_type_not_allowed", {
      requested_export_type: input.requested_export_type
    });
  }

  if (input.actor_user_id !== input.target_user_id) {
    return errorResult("gdpr_export_permission_denied", {
      permission_scope: "own_user_data_only"
    });
  }

  if (input.data_sources !== undefined && !isPlainObject(input.data_sources)) {
    return errorResult("gdpr_export_data_sources_object_required");
  }

  const blocked = findBlockedPayloadKey(input.data_sources ?? {});
  if (blocked !== null) {
    return errorResult("gdpr_export_blocked_payload_key", blocked);
  }

  const dataResult = buildSubjectData(input);
  if (dataResult.ok !== true) {
    return dataResult;
  }

  const deterministicProbeHash =
    input.deterministic_probe === undefined ? null : hashGdprExportValue(input.deterministic_probe);

  const exportPayload = stableValue({
    surface_id: GDPR_EXPORT_HANDLING_SURFACE_ID,
    version: S_V1_L_02_GDPR_EXPORT_HANDLING_VERSION,
    request: {
      request_id: input.request_id,
      actor_user_id: input.actor_user_id,
      actor_type: input.actor_type,
      target_user_id: input.target_user_id,
      requested_export_type: input.requested_export_type,
      requested_at: input.requested_at
    },
    permission: {
      permission_scoped: true,
      permission_scope: "own_user_data_only",
      product_permission_state_only: true
    },
    boundary: GDPR_EXPORT_BOUNDARY,
    export_format: {
      media_type: "application/json",
      temporal_ordering_preserved: true,
      semantic_enrichment: false
    },
    included_category_counts: dataResult.included_category_counts,
    subject_data: dataResult.subject_data,
    deterministic_probe_hash: deterministicProbeHash,
    copy_ids: GDPR_EXPORT_COPY_IDS
  });

  const exportPayloadHash = hashGdprExportValue(exportPayload);

  return stableValue({
    ok: true,
    export_id: "gdpr_export_" + exportPayloadHash.slice(0, 16),
    export_payload_hash: exportPayloadHash,
    copy_id: "gdpr_export.available",
    copy_notice_id: "gdpr_export.neutral_notice",
    engine_visible: false,
    engine_truth_changed: false,
    ...exportPayload
  });
}

export function assertGdprExportHandling(input) {
  const result = createGdprExportHandling(input);
  if (result.ok !== true) {
    throw new Error(result.code);
  }
  return result;
}

export function serializeGdprExportHandling(input) {
  const result = createGdprExportHandling(input);
  return stableGdprExportJson(result);
}