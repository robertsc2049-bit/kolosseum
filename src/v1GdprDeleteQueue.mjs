import { createHash } from "node:crypto";

// DEV NOTE: S-V1-L-03 records GDPR deletion requests into a product/legal queue
// only. It must not perform hard deletion, mutate deterministic engine truth,
// change historical runtime records, or remove retained proof/audit records.
// Retention outcomes are recorded as explicit review boundaries for later
// lawful handling outside deterministic engine truth.

export const S_V1_L_03_GDPR_DELETE_QUEUE_VERSION = "1.0.0";
export const GDPR_DELETE_QUEUE_SURFACE_ID = "gdpr_delete_queue";

export const GDPR_DELETE_ALLOWED_REQUEST_TYPES = Object.freeze([
  "subject_erasure_request"
]);

export const GDPR_DELETE_ALLOWED_ACTOR_TYPES = Object.freeze([
  "athlete",
  "coach"
]);

export const GDPR_DELETE_ALLOWED_SCOPES = Object.freeze([
  "own_user_data"
]);

export const GDPR_DELETE_ALLOWED_INPUT_KEYS = Object.freeze([
  "request_id",
  "actor_user_id",
  "actor_type",
  "target_user_id",
  "requested_action",
  "requested_scope",
  "requested_at",
  "reason_code",
  "deterministic_probe",
  "retention_records"
]);

export const GDPR_DELETE_ALLOWED_REASON_CODES = Object.freeze([
  "user_requested_erasure",
  "account_closure_request",
  "data_minimisation_request"
]);

export const GDPR_DELETE_ALLOWED_RETAINED_RECORD_TYPES = Object.freeze([
  "audit_record",
  "proof_record",
  "legal_retention_record",
  "billing_record",
  "engine_truth_record"
]);

export const GDPR_DELETE_ALLOWED_RETENTION_REASONS = Object.freeze([
  "audit_integrity_review_required",
  "proof_integrity_review_required",
  "legal_retention_review_required",
  "billing_retention_review_required",
  "engine_truth_immutability_boundary"
]);

export const GDPR_DELETE_QUEUE_COPY_IDS = Object.freeze([
  "gdpr_delete_queue.request_queued",
  "gdpr_delete_queue.blocked",
  "gdpr_delete_queue.own_data_only",
  "gdpr_delete_queue.retention_review_required",
  "gdpr_delete_queue.no_engine_change"
]);

export const GDPR_DELETE_QUEUE_BOUNDARY = Object.freeze({
  legal_request_queue_only: true,
  request_recorded: true,
  permission_scoped: true,
  own_user_data_only: true,
  retention_review_required: true,
  hard_delete_performed: false,
  proof_or_audit_records_hard_deleted: false,
  engine_truth_changed: false,
  retroactive_engine_mutation: false,
  provider_call_performed: false,
  coaching_correctness_claim: false,
  training_value_claim: false
});

const allowedInputKeySet = new Set(GDPR_DELETE_ALLOWED_INPUT_KEYS);
const allowedRequestTypeSet = new Set(GDPR_DELETE_ALLOWED_REQUEST_TYPES);
const allowedActorTypeSet = new Set(GDPR_DELETE_ALLOWED_ACTOR_TYPES);
const allowedScopeSet = new Set(GDPR_DELETE_ALLOWED_SCOPES);
const allowedReasonCodeSet = new Set(GDPR_DELETE_ALLOWED_REASON_CODES);
const allowedRetainedRecordTypeSet = new Set(GDPR_DELETE_ALLOWED_RETAINED_RECORD_TYPES);
const allowedRetentionReasonSet = new Set(GDPR_DELETE_ALLOWED_RETENTION_REASONS);

