// DEV NOTE: FULL-UI-21 founder/admin confirmed operational actions. Every
// mutation in this file runs inside one transaction together with its own
// immutable audit record, so a mutation can never exist without a matching
// audit row. A repeated correlation_id from the same admin replays the
// original audit record (and does not repeat the mutation) rather than
// creating a second one - the same idempotent-submission discipline used
// by data_deletion_requests/session_event_requests. Every target table
// here is account/support/test-marker state - never blocks, sessions,
// runtime_events, or any other engine/compile table.

import crypto from "node:crypto";

import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;

export class AdminActionError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminActionError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalJson(value: unknown): string {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortKeys);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.keys(input as JsonRecord)
          .sort()
          .map((key) => [key, sortKeys((input as JsonRecord)[key])])
      );
    }
    return input;
  };
  return JSON.stringify(sortKeys(value));
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}

type AuditOutcome = Readonly<{
  audit_record_id: string;
  action_type: string;
  target_record_type: string;
  target_record_id: string;
  before_state: JsonRecord;
  after_state: JsonRecord;
  correlation_id: string;
  idempotent_replay: boolean;
}>;

async function findExistingAudit(
  client: PoolClient,
  adminUserId: string,
  correlationId: string
): Promise<JsonRecord | null> {
  const result = await client.query(
    `SELECT * FROM product_admin_audit_records WHERE actor_user_id = $1 AND correlation_id = $2`,
    [adminUserId, correlationId]
  );
  return result.rows[0] ?? null;
}

function toAuditOutcome(row: JsonRecord, replayed: boolean): AuditOutcome {
  return Object.freeze({
    audit_record_id: cleanString(row.audit_record_id),
    action_type: cleanString(row.action_type),
    target_record_type: cleanString(row.target_record_type),
    target_record_id: cleanString(row.target_record_id),
    before_state: row.before_state as JsonRecord,
    after_state: row.after_state as JsonRecord,
    correlation_id: cleanString(row.correlation_id),
    idempotent_replay: replayed
  });
}

async function writeAuditRecord(
  client: PoolClient,
  args: {
    adminUserId: string;
    correlationId: string;
    actionType: string;
    targetRecordType: string;
    targetRecordId: string;
    beforeState: JsonRecord;
    afterState: JsonRecord;
  }
): Promise<AuditOutcome> {
  const withoutHash = {
    action_type: args.actionType,
    target_record_type: args.targetRecordType,
    target_record_id: args.targetRecordId,
    before_state: args.beforeState,
    after_state: args.afterState,
    correlation_id: args.correlationId
  };
  const recordSha256 = sha256(canonicalJson(withoutHash));
  const auditRecordId = randomId("admin_audit");

  const inserted = await client.query(
    `
    INSERT INTO product_admin_audit_records (
      audit_record_id, actor_user_id, action_type, target_record_type, target_record_id,
      before_state, after_state, correlation_id, record_sha256
    )
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
    RETURNING *
    `,
    [
      auditRecordId,
      args.adminUserId,
      args.actionType,
      args.targetRecordType,
      args.targetRecordId,
      JSON.stringify(args.beforeState),
      JSON.stringify(args.afterState),
      args.correlationId,
      recordSha256
    ]
  );

  return toAuditOutcome(inserted.rows[0], false);
}

async function withAdminTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

const ADMIN_ACCOUNT_STATES = new Set(["active", "suspended"]);

export async function changeAccountState(
  adminUserId: string,
  correlationId: string,
  targetUserId: string,
  newState: string
): Promise<AuditOutcome> {
  const cleanCorrelationId = cleanString(correlationId);
  const cleanTargetUserId = cleanString(targetUserId);
  const cleanState = cleanString(newState);

  if (!cleanCorrelationId || !cleanTargetUserId) {
    throw new AdminActionError("admin_action_identity_required", 400);
  }
  // Deliberately closed to active/suspended only. An account moving to
  // closed/deleted must go through the existing sealed GDPR deletion
  // queue, not this lever - admin review/action here never bypasses that
  // contract.
  if (!ADMIN_ACCOUNT_STATES.has(cleanState)) {
    throw new AdminActionError("admin_account_state_invalid", 400);
  }

  return withAdminTransaction(async (client) => {
    const existingAudit = await findExistingAudit(client, adminUserId, cleanCorrelationId);
    if (existingAudit) return toAuditOutcome(existingAudit, true);

    const current = await client.query(
      `SELECT user_id, account_state FROM product_accounts WHERE user_id = $1 FOR UPDATE`,
      [cleanTargetUserId]
    );
    if (!current.rows[0]) {
      throw new AdminActionError("admin_account_not_found", 404);
    }

    const beforeState = { account_state: cleanString(current.rows[0].account_state) };

    await client.query(
      `UPDATE product_accounts SET account_state = $2 WHERE user_id = $1`,
      [cleanTargetUserId, cleanState]
    );

    const afterState = { account_state: cleanState };

    return writeAuditRecord(client, {
      adminUserId,
      correlationId: cleanCorrelationId,
      actionType: "account_state_change",
      targetRecordType: "product_accounts",
      targetRecordId: cleanTargetUserId,
      beforeState,
      afterState
    });
  });
}

