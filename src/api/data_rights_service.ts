
// DEV NOTE: FULL-UI-19 self-service data rights and consent.
// This module assembles the caller's OWN already-persisted data and hands it
// to the existing, sealed S-V1-L-02 export boundary (src/v1GdprExportHandling.mjs)
// and S-V1-L-03 delete queue (src/v1GdprDeleteQueue.mjs) contracts, unmodified.
// It never widens either contract's allow-lists, never performs a hard delete,
// and never mutates deterministic engine truth. This is the COMPLETE personal
// data export/deletion surface - distinct from and broader than the narrower
// Athlete History export (session/runtime/assignment history only), which it
// deliberately leaves untouched.

import crypto from "node:crypto";
import { pool } from "../db/pool.js";
// @ts-ignore - .mjs source, no type declarations
import { createGdprExportHandling } from "../v1GdprExportHandling.mjs";
// @ts-ignore - .mjs source, no type declarations
import { createGdprDeleteQueueRequest } from "../v1GdprDeleteQueue.mjs";
import { loadEnrichedAthleteSessions } from "./athlete_history_service.js";
import { ApiError, badRequest, conflict, forbidden, notFound } from "./http_errors.js";

type JsonRecord = Record<string, unknown>;

function gone(message: string, details?: unknown): ApiError {
  return new ApiError({ status: 410, code: "GONE", message, details });
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isoString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  const text = cleanString(value);
  return text || null;
}

const OWNERSHIP_KEYS = ["user_id", "owner_user_id", "subject_user_id", "athlete_user_id", "coach_user_id", "customer_user_id"];

// Every allowed data category in the export boundary is checked for ANY of
// the fixed ownership-key field names, and rejects the whole record if one is
// present with a value other than the caller's own id - so a relationship or
// assignment record naming a counterparty (e.g. the other side's
// coach_user_id) must never carry that counterparty id at the top level.
// Nesting every such key under `parties` keeps the fact auditable without
// tripping the boundary's own ownership check.
function tagOwnedRecord(record: JsonRecord, targetUserId: string): JsonRecord {
  const parties: JsonRecord = {};
  const rest: JsonRecord = {};

  for (const [key, value] of Object.entries(record)) {
    if (OWNERSHIP_KEYS.includes(key)) {
      parties[key] = value;
    }
    else {
      rest[key] = value;
    }
  }

  return { user_id: targetUserId, parties, ...rest };
}

async function resolveAccountRow(userId: string): Promise<JsonRecord | null> {
  const result = await pool.query(
    `SELECT user_id, email_canonical, display_name, actor_type, account_state,
            accepted_terms_version, accepted_consent_version, created_at, updated_at
     FROM product_accounts
     WHERE user_id = $1`,
    [userId]
  );
  return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
}

async function loadBetaProductRecordsByType(
  userId: string,
  recordType: string,
  matchActorToo = false
): Promise<JsonRecord[]> {
  const result = await pool.query(
    matchActorToo
      ? `SELECT record_payload FROM beta_product_records
         WHERE record_type = $1 AND (subject_user_id = $2 OR actor_user_id = $2)
         ORDER BY effective_at ASC, created_at ASC`
      : `SELECT record_payload FROM beta_product_records
         WHERE record_type = $1 AND subject_user_id = $2
         ORDER BY effective_at ASC, created_at ASC`,
    [recordType, userId]
  );

  return result.rows
    .map((row) => row.record_payload)
    .filter((payload): payload is JsonRecord => isRecord(payload));
}

async function loadCoachNotesAuthored(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT note_id, coach_user_id, athlete_user_id, relationship_id, session_id,
            artefact_id, visibility, created_at
     FROM product_coach_notes
     WHERE coach_user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );

  return result.rows.map((row) => ({
    note_id: row.note_id,
    coach_user_id: row.coach_user_id,
    athlete_user_id: row.athlete_user_id,
    relationship_id: row.relationship_id,
    session_id: row.session_id,
    artefact_id: row.artefact_id,
    visibility: row.visibility,
    created_at_iso8601: isoString(row.created_at)
  }));
}

