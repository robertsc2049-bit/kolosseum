// DEV NOTE: Message safety (Online Safety Act 2023; Terms of Service clause
// 10). Anyone who received a message can report it, and coaches and
// athletes can block a person so their messages stop arriving. An admin
// decides each report: dismiss it, remove the message, or remove it and stop
// the sender from sending messages. The reporter is told the outcome and
// the sender is told why their message was removed (both as derived
// notifications, product_notification_service.ts).
//
// Enforcement sits in each send path (coach_athlete_messaging_service.ts,
// org_athlete_messaging_service.ts, org_coach_messaging_service.ts) via
// sendBlockReason; broadcasts skip anyone who has blocked the sender. A
// removed message stays in its thread as a placeholder: its text and
// attachment are never served again (removedMessageView), while the report
// keeps a snapshot of what was reported.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";

type Json = Record<string, unknown>;

export const REPORT_REASONS = Object.freeze(["abuse", "threat", "sexual", "spam", "illegal", "other"] as const);
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Readonly<Record<ReportReason, string>> = Object.freeze({
  abuse: "Abuse or harassment",
  threat: "Threats or violence",
  sexual: "Sexual content",
  spam: "Spam or scam",
  illegal: "Something illegal",
  other: "Something else"
});
const DECISIONS = Object.freeze(["dismiss", "remove", "remove_and_restrict"] as const);
type Decision = (typeof DECISIONS)[number];

export const REMOVED_MESSAGE_TEXT = "This message was removed by Kolosseum for breaking the Terms of Service.";

export class MessageSafetyError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = "MessageSafetyError";
  }
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const randomId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? String(value) : null);

// ---------------------------------------------------------------- sending

// Why a message from sender to recipient can't be sent, or null when it can:
// the sender is restricted by Kolosseum, or the recipient has blocked them.
// recipientUserId is null where the recipient can't block (an org owner).
export async function sendBlockReason(senderUserId: string, recipientUserId: string | null): Promise<"messaging_restricted" | "message_recipient_unavailable" | null> {
  const result = await pool.query(
    `SELECT
       EXISTS (SELECT 1 FROM product_messaging_restrictions WHERE user_id = $1) AS restricted,
       EXISTS (SELECT 1 FROM product_user_blocks WHERE blocker_user_id = $2 AND blocked_user_id = $1) AS blocked`,
    [senderUserId, recipientUserId ?? ""]
  );
  if (result.rows[0]?.restricted === true) return "messaging_restricted";
  if (recipientUserId && result.rows[0]?.blocked === true) return "message_recipient_unavailable";
  return null;
}

// Of these recipients, the ones who have blocked the sender (a broadcast
// skips them).
export async function recipientsWhoBlocked(senderUserId: string, recipientUserIds: readonly string[]): Promise<Set<string>> {
  if (!recipientUserIds.length) return new Set();
  const result = await pool.query(
    `SELECT blocker_user_id FROM product_user_blocks WHERE blocked_user_id = $1 AND blocker_user_id = ANY($2::text[])`,
    [senderUserId, [...recipientUserIds]]
  );
  return new Set(result.rows.map((row) => String(row.blocker_user_id)));
}

// How a removed message is shown to everyone in the thread.
export function removedMessageView<T extends Json>(message: T, row: Json): T {
  if (!row.removed_at) return message;
  return { ...message, body_text: REMOVED_MESSAGE_TEXT, attachment: null, removed: true } as T;
}

// ---------------------------------------------------------------- blocking

