
// DEV NOTE: Org-owner self-service GDPR data export and deletion-request.
// Mirrors data_rights_service.ts's own shape exactly - assembles the caller's
// OWN already-persisted data and hands it to the existing, sealed S-V1-L-02
// export boundary (src/v1GdprExportHandling.mjs) and S-V1-L-03 delete queue
// (src/v1GdprDeleteQueue.mjs) contracts, now widened (by explicit choice) to
// accept "org_owner" as a third allowed actor type. Persists into its own
// org_owner_data_export_requests/org_owner_data_deletion_requests tables
// (FK'd to product_org_owner_accounts, not product_accounts - an org owner
// is never a row there) rather than the athlete/coach tables. Never performs
// a hard delete, never mutates deterministic engine truth, never cascades
// into the org(s) this owner owns.

import crypto from "node:crypto";
import { pool } from "../db/pool.js";
// @ts-ignore - .mjs source, no type declarations
import { createGdprExportHandling } from "../v1GdprExportHandling.mjs";
// @ts-ignore - .mjs source, no type declarations
import { createGdprDeleteQueueRequest } from "../v1GdprDeleteQueue.mjs";
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

// Identical to data_rights_service.ts's own tagOwnedRecord - duplicated
// locally rather than imported, matching this codebase's established
// per-file duplication convention for small shared shapes (see
// org_coach_messaging_service.ts's own DEV NOTE on this exact point).
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

async function resolveOrgOwnerAccountRow(userId: string): Promise<JsonRecord | null> {
  const result = await pool.query(
    `SELECT user_id, email_canonical, display_name, account_state, created_at, updated_at
     FROM product_org_owner_accounts
     WHERE user_id = $1`,
    [userId]
  );
  return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
}

async function loadOrganisationsOwned(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT org_id, owner_user_id, org_name, org_state, seat_limit, visibility_mode, created_at, updated_at
     FROM product_organisations
     WHERE owner_user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    org_id: row.org_id,
    owner_user_id: row.owner_user_id,
    org_name: row.org_name,
    org_state: row.org_state,
    seat_limit: row.seat_limit,
    visibility_mode: row.visibility_mode,
    created_at_iso8601: isoString(row.created_at),
    updated_at_iso8601: isoString(row.updated_at)
  }));
}

async function loadOrgCoachMemberships(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT m.membership_id, m.org_id, m.coach_user_id, m.membership_status,
            m.invited_at, m.activated_at, m.removed_at, m.created_at
     FROM product_org_coach_memberships m
     JOIN product_organisations o ON o.org_id = m.org_id
     WHERE o.owner_user_id = $1
     ORDER BY m.created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    membership_id: row.membership_id,
    org_id: row.org_id,
    coach_user_id: row.coach_user_id,
    membership_status: row.membership_status,
    invited_at_iso8601: isoString(row.invited_at),
    activated_at_iso8601: isoString(row.activated_at),
    removed_at_iso8601: isoString(row.removed_at),
    created_at_iso8601: isoString(row.created_at)
  }));
}

async function loadOrgMessagesSent(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT message_id, thread_id, body_text, client_request_id, created_at
     FROM product_messages
     WHERE sender_user_id = $1 AND sender_role = 'org_owner'
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    message_id: row.message_id,
    thread_id: row.thread_id,
    body_text: row.body_text,
    client_request_id: row.client_request_id,
    created_at_iso8601: isoString(row.created_at)
  }));
}

async function loadOrgAuditRecords(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT audit_record_id, org_id, actor_user_id, actor_role, action_type,
            before_state, after_state, correlation_id, created_at
     FROM product_org_audit_records
     WHERE actor_user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    audit_record_id: row.audit_record_id,
    org_id: row.org_id,
    actor_user_id: row.actor_user_id,
    actor_role: row.actor_role,
    action_type: row.action_type,
    before_state: isRecord(row.before_state) ? row.before_state : {},
    after_state: isRecord(row.after_state) ? row.after_state : {},
    correlation_id: row.correlation_id,
    created_at_iso8601: isoString(row.created_at)
  }));
}