const blockedPayloadKeySet = new Set([
  "audit_records_deleted",
  "delete_audit_records",
  "delete_engine_truth",
  "delete_proof_records",
  "delete_runtime_events",
  "deleted_engine_truth",
  "engine_truth_changed",
  "erase_now",
  "hard_delete",
  "hard_deleted_at",
  "hard_delete_performed",
  "purge",
  "proof_records_deleted",
  "retroactive_engine_mutation",
  "runtime_events_deleted"
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

export function stableGdprDeleteQueueJson(value) {
  return JSON.stringify(stableValue(value));
}

export function hashGdprDeleteQueueValue(value) {
  return createHash("sha256")
    .update(stableGdprDeleteQueueJson(value))
    .digest("hex");
}

function errorResult(code, details = {}) {
  return stableValue({
    ok: false,
    surface_id: GDPR_DELETE_QUEUE_SURFACE_ID,
    version: S_V1_L_03_GDPR_DELETE_QUEUE_VERSION,
    code,
    details,
    copy_id: "gdpr_delete_queue.blocked",
    request_recorded: false,
    hard_delete_performed: false,
    proof_or_audit_records_hard_deleted: false,
    engine_visible: false,
    engine_truth_changed: false,
    retroactive_engine_mutation: false,
    product_permission_state_only: true
  });
}

function assertStringField(input, field) {
  if (typeof input[field] !== "string" || input[field].trim() === "") {
    return errorResult("gdpr_delete_required_string_missing", { field });
  }

  return null;
}

function findUnknownInputKey(input) {
  for (const key of Object.keys(input)) {
    if (!allowedInputKeySet.has(key)) {
      return key;
    }
  }

  return null;
}

export function findBlockedDeletePayloadKey(value, path = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const result = findBlockedDeletePayloadKey(value[index], path + "[" + index + "]");
      if (result !== null) {
        return result;
      }
    }

    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of Object.keys(value)) {
    if (blockedPayloadKeySet.has(key)) {
      return { key, path: path + "." + key };
    }

    const nested = findBlockedDeletePayloadKey(value[key], path + "." + key);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

function normaliseNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

function readSubjectOwner(record) {
  for (const key of subjectOwnershipKeys) {
    if (typeof record[key] === "string" && record[key].trim() !== "") {
      return record[key];
    }
  }

  return null;
}

function assertRetentionRecordBelongsToSubject(record, targetUserId, index) {
  const owner = readSubjectOwner(record);

  if (owner !== null && owner !== targetUserId) {
    return errorResult("gdpr_delete_retention_record_permission_denied", {
      index,
      owner_user_id: owner,
      target_user_id: targetUserId
    });
  }

  return null;
}

function normaliseRetentionRecord(record, index, targetUserId) {
  if (!isPlainObject(record)) {
    return errorResult("gdpr_delete_retention_record_invalid", { index });
  }

  const blocked = findBlockedDeletePayloadKey(record, "$.retention_records[" + index + "]");
  if (blocked !== null) {
    return errorResult("gdpr_delete_blocked_payload_key", blocked);
  }

  const recordId = normaliseNullableString(record.record_id);
  if (recordId === null || recordId.trim() === "") {
    return errorResult("gdpr_delete_retention_record_id_required", { index });
  }

  const recordType = normaliseNullableString(record.record_type);
  if (recordType === null || !allowedRetainedRecordTypeSet.has(recordType)) {
    return errorResult("gdpr_delete_retention_record_type_not_allowed", {
      index,
      record_type: recordType
    });
  }

  const retentionReason = normaliseNullableString(record.retention_reason);
  if (retentionReason === null || !allowedRetentionReasonSet.has(retentionReason)) {
    return errorResult("gdpr_delete_retention_reason_not_allowed", {
      index,
      retention_reason: retentionReason
    });
  }

  const ownerResult = assertRetentionRecordBelongsToSubject(record, targetUserId, index);
  if (ownerResult !== null) {
    return ownerResult;
  }

  return {
    ok: true,
    record: stableValue({
      record_id: recordId,
      record_type: recordType,
      subject_user_id: readSubjectOwner(record) ?? targetUserId,
      retention_reason: retentionReason,
      retained_pending_review: true,
      hard_delete_performed: false,
      review_status: "retention_review_required"
    })
  };
}

function normaliseRetentionRecords(records, targetUserId) {
  if (records === undefined) {
    return { ok: true, records: [] };
  }

  if (!Array.isArray(records)) {
    return errorResult("gdpr_delete_retention_records_array_required");
  }

  const output = [];

  for (let index = 0; index < records.length; index += 1) {
    const normalised = normaliseRetentionRecord(records[index], index, targetUserId);
    if (normalised.ok !== true) {
      return normalised;
    }

    output.push(normalised.record);
  }

  output.sort((left, right) => {
    const leftKey = left.record_type + ":" + left.record_id;
    const rightKey = right.record_type + ":" + right.record_id;
    return leftKey.localeCompare(rightKey);
  });

  return { ok: true, records: output };
}

function buildQueuePayload(input, retentionRecords) {
  const deterministicProbeHash =
    input.deterministic_probe === undefined ? null : hashGdprDeleteQueueValue(input.deterministic_probe);

  return stableValue({
    surface_id: GDPR_DELETE_QUEUE_SURFACE_ID,
    version: S_V1_L_03_GDPR_DELETE_QUEUE_VERSION,
    request: {
      request_id: input.request_id,
      actor_user_id: input.actor_user_id,
      actor_type: input.actor_type,
      target_user_id: input.target_user_id,
      requested_action: input.requested_action,
      requested_scope: input.requested_scope,
      requested_at: input.requested_at,
      reason_code: input.reason_code
    },
    permission: {
      permission_scoped: true,
      permission_scope: "own_user_data_only",
      actor_matches_target: true
    },
    queue: {
      queue_status: "queued_for_review",
      deletion_execution_status: "not_performed",
      retention_review_status: "required",
      hard_delete_performed: false
    },
    retention_boundary: {
      retention_records_review_required: retentionRecords.length,
      retained_record_count: retentionRecords.length,
      proof_or_audit_records_hard_deleted: false,
      legal_review_required_before_any_action: true
    },
    boundary: GDPR_DELETE_QUEUE_BOUNDARY,
    retained_records: retentionRecords,
    deterministic_probe_hash: deterministicProbeHash,
    request_recorded: true,
    hard_delete_performed: false,
    proof_or_audit_records_hard_deleted: false,
    engine_visible: false,
    engine_truth_changed: false,
    retroactive_engine_mutation: false,
    provider_call_performed: false,
    copy_ids: GDPR_DELETE_QUEUE_COPY_IDS
  });
}

export function createGdprDeleteQueueRequest(input) {
  if (!isPlainObject(input)) {
    return errorResult("gdpr_delete_input_object_required");
  }

  const unknownKey = findUnknownInputKey(input);
  if (unknownKey !== null) {
    return errorResult("gdpr_delete_unknown_input_key", { key: unknownKey });
  }

  const blockedKey = findBlockedDeletePayloadKey(input);
  if (blockedKey !== null) {
    return errorResult("gdpr_delete_blocked_payload_key", blockedKey);
  }

  for (const field of [
    "request_id",
    "actor_user_id",
    "actor_type",
    "target_user_id",
    "requested_action",
    "requested_scope",
    "requested_at",
    "reason_code"
  ]) {
    const missing = assertStringField(input, field);
    if (missing !== null) {
      return missing;
    }
  }

  if (!allowedActorTypeSet.has(input.actor_type)) {
    return errorResult("gdpr_delete_actor_type_not_allowed", {
      actor_type: input.actor_type
    });
  }

  if (!allowedRequestTypeSet.has(input.requested_action)) {
    return errorResult("gdpr_delete_action_not_allowed", {
      requested_action: input.requested_action
    });
  }

  if (!allowedScopeSet.has(input.requested_scope)) {
    return errorResult("gdpr_delete_scope_not_allowed", {
      requested_scope: input.requested_scope
    });
  }

  if (!allowedReasonCodeSet.has(input.reason_code)) {
    return errorResult("gdpr_delete_reason_code_not_allowed", {
      reason_code: input.reason_code
    });
  }

  if (input.actor_user_id !== input.target_user_id) {
    return errorResult("gdpr_delete_permission_denied", {
      permission_scope: "own_user_data_only",
      actor_user_id: input.actor_user_id,
      target_user_id: input.target_user_id
    });
  }

  const retained = normaliseRetentionRecords(input.retention_records, input.target_user_id);
  if (retained.ok !== true) {
    return retained;
  }

  const queuePayload = buildQueuePayload(input, retained.records);
  const requestHash = hashGdprDeleteQueueValue(queuePayload);

  return stableValue({
    ok: true,
    queue_id: "gdpr_delete_queue_" + requestHash.slice(0, 16),
    queue_status: "queued_for_review",
    request_hash: requestHash,
    copy_id: "gdpr_delete_queue.request_queued",
    copy_notice_id: "gdpr_delete_queue.no_engine_change",
    ...queuePayload
  });
}

export function assertGdprDeleteQueueRequest(input) {
  const result = createGdprDeleteQueueRequest(input);

  if (result.ok !== true) {
    const error = new Error(result.code);
    error.code = result.code;
    error.details = result.details;
    throw error;
  }

  return result;
}

export function serializeGdprDeleteQueueRequest(input) {
  return stableGdprDeleteQueueJson(createGdprDeleteQueueRequest(input));
}