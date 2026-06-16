import { createHash } from "node:crypto";

export const S_V1_47_EXPORT_BOUNDARY_VERSION = "S-V1-47";

export const EXPORT_ALLOWED_TYPES = Object.freeze([
  "proof_artefact_json",
  "evidence_envelope_json"
]);

export const EXPORT_ALLOWED_SCOPES = Object.freeze([
  "single_proof_artefact"
]);

export const EXPORT_BLOCKED_TYPES = Object.freeze([
  "bulk_data_export",
  "entity_export",
  "credential_export",
  "external_endorsement_export",
  "raw_runtime_events_export",
  "coach_notes_export",
  "mutable_export"
]);

export const EXPORT_REASON_CODES = Object.freeze({
  ALLOWED: "export_allowed",
  REQUEST_REQUIRED: "export_request_required",
  REQUESTED_AT_REQUIRED: "export_requested_at_required",
  TYPE_NOT_PERMITTED: "export_type_not_permitted",
  SCOPE_NOT_PERMITTED: "export_scope_not_permitted",
  SOURCE_REQUIRED: "export_source_required",
  SOURCE_VIEW_NOT_PERMITTED: "export_source_view_not_permitted",
  SOURCE_ENVELOPE_REQUIRED: "export_source_envelope_required",
  SOURCE_ENVELOPE_NOT_ACCEPTED: "export_source_envelope_not_accepted",
  SOURCE_ENVELOPE_NOT_IMMUTABLE: "export_source_envelope_not_immutable",
  SOURCE_HASH_REQUIRED: "export_source_hash_required",
  PAYLOAD_BOUNDARY_VIOLATION: "export_payload_boundary_violation"
});

const BLOCKED_PAYLOAD_KEYS = Object.freeze([
  "all_athletes",
  "all_sessions",
  "entity_roster",
  "team_roster",
  "unit_roster",
  "coach_notes",
  "raw_runtime_events",
  "credential",
  "external_endorsement",
  "judgement",
  "outcome_status"
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((entry) => canonicalJson(entry)).join(",") + "]";
  }

  return "{" + Object.keys(value).sort().map((key) => {
    return JSON.stringify(key) + ":" + canonicalJson(value[key]);
  }).join(",") + "}";
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return value;
  }

  Object.freeze(value);

  for (const key of Object.keys(value)) {
    const next = value[key];
    if ((isPlainObject(next) || Array.isArray(next)) && !Object.isFrozen(next)) {
      deepFreeze(next);
    }
  }

  return value;
}

function normaliseReplayVerdict(value) {
  if (value === "ACCEPTED" || value === "accepted") {
    return "accepted";
  }

  if (value === "REJECTED" || value === "rejected") {
    return "rejected";
  }

  return String(value ?? "");
}

function readEnvelopeHash(envelope) {
  return envelope.envelope_hash_sha256 ??
    envelope.envelope_checksum_sha256 ??
    envelope.checksum_sha256 ??
    envelope.artefact_hash_sha256 ??
    null;
}

function readEnvelopeFromProofArtefact(proofArtefact) {
  return proofArtefact.evidence_envelope ??
    proofArtefact.evidenceEnvelope ??
    proofArtefact.source_evidence_envelope ??
    null;
}

function sourceViewIsPermitted(proofArtefact) {
  return proofArtefact.view_status === "view_allowed" ||
    proofArtefact.permission_verdict === "allowed" ||
    proofArtefact.access_status === "allowed";
}

function sourceIsImmutable(envelope) {
  return envelope.immutable === true ||
    envelope.sealed === true ||
    envelope.immutability === "immutable";
}

function blocked(reasonCode, detail = {}) {
  return deepFreeze({
    ok: false,
    status: "export_blocked",
    reason_code: reasonCode,
    detail
  });
}

function assertNoBlockedPayloadKeys(value, path = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertNoBlockedPayloadKeys(value[index], path + "[" + index + "]");
    }
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (BLOCKED_PAYLOAD_KEYS.includes(key)) {
      throw new Error(EXPORT_REASON_CODES.PAYLOAD_BOUNDARY_VIOLATION + ":" + path + "." + key);
    }
    assertNoBlockedPayloadKeys(value[key], path + "." + key);
  }
}

/**
 * DEV NOTE: Export boundary contract.
 * This function is a proof-layer read model over an existing proof artefact and
 * evidence envelope. It never reads engine state, coach notes, runtime UI state,
 * entity rosters, payment state, or broad data surfaces. It creates a deterministic
 * single-artefact export object only when the source proof artefact is already
 * permission-scoped and the source envelope is immutable.
 */
