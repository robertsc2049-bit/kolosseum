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
import {
  type ErasureCounts,
  type OrgHandoverChoice,
  OrgHandoverChoiceError,
  eraseOrgOwnerData,
  eraseUserData,
  eraseUserFiles,
  orgOwnerErasurePlan
} from "./gdpr_erasure_service.js";
import { createCoachProfileForAccount } from "./product_account_service.js";

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

// Give an athlete account the coach role as well - same login, same user id,
// the athlete side kept (one login can be both: product_account_service
// addAccountRole). The coach profile a coach sign-up creates is added; the
// account switches between the two in the app. Recorded as an
// account_state_change (the audit CHECK has no separate type, as with the
// org-owner variant below) with the roles before and after.
export async function addCoachRoleToAccount(
  adminUserId: string,
  correlationId: string,
  targetUserId: string
): Promise<AuditOutcome> {
  const cleanCorrelationId = cleanString(correlationId);
  const cleanTargetUserId = cleanString(targetUserId);
  if (!cleanCorrelationId || !cleanTargetUserId) {
    throw new AdminActionError("admin_action_identity_required", 400);
  }

  let added: { email: string; name: string } | null = null;
  const outcome = await withAdminTransaction(async (client) => {
    const existingAudit = await findExistingAudit(client, adminUserId, cleanCorrelationId);
    if (existingAudit) return toAuditOutcome(existingAudit, true);

    const current = await client.query(
      `SELECT user_id, actor_type, additional_role, email_canonical, display_name FROM product_accounts WHERE user_id = $1 FOR UPDATE`,
      [cleanTargetUserId]
    );
    const row = current.rows[0];
    if (!row) throw new AdminActionError("admin_account_not_found", 404);
    if (cleanString(row.actor_type) === "coach" || cleanString(row.additional_role) === "coach") {
      throw new AdminActionError("admin_account_already_coach", 409);
    }

    await client.query(`UPDATE product_accounts SET additional_role = 'coach', updated_at = now() WHERE user_id = $1`, [cleanTargetUserId]);
    added = { email: cleanString(row.email_canonical), name: cleanString(row.display_name) };

    return writeAuditRecord(client, {
      adminUserId,
      correlationId: cleanCorrelationId,
      actionType: "account_state_change",
      targetRecordType: "product_accounts",
      targetRecordId: cleanTargetUserId,
      beforeState: { roles: [cleanString(row.actor_type)] },
      afterState: { roles: [cleanString(row.actor_type), "coach"] }
    });
  });
  // The coach profile, once the role is there (idempotent: a replay or a
  // profile already there changes nothing).
  const withRole = added as { email: string; name: string } | null;
  if (withRole) await createCoachProfileForAccount(cleanTargetUserId, withRole.email, withRole.name);
  return outcome;
}