export async function setTestAccountMarking(
  adminUserId: string,
  correlationId: string,
  targetUserId: string,
  marked: boolean,
  reasonValue: unknown
): Promise<AuditOutcome> {
  const cleanCorrelationId = cleanString(correlationId);
  const cleanTargetUserId = cleanString(targetUserId);
  const reason = cleanString(reasonValue).slice(0, 500) || null;

  if (!cleanCorrelationId || !cleanTargetUserId) {
    throw new AdminActionError("admin_action_identity_required", 400);
  }

  return withAdminTransaction(async (client) => {
    const existingAudit = await findExistingAudit(client, adminUserId, cleanCorrelationId);
    if (existingAudit) return toAuditOutcome(existingAudit, true);

    const account = await client.query(
      `SELECT user_id FROM product_accounts WHERE user_id = $1`,
      [cleanTargetUserId]
    );
    if (!account.rows[0]) {
      throw new AdminActionError("admin_account_not_found", 404);
    }

    const before = await client.query(
      `SELECT user_id FROM product_test_accounts WHERE user_id = $1`,
      [cleanTargetUserId]
    );
    const beforeState = { is_test_account: before.rows.length > 0 };

    if (marked) {
      await client.query(
        `
        INSERT INTO product_test_accounts (user_id, marked_by_admin_user_id, reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET marked_by_admin_user_id = $2, reason = $3
        `,
        [cleanTargetUserId, adminUserId, reason]
      );
    }
    else {
      await client.query(`DELETE FROM product_test_accounts WHERE user_id = $1`, [cleanTargetUserId]);
    }

    const afterState = { is_test_account: marked };

    return writeAuditRecord(client, {
      adminUserId,
      correlationId: cleanCorrelationId,
      actionType: marked ? "test_account_marked" : "test_account_unmarked",
      targetRecordType: "product_accounts",
      targetRecordId: cleanTargetUserId,
      beforeState,
      afterState
    });
  });
}

const SUPPORT_REQUEST_STATES = new Set(["submitted", "acknowledged", "closed"]);

export async function changeSupportRequestStatus(
  adminUserId: string,
  correlationId: string,
  targetCorrelationId: string,
  newStatus: string
): Promise<AuditOutcome> {
  const cleanCorrelationId = cleanString(correlationId);
  const cleanTargetCorrelationId = cleanString(targetCorrelationId);
  const cleanStatus = cleanString(newStatus);

  if (!cleanCorrelationId || !cleanTargetCorrelationId) {
    throw new AdminActionError("admin_action_identity_required", 400);
  }
  if (!SUPPORT_REQUEST_STATES.has(cleanStatus)) {
    throw new AdminActionError("admin_support_status_invalid", 400);
  }

  return withAdminTransaction(async (client) => {
    const existingAudit = await findExistingAudit(client, adminUserId, cleanCorrelationId);
    if (existingAudit) return toAuditOutcome(existingAudit, true);

    const current = await client.query(
      `SELECT correlation_id, status FROM product_support_requests WHERE correlation_id = $1 FOR UPDATE`,
      [cleanTargetCorrelationId]
    );
    if (!current.rows[0]) {
      throw new AdminActionError("admin_support_request_not_found", 404);
    }

    const beforeState = { status: cleanString(current.rows[0].status) };

    await client.query(
      `UPDATE product_support_requests SET status = $2 WHERE correlation_id = $1`,
      [cleanTargetCorrelationId, cleanStatus]
    );

    const afterState = { status: cleanStatus };

    return writeAuditRecord(client, {
      adminUserId,
      correlationId: cleanCorrelationId,
      actionType: "support_request_status_change",
      targetRecordType: "product_support_requests",
      targetRecordId: cleanTargetCorrelationId,
      beforeState,
      afterState
    });
  });
}