async function assembleOrgOwnerDataSources(userId: string): Promise<{ dataSources: JsonRecord; categoryPreviewCounts: JsonRecord }> {
  const accountRow = await resolveOrgOwnerAccountRow(userId);
  if (!accountRow) {
    throw notFound("Account not found", { failure_token: "org_owner_data_rights_account_not_found" });
  }

  const [organisationsOwned, orgCoachMemberships, orgMessagesSent, orgAuditRecords] = await Promise.all([
    loadOrganisationsOwned(userId),
    loadOrgCoachMemberships(userId),
    loadOrgMessagesSent(userId),
    loadOrgAuditRecords(userId)
  ]);

  const account = [tagOwnedRecord({
    user_id: accountRow.user_id,
    email: accountRow.email_canonical,
    display_name: accountRow.display_name,
    account_state: accountRow.account_state,
    created_at_iso8601: isoString(accountRow.created_at),
    updated_at_iso8601: isoString(accountRow.updated_at)
  }, userId)];

  const dataSources = {
    account,
    organisations_owned: organisationsOwned.map((r) => tagOwnedRecord(r, userId)),
    org_coach_memberships: orgCoachMemberships.map((r) => tagOwnedRecord(r, userId)),
    org_messages_sent: orgMessagesSent.map((r) => tagOwnedRecord(r, userId)),
    org_audit_records: orgAuditRecords.map((r) => tagOwnedRecord(r, userId))
  };

  const categoryPreviewCounts = Object.fromEntries(
    Object.entries(dataSources).map(([category, records]) => [category, records.length])
  );

  return { dataSources, categoryPreviewCounts };
}

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