// DEV NOTE: FULL-UI-80 - mirrors changeAccountState exactly, targeting
// product_org_owner_accounts instead of product_accounts. Deliberately
// reuses the existing "account_state_change" action_type (target_record_type
// is what distinguishes it) rather than adding a new enum value, since
// product_admin_audit_records.action_type's CHECK constraint would
// otherwise need a schema migration for no real benefit.
export async function changeOrgOwnerAccountState(
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
  // Deliberately closed to active/suspended only, matching
  // changeAccountState's own reasoning - an org owner's account moving to
  // closed must go through their own sealed self-service closure flow
  // (requestOrgOwnerAccountClosure), never this lever.
  if (!ADMIN_ACCOUNT_STATES.has(cleanState)) {
    throw new AdminActionError("admin_account_state_invalid", 400);
  }

  return withAdminTransaction(async (client) => {
    const existingAudit = await findExistingAudit(client, adminUserId, cleanCorrelationId);
    if (existingAudit) return toAuditOutcome(existingAudit, true);

    const current = await client.query(
      `SELECT user_id, account_state FROM product_org_owner_accounts WHERE user_id = $1 FOR UPDATE`,
      [cleanTargetUserId]
    );
    if (!current.rows[0]) {
      throw new AdminActionError("admin_account_not_found", 404);
    }

    const beforeState = { account_state: cleanString(current.rows[0].account_state) };

    await client.query(
      `UPDATE product_org_owner_accounts SET account_state = $2 WHERE user_id = $1`,
      [cleanTargetUserId, cleanState]
    );

    const afterState = { account_state: cleanState };

    return writeAuditRecord(client, {
      adminUserId,
      correlationId: cleanCorrelationId,
      actionType: "account_state_change",
      targetRecordType: "product_org_owner_accounts",
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
      `SELECT user_id, reason FROM product_test_accounts WHERE user_id = $1`,
      [cleanTargetUserId]
    );
    const beforeState = {
      is_test_account: before.rows.length > 0,
      reason: cleanString(before.rows[0]?.reason) || null
    };

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

    const afterState = { is_test_account: marked, reason: marked ? reason : null };

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

// Forward-only lifecycle - a closed ticket is terminal (matches the admin
// UI, which stops offering Acknowledge/Close once they no longer apply),
// and acknowledging never regresses status backward to submitted.
const SUPPORT_REQUEST_ALLOWED_TRANSITIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  submitted: new Set(["acknowledged", "closed"]),
  acknowledged: new Set(["closed"]),
  closed: new Set()
};

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

    const currentStatus = cleanString(current.rows[0].status);
    if (!SUPPORT_REQUEST_ALLOWED_TRANSITIONS[currentStatus]?.has(cleanStatus)) {
      throw new AdminActionError("admin_support_status_transition_invalid", 409);
    }

    const beforeState = { status: currentStatus };

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

// FULL-UI-95 org-owner support parity - mirrors changeSupportRequestStatus
// exactly, targeting org_owner_support_requests instead.
export async function changeOrgOwnerSupportRequestStatus(
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
      `SELECT correlation_id, status FROM org_owner_support_requests WHERE correlation_id = $1 FOR UPDATE`,
      [cleanTargetCorrelationId]
    );
    if (!current.rows[0]) {
      throw new AdminActionError("admin_support_request_not_found", 404);
    }

    const currentStatus = cleanString(current.rows[0].status);
    if (!SUPPORT_REQUEST_ALLOWED_TRANSITIONS[currentStatus]?.has(cleanStatus)) {
      throw new AdminActionError("admin_support_status_transition_invalid", 409);
    }

    const beforeState = { status: currentStatus };

    await client.query(
      `UPDATE org_owner_support_requests SET status = $2 WHERE correlation_id = $1`,
      [cleanTargetCorrelationId, cleanStatus]
    );

    const afterState = { status: cleanStatus };

    return writeAuditRecord(client, {
      adminUserId,
      correlationId: cleanCorrelationId,
      actionType: "org_owner_support_request_status_change",
      targetRecordType: "org_owner_support_requests",
      targetRecordId: cleanTargetCorrelationId,
      beforeState,
      afterState
    });
  });
}

// GDPR erasure: carry out a queued athlete/coach deletion request after the
// admin has reviewed it (gdpr_erasure_service.ts says exactly what is deleted
// and kept). One transaction: the person's data is deleted, the account left
// as a tombstone, every open deletion request of theirs completed, and an
// audit record written - then their files are removed. Repeating the same
// correlation id replays the audit; an already-erased request is refused.
export async function eraseAccountForDeletionRequest(
  adminUserId: string,
  correlationId: string,
  deletionRequestId: string
): Promise<AuditOutcome & Readonly<{ files_removed?: ErasureCounts }>> {
  const cleanCorrelationId = cleanString(correlationId);
  const cleanRequestId = cleanString(deletionRequestId);
  if (!cleanCorrelationId || !cleanRequestId) {
    throw new AdminActionError("admin_action_identity_required", 400);
  }

  let files: Awaited<ReturnType<typeof eraseUserData>>["files"] | null = null;
  const outcome = await withAdminTransaction(async (client) => {
    const existingAudit = await findExistingAudit(client, adminUserId, cleanCorrelationId);
    if (existingAudit) return toAuditOutcome(existingAudit, true);

    const request = await client.query(
      `SELECT deletion_request_id, user_id, queue_status FROM data_deletion_requests WHERE deletion_request_id = $1 FOR UPDATE`,
      [cleanRequestId]
    );
    const row = request.rows[0];
    if (!row) throw new AdminActionError("admin_deletion_request_not_found", 404);
    if (cleanString(row.queue_status) === "completed") throw new AdminActionError("admin_deletion_request_already_erased", 409);
    const userId = cleanString(row.user_id);

    const account = await client.query(`SELECT actor_type, account_state FROM product_accounts WHERE user_id = $1 FOR UPDATE`, [userId]);
    if (!account.rows[0]) throw new AdminActionError("admin_account_not_found", 404);

    const erased = await eraseUserData(client, userId);
    files = erased.files;
    await client.query(
      `UPDATE data_deletion_requests SET queue_status = 'completed' WHERE user_id = $1 AND queue_status <> 'completed'`,
      [userId]
    );

    return writeAuditRecord(client, {
      adminUserId,
      correlationId: cleanCorrelationId,
      actionType: "data_deletion_executed",
      targetRecordType: "data_deletion_requests",
      targetRecordId: cleanRequestId,
      beforeState: { queue_status: cleanString(row.queue_status), account_state: cleanString(account.rows[0].account_state), actor_type: cleanString(account.rows[0].actor_type) },
      afterState: { queue_status: "completed", account_state: "deleted", erased_user_id: userId, deleted: erased.counts }
    });
  });

  if (!files) return outcome;
  return Object.freeze({ ...outcome, files_removed: await eraseUserFiles(files) });
}