async function loadCommercialRecords(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT commercial_record_id, user_id, request_id, record_type, effective_at, record_payload
     FROM product_commercial_records
     WHERE user_id = $1
     ORDER BY effective_at ASC`,
    [userId]
  );

  return result.rows.map((row) => ({
    commercial_record_id: row.commercial_record_id,
    user_id: row.user_id,
    request_id: row.request_id,
    record_type: row.record_type,
    effective_at_iso8601: isoString(row.effective_at),
    record_payload: row.record_payload
  }));
}

async function loadRuntimeEventRecords(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT re.session_id, re.seq, re.event, re.created_at
     FROM runtime_events re
     JOIN sessions s ON s.session_id = re.session_id
     WHERE s.beta_subject_user_id = $1
     ORDER BY re.session_id ASC, re.seq ASC`,
    [userId]
  );

  return result.rows.map((row) => ({
    session_id: row.session_id,
    seq: Number(row.seq),
    event: isRecord(row.event) ? row.event : {},
    created_at_iso8601: isoString(row.created_at)
  }));
}

async function assembleDataSources(userId: string): Promise<{ dataSources: JsonRecord; categoryPreviewCounts: JsonRecord }> {
  const accountRow = await resolveAccountRow(userId);
  if (!accountRow) {
    throw notFound("Account not found", { failure_token: "data_rights_account_not_found" });
  }

  const [
    phase1Declarations,
    acknowledgements,
    relationships,
    assignments,
    sessions,
    runtimeEvents,
    coachNotes,
    commercialRecords,
    progressPhotos,
    bodyMetrics,
    habitDefinitions,
    habitCompletions,
    deviceConnections,
    deviceMetricEntries,
    athleteGoals
  ] = await Promise.all([
    loadBetaProductRecordsByType(userId, "beta16_phase1_declaration"),
    loadBetaProductRecordsByType(userId, "beta16_acknowledgement"),
    loadBetaProductRecordsByType(userId, "beta17_coach_relationship", true),
    loadBetaProductRecordsByType(userId, "beta17_assignment_trigger", true),
    loadEnrichedAthleteSessions(userId),
    loadRuntimeEventRecords(userId),
    loadCoachNotesAuthored(userId),
    loadCommercialRecords(userId),
    loadBetaProductRecordsByType(userId, "beta_progress_photo"),
    loadBetaProductRecordsByType(userId, "body_metric_entry"),
    loadBetaProductRecordsByType(userId, "habit_definition"),
    loadBetaProductRecordsByType(userId, "habit_completion"),
    loadBetaProductRecordsByType(userId, "device_connection_record"),
    loadBetaProductRecordsByType(userId, "device_metric_entry"),
    loadBetaProductRecordsByType(userId, "athlete_goal")
  ]);

  const account = [tagOwnedRecord({
    user_id: accountRow.user_id,
    email: accountRow.email_canonical,
    display_name: accountRow.display_name,
    actor_type: accountRow.actor_type,
    account_state: accountRow.account_state,
    accepted_terms_version: accountRow.accepted_terms_version,
    accepted_consent_version: accountRow.accepted_consent_version,
    created_at_iso8601: isoString(accountRow.created_at),
    updated_at_iso8601: isoString(accountRow.updated_at)
  }, userId)];

  const dataSources = {
    account,
    phase1_declarations: phase1Declarations.map((r) => tagOwnedRecord(r, userId)),
    relationships: relationships.map((r) => tagOwnedRecord(r, userId)),
    programme_assignments: assignments.map((r) => tagOwnedRecord(r, userId)),
    session_records: sessions.map((r) => tagOwnedRecord(r as unknown as JsonRecord, userId)),
    runtime_events: runtimeEvents.map((r) => tagOwnedRecord(r, userId)),
    coach_notes_authored: coachNotes.map((r) => tagOwnedRecord(r, userId)),
    legal_document_acknowledgements: acknowledgements.map((r) => tagOwnedRecord(r, userId)),
    billing_records: commercialRecords.map((r) => tagOwnedRecord(r, userId)),
    progress_photos: progressPhotos.map((r) => tagOwnedRecord(r, userId)),
    body_metrics: bodyMetrics.map((r) => tagOwnedRecord(r, userId)),
    habit_definitions: habitDefinitions.map((r) => tagOwnedRecord(r, userId)),
    habit_completions: habitCompletions.map((r) => tagOwnedRecord(r, userId)),
    device_connections: deviceConnections.map((r) => tagOwnedRecord(r, userId)),
    device_metric_entries: deviceMetricEntries.map((r) => tagOwnedRecord(r, userId)),
    athlete_goals: athleteGoals.map((r) => tagOwnedRecord(r, userId))
  };

  const categoryPreviewCounts = Object.fromEntries(
    Object.entries(dataSources).map(([category, records]) => [category, records.length])
  );

  return { dataSources, categoryPreviewCounts };
}

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * FUNCTION NOTE:
 * Purpose: Assembles the caller's complete personal-data export across every
 * category the S-V1-L-02 export boundary allows, then hands it unmodified to
 * that sealed contract for permission-scoped, hash-sealed serialization.
 * Boundary: Read-only aside from persisting the resulting artefact record;
 * never mutates engine truth or the account itself.
 * Determinism: Categories are always assembled and ordered the same way; the
 * export boundary's own stable serialization makes the payload byte-stable
 * for identical underlying data.
 * Failure: An unknown account fails closed; a boundary rejection is
 * persisted as a failed request rather than silently dropped.
 */