export function createV1ExportBoundary(request) {
  if (!isPlainObject(request)) {
    return blocked(EXPORT_REASON_CODES.REQUEST_REQUIRED);
  }

  const requestedExportType = request.requested_export_type;
  const requestedScope = request.requested_scope;
  const requestedAt = request.requested_at;
  const requesterId = request.requester_id;
  const proofArtefact = request.proof_artefact;

  if (typeof requestedAt !== "string" || requestedAt.length === 0) {
    return blocked(EXPORT_REASON_CODES.REQUESTED_AT_REQUIRED);
  }

  if (!EXPORT_ALLOWED_TYPES.includes(requestedExportType) || EXPORT_BLOCKED_TYPES.includes(requestedExportType)) {
    return blocked(EXPORT_REASON_CODES.TYPE_NOT_PERMITTED, {
      requested_export_type: requestedExportType ?? null
    });
  }

  if (!EXPORT_ALLOWED_SCOPES.includes(requestedScope)) {
    return blocked(EXPORT_REASON_CODES.SCOPE_NOT_PERMITTED, {
      requested_scope: requestedScope ?? null
    });
  }

  if (!isPlainObject(proofArtefact)) {
    return blocked(EXPORT_REASON_CODES.SOURCE_REQUIRED);
  }

  if (!sourceViewIsPermitted(proofArtefact)) {
    return blocked(EXPORT_REASON_CODES.SOURCE_VIEW_NOT_PERMITTED);
  }

  const envelope = readEnvelopeFromProofArtefact(proofArtefact);
  if (!isPlainObject(envelope)) {
    return blocked(EXPORT_REASON_CODES.SOURCE_ENVELOPE_REQUIRED);
  }

  if (normaliseReplayVerdict(envelope.replay_verdict) !== "accepted") {
    return blocked(EXPORT_REASON_CODES.SOURCE_ENVELOPE_NOT_ACCEPTED, {
      replay_verdict: envelope.replay_verdict ?? null
    });
  }

  if (!sourceIsImmutable(envelope)) {
    return blocked(EXPORT_REASON_CODES.SOURCE_ENVELOPE_NOT_IMMUTABLE);
  }

  const envelopeHash = readEnvelopeHash(envelope);
  if (typeof envelope.envelope_id !== "string" || envelope.envelope_id.length === 0 || typeof envelopeHash !== "string" || envelopeHash.length === 0) {
    return blocked(EXPORT_REASON_CODES.SOURCE_HASH_REQUIRED);
  }

  const proofArtefactId = proofArtefact.proof_artefact_id ??
    proofArtefact.artefact_id ??
    null;

  const exportPayload = {
    proof_artefact_id: proofArtefactId,
    evidence_envelope_id: envelope.envelope_id,
    evidence_envelope_hash_sha256: envelopeHash,
    replay_verdict: "accepted",
    export_scope: requestedScope,
    export_type: requestedExportType,
    requested_by: requesterId ?? null,
    requested_at: requestedAt,
    copy_notice_id: "export_boundary.neutral_notice"
  };

  assertNoBlockedPayloadKeys(exportPayload);

  const exportHash = sha256Hex(canonicalJson(exportPayload));

  return deepFreeze({
    ok: true,
    status: "export_allowed",
    reason_code: EXPORT_REASON_CODES.ALLOWED,
    export_id: "s_v1_47_export_" + exportHash.slice(0, 24),
    export_format: "application/json",
    immutable: true,
    payload_hash_sha256: exportHash,
    payload: exportPayload,
    boundary: {
      release_slice: S_V1_47_EXPORT_BOUNDARY_VERSION,
      source_scope: "permission_scoped_proof_artefact",
      mutation: "not_permitted",
      broad_export: "not_permitted",
      entity_export: "not_permitted",
      coach_notes_surface: "not_included",
      runtime_events_surface: "not_included"
    }
  });
}

export function serializeV1Export(exportResult) {
  if (!isPlainObject(exportResult) || exportResult.ok !== true) {
    return JSON.stringify(exportResult);
  }

  return canonicalJson(exportResult);
}

export function assertV1ExportBoundary(exportResult) {
  if (!isPlainObject(exportResult) || exportResult.ok !== true) {
    return exportResult;
  }

  assertNoBlockedPayloadKeys(exportResult);
  return exportResult;
}