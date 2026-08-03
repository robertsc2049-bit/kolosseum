// DEV NOTE: FULL-UI-21 founder/admin read-only review surfaces. Every
// function here is a read against already-existing product tables
// (product_accounts, product_commercial_records, product_support_requests,
// data_export_requests, data_deletion_requests) - none of them ever touch
// blocks, sessions, runtime_events, or any engine/compile table, and none
// of them ever mutate anything. Review and mutation are deliberately kept
// in separate files.

import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return null;
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function billingAccessStateFromPayload(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const record = payload.billing_access_record;
  if (!isRecord(record)) return null;
  return cleanString(record.billing_access_state) || null;
}

export async function searchAdminAccounts(
  queryValue: unknown
): Promise<readonly Readonly<JsonRecord>[]> {
  const query = cleanString(queryValue);

  const result = await pool.query(
    query
      ? `
        SELECT user_id, email_canonical, display_name, actor_type, account_state, created_at
        FROM product_accounts
        WHERE user_id ILIKE $1 OR email_canonical ILIKE $1 OR display_name ILIKE $1
        ORDER BY created_at DESC
        LIMIT 100
        `
      : `
        SELECT user_id, email_canonical, display_name, actor_type, account_state, created_at
        FROM product_accounts
        ORDER BY created_at DESC
        LIMIT 100
        `,
    query ? [`%${query}%`] : []
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        user_id: cleanString(row.user_id),
        email: cleanString(row.email_canonical),
        display_name: cleanString(row.display_name),
        actor_type: cleanString(row.actor_type),
        account_state: cleanString(row.account_state),
        created_at_iso8601: toIso(row.created_at)
      })
    )
  );
}

export async function getAdminAccountDetail(
  userId: string
): Promise<Readonly<JsonRecord> | null> {
  const accountResult = await pool.query(
    `SELECT * FROM product_accounts WHERE user_id = $1`,
    [userId]
  );
  const row = accountResult.rows[0];
  if (!row) return null;

  const [eventsResult, testAccountResult] = await Promise.all([
    pool.query(
      `SELECT event_id, event_type, occurred_at FROM product_account_events WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 50`,
      [userId]
    ),
    pool.query(
      `SELECT marked_by_admin_user_id, reason, created_at FROM product_test_accounts WHERE user_id = $1`,
      [userId]
    )
  ]);

  return Object.freeze({
    user_id: cleanString(row.user_id),
    email: cleanString(row.email_canonical),
    display_name: cleanString(row.display_name),
    actor_type: cleanString(row.actor_type),
    account_state: cleanString(row.account_state),
    email_verified: row.email_verified_at !== null,
    created_at_iso8601: toIso(row.created_at),
    is_test_account: testAccountResult.rows.length > 0,
    test_account_marked_at_iso8601: toIso(testAccountResult.rows[0]?.created_at) ?? null,
    events: Object.freeze(
      eventsResult.rows.map((event) =>
        Object.freeze({
          event_id: cleanString(event.event_id),
          event_type: cleanString(event.event_type),
          occurred_at_iso8601: toIso(event.occurred_at)
        })
      )
    )
  });
}

export async function listAdminCommercialRecords(
  filterUserId: unknown
): Promise<readonly Readonly<JsonRecord>[]> {
  const userId = cleanString(filterUserId);

  const result = await pool.query(
    userId
      ? `
        SELECT commercial_record_id, user_id, record_type, effective_at, record_payload
        FROM product_commercial_records
        WHERE user_id = $1
        ORDER BY effective_at DESC
        LIMIT 200
        `
      : `
        SELECT commercial_record_id, user_id, record_type, effective_at, record_payload
        FROM product_commercial_records
        ORDER BY effective_at DESC
        LIMIT 200
        `,
    userId ? [userId] : []
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        commercial_record_id: cleanString(row.commercial_record_id),
        user_id: cleanString(row.user_id),
        record_type: cleanString(row.record_type),
        effective_at_iso8601: toIso(row.effective_at),
        billing_access_state: billingAccessStateFromPayload(row.record_payload)
      })
    )
  );
}