export async function requestOrgOwnerDataExport(userId: string): Promise<JsonRecord> {
  const { dataSources, categoryPreviewCounts } = await assembleOrgOwnerDataSources(userId);

  const exportRequestId = `org_owner_export_request_${crypto.randomUUID().replaceAll("-", "")}`;
  const requestedAt = new Date();

  await pool.query(
    `INSERT INTO org_owner_data_export_requests (export_request_id, user_id, status, requested_at)
     VALUES ($1, $2, 'pending', $3)`,
    [exportRequestId, userId, requestedAt.toISOString()]
  );

  const exportResult = createGdprExportHandling({
    request_id: exportRequestId,
    actor_user_id: userId,
    actor_type: "org_owner",
    target_user_id: userId,
    requested_export_type: "subject_data_access_json",
    requested_at: requestedAt.toISOString(),
    data_sources: dataSources
  }) as JsonRecord;

  if (exportResult.ok !== true) {
    await pool.query(
      `UPDATE org_owner_data_export_requests SET status = 'failed' WHERE export_request_id = $1`,
      [exportRequestId]
    );
    throw forbidden("Export request rejected by the export boundary", {
      failure_token: "org_owner_data_rights_export_boundary_rejected",
      cause: exportResult.code
    });
  }

  const readyAt = new Date();
  const expiresAt = new Date(readyAt.getTime() + EXPORT_TTL_MS);

  await pool.query(
    `UPDATE org_owner_data_export_requests
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

export async function getOrgOwnerDataExportStatus(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT export_request_id, status, requested_at, ready_at, expires_at,
            included_category_counts, downloaded_at
     FROM org_owner_data_export_requests
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

export async function downloadOrgOwnerDataExport(userId: string, exportRequestId: string): Promise<JsonRecord> {
  const result = await pool.query(
    `SELECT export_request_id, user_id, status, export_payload, expires_at
     FROM org_owner_data_export_requests
     WHERE export_request_id = $1`,
    [exportRequestId]
  );

  const row = result.rows?.[0];
  if (!row || cleanString(row.user_id) !== userId) {
    throw notFound("Export not found", { failure_token: "org_owner_data_rights_export_not_found" });
  }

  if (row.status !== "ready") {
    throw conflict("Export is not ready for download", { failure_token: "org_owner_data_rights_export_not_ready" });
  }

  if (row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()) {
    await pool.query(`UPDATE org_owner_data_export_requests SET status = 'expired' WHERE export_request_id = $1`, [exportRequestId]);
    throw gone("Export download has expired", { failure_token: "org_owner_data_rights_export_expired" });
  }

  await pool.query(
    `UPDATE org_owner_data_export_requests SET downloaded_at = now() WHERE export_request_id = $1`,
    [exportRequestId]
  );

  return isRecord(row.export_payload) ? row.export_payload : {};
}

// Unlike the athlete/coach precedent's four retained categories
// (session/runtime/billing/legal), only this owner's own audit trail is
// retained here - everything else in the org-owner data footprint (their
// account, the orgs/memberships/messages they own) carries no audit,
// engine-truth, billing or legal-retention significance of its own.
async function buildOrgOwnerRetentionRecords(userId: string): Promise<JsonRecord[]> {
  const auditRecords = await loadOrgAuditRecords(userId);

  return auditRecords.map((record) => ({
    record_id: String(record.audit_record_id),
    record_type: "audit_record",
    retention_reason: "audit_integrity_review_required",
    user_id: userId
  }));
}

const RETENTION_REASON_COPY: Record<string, string> = {
  audit_integrity_review_required: "Organisation audit records (invites, membership changes, seat-plan changes) are kept for audit integrity review before any deletion decision."
};

function buildOrgOwnerRetentionCopy(retainedRecords: JsonRecord[]): JsonRecord {
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
      "Account, organisation, coach-membership and message records not listed above can be queued for deletion review. " +
      "Organisation audit records above are retained pending review and are not deleted immediately."
  };
}

export async function previewOrgOwnerDataDeletion(userId: string): Promise<JsonRecord> {
  const retainedRecords = await buildOrgOwnerRetentionRecords(userId);
  return buildOrgOwnerRetentionCopy(retainedRecords);
}

export async function confirmOrgOwnerDataDeletion(
  userId: string,
  confirmation: unknown,
  reasonCodeInput: unknown,
  clientRequestId: string
): Promise<JsonRecord> {
  if (cleanString(confirmation) !== "DELETE") {
    throw badRequest("Type DELETE to confirm this request", {
      failure_token: "org_owner_data_rights_deletion_confirmation_required"
    });
  }

  const reasonCode = cleanString(reasonCodeInput) || "user_requested_erasure";

  const existing = await pool.query(
    `SELECT deletion_request_id, reason_code, queue_status, request_hash, retained_records, retention_boundary, requested_at
     FROM org_owner_data_deletion_requests
     WHERE user_id = $1 AND client_request_id = $2`,
    [userId, clientRequestId]
  );

  if ((existing.rowCount ?? 0) > 0) {
    const row = existing.rows[0];
    if (cleanString(row.reason_code) !== reasonCode) {
      throw conflict("client_request_id reused for a different deletion reason", {
        failure_token: "org_owner_data_rights_deletion_request_id_conflict"
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

  const retentionRecords = await buildOrgOwnerRetentionRecords(userId);
  const requestedAt = new Date().toISOString();

  const queueResult = createGdprDeleteQueueRequest({
    request_id: `org_owner_deletion_request_${crypto.randomUUID().replaceAll("-", "")}`,
    actor_user_id: userId,
    actor_type: "org_owner",
    target_user_id: userId,
    requested_action: "subject_erasure_request",
    requested_scope: "own_user_data",
    requested_at: requestedAt,
    reason_code: reasonCode,
    retention_records: retentionRecords
  }) as JsonRecord;

  if (queueResult.ok !== true) {
    throw forbidden("Deletion request rejected by the delete queue boundary", {
      failure_token: "org_owner_data_rights_deletion_boundary_rejected",
      cause: queueResult.code
    });
  }

  const deletionRequestId = `org_owner_deletion_request_${crypto.randomUUID().replaceAll("-", "")}`;

  await pool.query(
    `INSERT INTO org_owner_data_deletion_requests (
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
     FROM org_owner_data_deletion_requests
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

export async function getOrgOwnerDataDeletionStatus(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT deletion_request_id, reason_code, queue_status, retained_records, retention_boundary, requested_at
     FROM org_owner_data_deletion_requests
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