// Org-owner GDPR erasure: what the admin chooses between - each organisation
// the owner owns and its active coaches to hand it to.
export async function getOrgOwnerErasurePlan(deletionRequestId: string) {
  const cleanRequestId = cleanString(deletionRequestId);
  const client = await pool.connect();
  try {
    const request = await client.query(
      `SELECT user_id, queue_status FROM org_owner_data_deletion_requests WHERE deletion_request_id = $1`,
      [cleanRequestId]
    );
    if (!request.rows[0]) throw new AdminActionError("admin_deletion_request_not_found", 404);
    return Object.freeze({
      deletion_request_id: cleanRequestId,
      queue_status: cleanString(request.rows[0].queue_status),
      organisations: await orgOwnerErasurePlan(client, cleanString(request.rows[0].user_id))
    });
  }
  finally {
    client.release();
  }
}

// Carry out a reviewed org-owner deletion request: every organisation they
// own is handed to the coach the admin chose (taken over from that coach's
// own account) or, with no active coach, closed; their own data is deleted
// and the account left as a tombstone. One transaction, audited; files after.
export async function eraseOrgOwnerForDeletionRequest(
  adminUserId: string,
  correlationId: string,
  deletionRequestId: string,
  handoversInput: unknown
): Promise<AuditOutcome & Readonly<{ files_removed?: ErasureCounts }>> {
  const cleanCorrelationId = cleanString(correlationId);
  const cleanRequestId = cleanString(deletionRequestId);
  if (!cleanCorrelationId || !cleanRequestId) {
    throw new AdminActionError("admin_action_identity_required", 400);
  }
  const handovers: Record<string, string | null> = {};
  if (handoversInput && typeof handoversInput === "object" && !Array.isArray(handoversInput)) {
    for (const [orgId, coach] of Object.entries(handoversInput as Record<string, unknown>)) {
      handovers[orgId] = typeof coach === "string" && coach.trim() ? coach.trim() : null;
    }
  }

  let files: Awaited<ReturnType<typeof eraseOrgOwnerData>>["files"] | null = null;
  const outcome = await withAdminTransaction(async (client) => {
    const existingAudit = await findExistingAudit(client, adminUserId, cleanCorrelationId);
    if (existingAudit) return toAuditOutcome(existingAudit, true);

    const request = await client.query(
      `SELECT deletion_request_id, user_id, queue_status FROM org_owner_data_deletion_requests WHERE deletion_request_id = $1 FOR UPDATE`,
      [cleanRequestId]
    );
    const row = request.rows[0];
    if (!row) throw new AdminActionError("admin_deletion_request_not_found", 404);
    if (cleanString(row.queue_status) === "completed") throw new AdminActionError("admin_deletion_request_already_erased", 409);
    const userId = cleanString(row.user_id);
    const account = await client.query(`SELECT account_state FROM product_org_owner_accounts WHERE user_id = $1 FOR UPDATE`, [userId]);
    if (!account.rows[0]) throw new AdminActionError("admin_account_not_found", 404);

    let erased: Awaited<ReturnType<typeof eraseOrgOwnerData>>;
    try {
      erased = await eraseOrgOwnerData(client, userId, handovers as OrgHandoverChoice);
    }
    catch (error) {
      if (error instanceof OrgHandoverChoiceError) throw new AdminActionError(error.message.split(":")[0], 400);
      throw error;
    }
    files = erased.files;
    await client.query(
      `UPDATE org_owner_data_deletion_requests SET queue_status = 'completed' WHERE user_id = $1 AND queue_status <> 'completed'`,
      [userId]
    );

    return writeAuditRecord(client, {
      adminUserId,
      correlationId: cleanCorrelationId,
      actionType: "data_deletion_executed",
      targetRecordType: "org_owner_data_deletion_requests",
      targetRecordId: cleanRequestId,
      beforeState: { queue_status: cleanString(row.queue_status), account_state: cleanString(account.rows[0].account_state), actor_type: "org_owner" },
      afterState: { queue_status: "completed", account_state: "closed", erased_user_id: userId, deleted: erased.counts, organisations: erased.organisations }
    });
  });

  if (!files) return outcome;
  return Object.freeze({ ...outcome, files_removed: await eraseUserFiles(files) });
}