export async function requestDataExport(userId: string): Promise<JsonRecord> {
  const { dataSources, categoryPreviewCounts } = await assembleDataSources(userId);

  const exportRequestId = `export_request_${crypto.randomUUID().replaceAll("-", "")}`;
  const requestedAt = new Date();

  await pool.query(
    `INSERT INTO data_export_requests (export_request_id, user_id, status, requested_at)
     VALUES ($1, $2, 'pending', $3)`,
    [exportRequestId, userId, requestedAt.toISOString()]
  );

  const exportResult = createGdprExportHandling({
    request_id: exportRequestId,
    actor_user_id: userId,
    actor_type: "athlete",
    target_user_id: userId,
    requested_export_type: "subject_data_access_json",
    requested_at: requestedAt.toISOString(),
    data_sources: dataSources
  }) as JsonRecord;

  if (exportResult.ok !== true) {
    await pool.query(
      `UPDATE data_export_requests SET status = 'failed' WHERE export_request_id = $1`,
      [exportRequestId]
    );
    throw forbidden("Export request rejected by the export boundary", {
      failure_token: "data_rights_export_boundary_rejected",
      cause: exportResult.code
    });
  }

  const readyAt = new Date();
  const expiresAt = new Date(readyAt.getTime() + EXPORT_TTL_MS);

  await pool.query(
    `UPDATE data_export_requests
     SET status = 'ready', ready_at = $2, expires_at = $3,
         export_payload = $4::jsonb, export_payload_hash = $5,
         included_category_counts = $6::jsonb
     WHERE export_request_id = $1`,
    [
      exportRequestId,
      readyAt.toISOString(),
      expiresAt.toISOString(),
      JSON.stringify(exportResult),
      cleanString(exportResult.export_payload_hash),
      JSON.stringify(categoryPreviewCounts)
    ]
  );

  return {
    export_request_id: exportRequestId,
    status: "ready",
    requested_at_iso8601: requestedAt.toISOString(),
    ready_at_iso8601: readyAt.toISOString(),
    expires_at_iso8601: expiresAt.toISOString(),
    included_category_counts: categoryPreviewCounts
  };
}