export async function listBlocks(userId: string): Promise<Readonly<Json>> {
  const result = await pool.query(
    `SELECT b.blocked_user_id, b.created_at,
            COALESCE(a.display_name, o.display_name) AS display_name
     FROM product_user_blocks b
     LEFT JOIN product_accounts a ON a.user_id = b.blocked_user_id
     LEFT JOIN product_org_owner_accounts o ON o.user_id = b.blocked_user_id
     WHERE b.blocker_user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return Object.freeze({
    blocks: result.rows.map((row) => Object.freeze({
      user_id: String(row.blocked_user_id),
      display_name: text(row.display_name) || "Someone",
      blocked_at_iso8601: iso(row.created_at)
    }))
  });
}

// Only someone who has messaged you can be blocked - you can't block a
// stranger's id you happened to learn.
export async function blockUser(userId: string, input: unknown): Promise<Readonly<Json>> {
  const blocked = text((input as Json | null)?.user_id);
  if (!blocked || blocked === userId) throw new MessageSafetyError("block_user_invalid", 422);
  const messaged = await pool.query(
    `SELECT 1 FROM product_messages m
     JOIN product_message_threads t ON t.thread_id = m.thread_id
     WHERE m.sender_user_id = $2 AND (t.coach_user_id = $1 OR t.athlete_user_id = $1)
     LIMIT 1`,
    [userId, blocked]
  );
  if (!messaged.rows.length) throw new MessageSafetyError("block_user_not_found", 404);
  await pool.query(
    `INSERT INTO product_user_blocks (blocker_user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, blocked]
  );
  return listBlocks(userId);
}

export async function unblockUser(userId: string, blockedUserId: string): Promise<Readonly<Json>> {
  await pool.query(`DELETE FROM product_user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`, [userId, text(blockedUserId)]);
  return listBlocks(userId);
}

// ---------------------------------------------------------------- reporting

// The message, if this user received it in a thread they're part of.
async function receivedMessage(userId: string, messageId: string): Promise<Json | null> {
  const result = await pool.query(
    `SELECT m.*, t.thread_type, t.coach_user_id, t.athlete_user_id, t.org_id
     FROM product_messages m
     JOIN product_message_threads t ON t.thread_id = m.thread_id
     WHERE m.message_id = $1
       AND m.sender_user_id <> $2
       AND (
         (t.thread_type = 'coach_athlete' AND $2 IN (t.coach_user_id, t.athlete_user_id))
         OR (t.thread_type = 'org_owner_coach' AND t.coach_user_id = $2)
         OR (t.thread_type = 'org_owner_athlete' AND t.athlete_user_id = $2)
       )
     LIMIT 1`,
    [messageId, userId]
  );
  return (result.rows[0] as Json | undefined) ?? null;
}

export async function reportMessage(userId: string, input: unknown): Promise<Readonly<Json>> {
  const body = (input && typeof input === "object" ? input : {}) as Json;
  const messageId = text(body.message_id);
  const reason = text(body.reason) as ReportReason;
  const note = text(body.note);
  const fieldErrors: Json = {};
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) fieldErrors.reason = "Choose a reason.";
  if (note.length > 1000) fieldErrors.note = "Keep it to 1000 characters.";
  if (Object.keys(fieldErrors).length) {
    const error = new MessageSafetyError("message_report_invalid", 422) as MessageSafetyError & { fieldErrors?: Json };
    error.fieldErrors = fieldErrors;
    throw error;
  }
  const message = messageId ? await receivedMessage(userId, messageId) : null;
  if (!message) throw new MessageSafetyError("message_report_not_found", 404);

  const snapshot = {
    sender_user_id: String(message.sender_user_id),
    sender_role: String(message.sender_role),
    thread_type: String(message.thread_type),
    body_text: message.body_text ?? null,
    attachment: message.attachment_media_type
      ? { media_type: message.attachment_media_type, mime_type: message.attachment_mime_type, byte_size: message.attachment_byte_size, storage_key: message.attachment_storage_key }
      : null,
    sent_at: iso(message.created_at)
  };
  // One report per person per message: reporting twice keeps the first.
  const inserted = await pool.query(
    `INSERT INTO product_message_reports (report_id, message_id, thread_id, reporter_user_id, reported_user_id, reason, note, message_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (message_id, reporter_user_id) DO NOTHING
     RETURNING report_id`,
    [randomId("msg_report"), messageId, String(message.thread_id), userId, String(message.sender_user_id), reason, note || null, JSON.stringify(snapshot)]
  );
  const existing = inserted.rows[0]
    ? inserted.rows[0]
    : (await pool.query(`SELECT report_id FROM product_message_reports WHERE message_id = $1 AND reporter_user_id = $2`, [messageId, userId])).rows[0];
  return Object.freeze({ report_id: String(existing.report_id), status: "open", already_reported: !inserted.rows[0] });
}