export async function listAdminSupportRequests(
  statusFilterValue: unknown
): Promise<readonly Readonly<JsonRecord>[]> {
  const statusFilter = cleanString(statusFilterValue);

  const result = await pool.query(
    statusFilter
      ? `
        SELECT correlation_id, user_id, route_hash, description, status, occurred_at, created_at
        FROM product_support_requests
        WHERE status = $1
        ORDER BY created_at DESC
        LIMIT 200
        `
      : `
        SELECT correlation_id, user_id, route_hash, description, status, occurred_at, created_at
        FROM product_support_requests
        ORDER BY created_at DESC
        LIMIT 200
        `,
    statusFilter ? [statusFilter] : []
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        correlation_id: cleanString(row.correlation_id),
        user_id: cleanString(row.user_id),
        route_hash: cleanString(row.route_hash),
        description: cleanString(row.description),
        status: cleanString(row.status),
        occurred_at_iso8601: toIso(row.occurred_at),
        created_at_iso8601: toIso(row.created_at)
      })
    )
  );
}

export async function listAdminDataExportRequests(
  filterUserId: unknown
): Promise<readonly Readonly<JsonRecord>[]> {
  const userId = cleanString(filterUserId);

  const result = await pool.query(
    userId
      ? `
        SELECT export_request_id, user_id, status, requested_at, ready_at, expires_at, downloaded_at
        FROM data_export_requests
        WHERE user_id = $1
        ORDER BY requested_at DESC
        LIMIT 200
        `
      : `
        SELECT export_request_id, user_id, status, requested_at, ready_at, expires_at, downloaded_at
        FROM data_export_requests
        ORDER BY requested_at DESC
        LIMIT 200
        `,
    userId ? [userId] : []
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        export_request_id: cleanString(row.export_request_id),
        user_id: cleanString(row.user_id),
        status: cleanString(row.status),
        requested_at_iso8601: toIso(row.requested_at),
        ready_at_iso8601: toIso(row.ready_at),
        expires_at_iso8601: toIso(row.expires_at),
        downloaded_at_iso8601: toIso(row.downloaded_at)
      })
    )
  );
}

export async function listAdminDataDeletionRequests(
  filterUserId: unknown
): Promise<readonly Readonly<JsonRecord>[]> {
  const userId = cleanString(filterUserId);

  const result = await pool.query(
    userId
      ? `
        SELECT deletion_request_id, user_id, reason_code, queue_status, requested_at
        FROM data_deletion_requests
        WHERE user_id = $1
        ORDER BY requested_at DESC
        LIMIT 200
        `
      : `
        SELECT deletion_request_id, user_id, reason_code, queue_status, requested_at
        FROM data_deletion_requests
        ORDER BY requested_at DESC
        LIMIT 200
        `,
    userId ? [userId] : []
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        deletion_request_id: cleanString(row.deletion_request_id),
        user_id: cleanString(row.user_id),
        reason_code: cleanString(row.reason_code),
        queue_status: cleanString(row.queue_status),
        requested_at_iso8601: toIso(row.requested_at)
      })
    )
  );
}

export async function listAdminAuditRecords(
  targetUserIdValue: unknown
): Promise<readonly Readonly<JsonRecord>[]> {
  const targetUserId = cleanString(targetUserIdValue);

  const result = await pool.query(
    targetUserId
      ? `
        SELECT audit_record_id, actor_user_id, action_type, target_record_type, target_record_id,
               before_state, after_state, correlation_id, created_at
        FROM product_admin_audit_records
        WHERE target_record_id = $1
        ORDER BY created_at DESC
        LIMIT 200
        `
      : `
        SELECT audit_record_id, actor_user_id, action_type, target_record_type, target_record_id,
               before_state, after_state, correlation_id, created_at
        FROM product_admin_audit_records
        ORDER BY created_at DESC
        LIMIT 200
        `,
    targetUserId ? [targetUserId] : []
  );

  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        audit_record_id: cleanString(row.audit_record_id),
        actor_user_id: cleanString(row.actor_user_id),
        action_type: cleanString(row.action_type),
        target_record_type: cleanString(row.target_record_type),
        target_record_id: cleanString(row.target_record_id),
        before_state: row.before_state,
        after_state: row.after_state,
        correlation_id: cleanString(row.correlation_id),
        created_at_iso8601: toIso(row.created_at)
      })
    )
  );
}