function classifyExportStatus(row: JsonRecord): string {
  const status = cleanString(row.status);
  if (status === "ready" && row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()) {
    return "expired";
  }
  return status || "pending";
}

/**
 * FUNCTION NOTE:
 * Purpose: Lists the caller's own export requests, newest first, with a
 * lawful expiry-aware status.
 * Boundary: Read-only; scoped by the authenticated caller's own user id only.
 */
export async function getDataExportStatus(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT export_request_id, status, requested_at, ready_at, expires_at,
            included_category_counts, downloaded_at
     FROM data_export_requests
     WHERE user_id = $1
     ORDER BY requested_at DESC
     LIMIT 20`,
    [userId]
  );

  return result.rows.map((row) => ({
    export_request_id: row.export_request_id,
    status: classifyExportStatus(row),
    requested_at_iso8601: isoString(row.requested_at),
    ready_at_iso8601: isoString(row.ready_at),
    expires_at_iso8601: isoString(row.expires_at),
    included_category_counts: row.included_category_counts ?? null,
    downloaded_at_iso8601: isoString(row.downloaded_at)
  }));
}

/**
 * FUNCTION NOTE:
 * Purpose: Returns the sealed export payload for download, re-checking
 * ownership, readiness and expiry at the moment of download - never at
 * request time only.
 * Boundary: Access controlled by the authenticated caller's own user id;
 * rejects another user's export outright rather than distinguishing
 * "not found" from "not yours" in the response.
 * Failure: Missing, foreign, not-yet-ready or expired requests all fail
 * closed with a specific, factual reason.
 */
export async function downloadDataExport(userId: string, exportRequestId: string): Promise<JsonRecord> {
  const result = await pool.query(
    `SELECT export_request_id, user_id, status, export_payload, expires_at
     FROM data_export_requests
     WHERE export_request_id = $1`,
    [exportRequestId]
  );

  const row = result.rows?.[0];
  if (!row || cleanString(row.user_id) !== userId) {
    throw notFound("Export not found", { failure_token: "data_rights_export_not_found" });
  }

  if (row.status !== "ready") {
    throw conflict("Export is not ready for download", { failure_token: "data_rights_export_not_ready" });
  }

  if (row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()) {
    await pool.query(`UPDATE data_export_requests SET status = 'expired' WHERE export_request_id = $1`, [exportRequestId]);
    throw gone("Export download has expired", { failure_token: "data_rights_export_expired" });
  }

  await pool.query(
    `UPDATE data_export_requests SET downloaded_at = now() WHERE export_request_id = $1`,
    [exportRequestId]
  );

  return isRecord(row.export_payload) ? row.export_payload : {};
}

const RETENTION_REASON_BY_CATEGORY: Record<string, string> = {
  session_records: "audit_integrity_review_required",
  runtime_events: "engine_truth_immutability_boundary",
  billing_records: "billing_retention_review_required",
  legal_document_acknowledgements: "legal_retention_review_required"
};

const RETAINED_RECORD_TYPE_BY_CATEGORY: Record<string, string> = {
  session_records: "audit_record",
  runtime_events: "engine_truth_record",
  billing_records: "billing_record",
  legal_document_acknowledgements: "legal_retention_record"
};

async function buildRetentionRecords(userId: string): Promise<JsonRecord[]> {
  const [sessions, commercialRecords, acknowledgements] = await Promise.all([
    loadEnrichedAthleteSessions(userId),
    loadCommercialRecords(userId),
    loadBetaProductRecordsByType(userId, "beta16_acknowledgement")
  ]);

  const retentionRecords: JsonRecord[] = [];

  for (const session of sessions) {
    retentionRecords.push({
      record_id: session.session_id,
      record_type: RETAINED_RECORD_TYPE_BY_CATEGORY.session_records,
      retention_reason: RETENTION_REASON_BY_CATEGORY.session_records,
      user_id: userId
    });
    retentionRecords.push({
      record_id: `${session.session_id}_runtime_events`,
      record_type: RETAINED_RECORD_TYPE_BY_CATEGORY.runtime_events,
      retention_reason: RETENTION_REASON_BY_CATEGORY.runtime_events,
      user_id: userId
    });
  }

  for (const record of commercialRecords) {
    retentionRecords.push({
      record_id: String(record.commercial_record_id),
      record_type: RETAINED_RECORD_TYPE_BY_CATEGORY.billing_records,
      retention_reason: RETENTION_REASON_BY_CATEGORY.billing_records,
      user_id: userId
    });
  }

  for (const record of acknowledgements) {
    const acknowledgementId = cleanString((record as JsonRecord).acknowledgement_id) || crypto.randomUUID();
    retentionRecords.push({
      record_id: acknowledgementId,
      record_type: RETAINED_RECORD_TYPE_BY_CATEGORY.legal_document_acknowledgements,
      retention_reason: RETENTION_REASON_BY_CATEGORY.legal_document_acknowledgements,
      user_id: userId
    });
  }

  return retentionRecords;
}

const RETENTION_REASON_COPY: Record<string, string> = {
  audit_integrity_review_required: "Session and training records are kept for audit integrity review before any deletion decision.",
  engine_truth_immutability_boundary: "Recorded runtime events are immutable engine history and cannot be deleted; they can only be reviewed for retention.",
  billing_retention_review_required: "Billing records are kept pending legal and financial retention review.",
  legal_retention_review_required: "Terms and consent acknowledgement records are kept pending legal retention review."
};

function buildRetentionCopy(retainedRecords: JsonRecord[]): JsonRecord {
  const countsByReason = new Map<string, number>();
  for (const record of retainedRecords) {
    const reason = cleanString(record.retention_reason);
    countsByReason.set(reason, (countsByReason.get(reason) ?? 0) + 1);
  }

  return {
    retained_record_count: retainedRecords.length,
    retention_notices: [...countsByReason.entries()].map(([reason, count]) => ({
      retention_reason: reason,
      record_count: count,
      copy: RETENTION_REASON_COPY[reason] ?? "This record category is kept pending retention review."
    })),
    factual_notice:
      "Account profile, relationship and assignment records not listed above can be queued for deletion review. " +
      "Session, runtime, billing and legal-acknowledgement records above are retained pending review and are not deleted immediately."
  };
}

/**
 * FUNCTION NOTE:
 * Purpose: Shows what a deletion request would retain and why, without
 * persisting anything - a pure read-only preview so the confirmation step
 * can present a genuine consequence review beforehand.
 * Boundary: Read-only; never queues a request or performs any deletion.
 */
export async function previewDataDeletion(userId: string): Promise<JsonRecord> {
  const retainedRecords = await buildRetentionRecords(userId);
  return buildRetentionCopy(retainedRecords);
}

/**
 * FUNCTION NOTE:
 * Purpose: Records an explicit, confirmed deletion (erasure) request into the
 * existing S-V1-L-03 GDPR delete queue contract, persisting the resulting
 * queued-for-review state. A repeated client_request_id for the same user
 * replays the original result instead of creating a second queue entry.
 * Boundary: Never performs a hard delete; the delete queue contract itself
 * asserts this and this function never overrides it.
 * Failure: A missing/incorrect explicit confirmation, or a reused
 * client_request_id paired with a different reason, fails closed.
 */
export async function confirmDataDeletion(
  userId: string,
  actorType: "athlete" | "coach",
  confirmation: unknown,
  reasonCodeInput: unknown,
  clientRequestId: string
): Promise<JsonRecord> {
  if (cleanString(confirmation) !== "DELETE") {
    throw badRequest("Type DELETE to confirm this request", {
      failure_token: "data_rights_deletion_confirmation_required"
    });
  }

  const reasonCode = cleanString(reasonCodeInput) || "user_requested_erasure";

  const existing = await pool.query(
    `SELECT deletion_request_id, reason_code, queue_status, request_hash, retained_records, retention_boundary, requested_at
     FROM data_deletion_requests
     WHERE user_id = $1 AND client_request_id = $2`,
    [userId, clientRequestId]
  );

  if ((existing.rowCount ?? 0) > 0) {
    const row = existing.rows[0];
    if (cleanString(row.reason_code) !== reasonCode) {
      throw conflict("client_request_id reused for a different deletion reason", {
        failure_token: "data_rights_deletion_request_id_conflict"
      });
    }

    return {
      deletion_request_id: row.deletion_request_id,
      queue_status: row.queue_status,
      reason_code: row.reason_code,
      retained_records: row.retained_records,
      retention_boundary: row.retention_boundary,
      requested_at_iso8601: isoString(row.requested_at),
      replayed: true
    };
  }

  const retentionRecords = await buildRetentionRecords(userId);
  const requestedAt = new Date().toISOString();

  const queueResult = createGdprDeleteQueueRequest({
    request_id: `deletion_request_${crypto.randomUUID().replaceAll("-", "")}`,
    actor_user_id: userId,
    actor_type: actorType,
    target_user_id: userId,
    requested_action: "subject_erasure_request",
    requested_scope: "own_user_data",
    requested_at: requestedAt,
    reason_code: reasonCode,
    retention_records: retentionRecords
  }) as JsonRecord;

  if (queueResult.ok !== true) {
    throw forbidden("Deletion request rejected by the delete queue boundary", {
      failure_token: "data_rights_deletion_boundary_rejected",
      cause: queueResult.code
    });
  }

  const deletionRequestId = `deletion_request_${crypto.randomUUID().replaceAll("-", "")}`;

  await pool.query(
    `INSERT INTO data_deletion_requests (
      deletion_request_id, user_id, reason_code, queue_status, request_hash,
      retained_records, retention_boundary, client_request_id, requested_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
    ON CONFLICT (user_id, client_request_id) DO NOTHING`,
    [
      deletionRequestId,
      userId,
      reasonCode,
      cleanString(queueResult.queue_status) || "queued_for_review",
      cleanString(queueResult.request_hash),
      JSON.stringify(queueResult.retained_records ?? []),
      JSON.stringify(queueResult.retention_boundary ?? {}),
      clientRequestId,
      requestedAt
    ]
  );

  const stored = await pool.query(
    `SELECT deletion_request_id, reason_code, queue_status, retained_records, retention_boundary, requested_at
     FROM data_deletion_requests
     WHERE user_id = $1 AND client_request_id = $2`,
    [userId, clientRequestId]
  );

  const row = stored.rows[0];

  return {
    deletion_request_id: row.deletion_request_id,
    queue_status: row.queue_status,
    reason_code: row.reason_code,
    retained_records: row.retained_records,
    retention_boundary: row.retention_boundary,
    requested_at_iso8601: isoString(row.requested_at),
    replayed: false
  };
}

/**
 * FUNCTION NOTE:
 * Purpose: Lists the caller's own deletion requests, newest first.
 * Boundary: Read-only; scoped by the authenticated caller's own user id only.
 */
export async function getDataDeletionStatus(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT deletion_request_id, reason_code, queue_status, retained_records, retention_boundary, requested_at
     FROM data_deletion_requests
     WHERE user_id = $1
     ORDER BY requested_at DESC
     LIMIT 20`,
    [userId]
  );

  return result.rows.map((row) => ({
    deletion_request_id: row.deletion_request_id,
    reason_code: row.reason_code,
    queue_status: row.queue_status,
    retained_records: row.retained_records,
    retention_boundary: row.retention_boundary,
    requested_at_iso8601: isoString(row.requested_at)
  }));
}