export async function listOwnReports(userId: string): Promise<Readonly<Json>> {
  const result = await pool.query(
    `SELECT report_id, message_id, reason, status, created_at, decided_at FROM product_message_reports WHERE reporter_user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return Object.freeze({
    reports: result.rows.map((row) => Object.freeze({
      report_id: String(row.report_id),
      message_id: String(row.message_id),
      reason: String(row.reason),
      status: String(row.status),
      reported_at_iso8601: iso(row.created_at),
      decided_at_iso8601: iso(row.decided_at)
    }))
  });
}

// ---------------------------------------------------------------- admin

async function displayNames(userIds: string[]): Promise<Map<string, { name: string; email: string; kind: string }>> {
  const result = await pool.query(
    `SELECT user_id, display_name, email_canonical, actor_type AS kind FROM product_accounts WHERE user_id = ANY($1::text[])
     UNION ALL
     SELECT user_id, display_name, email_canonical, 'org_owner' AS kind FROM product_org_owner_accounts WHERE user_id = ANY($1::text[])`,
    [userIds]
  );
  return new Map(result.rows.map((row) => [String(row.user_id), { name: text(row.display_name), email: text(row.email_canonical), kind: text(row.kind) }]));
}

// Reports for the admin console: open ones oldest first (or every status),
// each with the reported message as it was, the few messages before it in
// the thread for context, and who's involved.
export async function listReportsForAdmin(statusFilter: string): Promise<Readonly<Json>> {
  const open = statusFilter !== "all";
  const result = await pool.query(
    `SELECT r.*, m.removed_at,
            EXISTS (SELECT 1 FROM product_messaging_restrictions x WHERE x.user_id = r.reported_user_id) AS sender_restricted
     FROM product_message_reports r
     LEFT JOIN product_messages m ON m.message_id = r.message_id
     WHERE ($1::boolean = false OR r.status = 'open')
     ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.created_at ${open ? "ASC" : "DESC"}
     LIMIT 100`,
    [open]
  );
  const people = await displayNames([...new Set(result.rows.flatMap((row) => [String(row.reporter_user_id), String(row.reported_user_id)]))]);
  const reports = [];
  for (const row of result.rows) {
    const snapshot = row.message_snapshot as Json;
    const context = await pool.query(
      `SELECT sender_role, CASE WHEN removed_at IS NULL THEN body_text ELSE '[removed]' END AS body_text, attachment_media_type, created_at
       FROM product_messages
       WHERE thread_id = $1 AND created_at < $2::timestamptz
       ORDER BY created_at DESC LIMIT 3`,
      [String(row.thread_id), String(snapshot.sent_at ?? row.created_at)]
    );
    const who = (id: string) => ({ user_id: id, ...(people.get(id) ?? { name: "Deleted account", email: "", kind: "" }) });
    reports.push(Object.freeze({
      report_id: String(row.report_id),
      status: String(row.status),
      reason: String(row.reason),
      reason_label: REPORT_REASON_LABELS[row.reason as ReportReason] ?? String(row.reason),
      note: row.note ?? null,
      reported_at_iso8601: iso(row.created_at),
      reporter: who(String(row.reporter_user_id)),
      sender: who(String(row.reported_user_id)),
      sender_restricted: row.sender_restricted === true,
      message: { ...snapshot, removed: Boolean(row.removed_at) },
      context_before: context.rows.reverse().map((entry) => ({
        sender_role: String(entry.sender_role),
        body_text: entry.body_text ?? null,
        attachment_media_type: entry.attachment_media_type ?? null,
        sent_at: iso(entry.created_at)
      })),
      decision_note: row.decision_note ?? null,
      decided_at_iso8601: iso(row.decided_at)
    }));
  }
  return Object.freeze({ reports });
}

// An admin decides an open report. Removing the message (or removing it and
// restricting the sender) also closes every other open report of the same
// message the same way; the reason given is what the sender is told.
export async function decideReport(adminUserId: string, reportId: string, input: unknown): Promise<Readonly<Json>> {
  const body = (input && typeof input === "object" ? input : {}) as Json;
  const decision = text(body.decision) as Decision;
  const note = text(body.note);
  if (!(DECISIONS as readonly string[]).includes(decision)) throw new MessageSafetyError("message_report_decision_invalid", 422);
  if (decision !== "dismiss" && !note) throw new MessageSafetyError("message_report_reason_required", 422);
  if (note.length > 1000) throw new MessageSafetyError("message_report_reason_too_long", 422);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(`SELECT * FROM product_message_reports WHERE report_id = $1 FOR UPDATE`, [text(reportId)]);
    const report = found.rows[0];
    if (!report) throw new MessageSafetyError("message_report_not_found", 404);
    if (report.status !== "open") throw new MessageSafetyError("message_report_already_decided", 409);
    const status = decision === "dismiss" ? "dismissed" : decision === "remove" ? "removed" : "removed_and_restricted";
    if (decision === "dismiss") {
      await client.query(
        `UPDATE product_message_reports SET status = 'dismissed', decision_note = $2, decided_by = $3, decided_at = now() WHERE report_id = $1`,
        [report.report_id, note || null, adminUserId]
      );
    }
    else {
      await client.query(
        `UPDATE product_messages SET removed_at = now(), removed_reason = $2 WHERE message_id = $1 AND removed_at IS NULL`,
        [report.message_id, note]
      );
      await client.query(
        `UPDATE product_message_reports SET status = $2, decision_note = $3, decided_by = $4, decided_at = now()
         WHERE message_id = $1 AND status = 'open'`,
        [report.message_id, status, note, adminUserId]
      );
      if (decision === "remove_and_restrict") {
        await client.query(
          `INSERT INTO product_messaging_restrictions (user_id, report_id, reason, restricted_by) VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO NOTHING`,
          [report.reported_user_id, report.report_id, note, adminUserId]
        );
      }
    }
    await client.query("COMMIT");
    return Object.freeze({ report_id: String(report.report_id), status });
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

export async function liftRestriction(userId: string): Promise<Readonly<Json>> {
  const removed = await pool.query(`DELETE FROM product_messaging_restrictions WHERE user_id = $1`, [text(userId)]);
  if (!removed.rowCount) throw new MessageSafetyError("messaging_restriction_not_found", 404);
  return Object.freeze({ user_id: text(userId), restricted: false });
}

// What a user's own data export includes, and what erasure removes.
export async function messageSafetyRecordsFor(userId: string): Promise<Readonly<Json>> {
  const [blocks, reports, restriction] = await Promise.all([
    pool.query(`SELECT blocked_user_id, created_at FROM product_user_blocks WHERE blocker_user_id = $1`, [userId]),
    pool.query(`SELECT report_id, message_id, reason, note, status, created_at, decided_at FROM product_message_reports WHERE reporter_user_id = $1`, [userId]),
    pool.query(`SELECT reason, restricted_at FROM product_messaging_restrictions WHERE user_id = $1`, [userId])
  ]);
  return Object.freeze({ blocks: blocks.rows, reports_made: reports.rows, messaging_restriction: restriction.rows[0] ?? null });
}
