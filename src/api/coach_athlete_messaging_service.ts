// DEV NOTE: Part D.1 - coach<->athlete messaging. A thread is created
// lazily on first send (no separate "start thread" step) and only exists
// while - or after having existed while - the coach and athlete have a
// currently accepted individual relationship. Messaging is gated by the
// same field-level checks as assertCoachProfileActive/
// assertAcceptedRelationship in beta17_coach_managed_service.ts:436-503
// (relationship_scope, relationship_state, revoked_at_iso8601,
// expires_at_iso8601, coach/athlete identity match, product-state-only
// boundary flags) - EXCEPT the record_sha256 tamper check those perform,
// which exists there to defend against a CLIENT-ECHOED profile/relationship
// object (that file's own, older trust model). This service instead loads
// both records itself, straight from Postgres, keyed only by the
// session-derived coach/athlete id (never a client-supplied value) - the
// same modern, cookie-session-authenticated trust model used everywhere
// else in this codebase, so there is nothing for a hash check to defend
// against here.

import crypto from "node:crypto";

import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { loadBeta17StoredCoachContext } from "./beta_product_record_store.js";
import { pushToUser } from "./realtime_hub.js";
import {
  cleanupAttachmentFiles,
  finalizeAttachment,
  resolveAttachmentPath,
  type PendingAttachmentUpload
} from "./message_attachment_storage.js";

type JsonRecord = Record<string, unknown>;

export class CoachAthleteMessagingError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "CoachAthleteMessagingError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}

async function requireAcceptedCoachAthleteRelationship(
  coachUserId: string,
  athleteUserId: string
): Promise<void> {
  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_relationship_not_found", 403);
  }

  const profile = isRecord(context.coach_profile) ? context.coach_profile : {};
  if (
    profile.account_role !== "coach" ||
    profile.account_state !== "active" ||
    profile.product_auth_state_only !== true ||
    profile.engine_visible !== false
  ) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_coach_profile_not_active", 403);
  }

  const relationship = isRecord(context.relationship) ? context.relationship : {};
  if (
    relationship.coach_user_id !== coachUserId ||
    relationship.athlete_user_id !== athleteUserId ||
    relationship.relationship_scope !== "individual_coach_athlete" ||
    relationship.relationship_state !== "accepted" ||
    relationship.revoked_at_iso8601 !== null ||
    relationship.expires_at_iso8601 !== null ||
    relationship.product_permission_state_only !== true ||
    relationship.engine_visible !== false
  ) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_relationship_not_accepted", 403);
  }
}

export type CoachAthleteThreadRow = Readonly<{
  thread_id: string;
  coach_user_id: string;
  athlete_user_id: string;
  created_at_iso8601: string;
  updated_at_iso8601: string;
  unread_count?: number;
}>;

function mapThreadRow(value: unknown): CoachAthleteThreadRow | null {
  if (!isRecord(value) || value.thread_type !== "coach_athlete") return null;
  const athleteUserId = cleanString(value.athlete_user_id);
  if (!athleteUserId) return null;

  const row: Record<string, unknown> = {
    thread_id: cleanString(value.thread_id),
    coach_user_id: cleanString(value.coach_user_id),
    athlete_user_id: athleteUserId,
    created_at_iso8601: value.created_at instanceof Date ? value.created_at.toISOString() : "",
    updated_at_iso8601: value.updated_at instanceof Date ? value.updated_at.toISOString() : ""
  };
  if (value.unread_count !== undefined) {
    row.unread_count = Number(value.unread_count) || 0;
  }
  return Object.freeze(row) as CoachAthleteThreadRow;
}

export type CoachAthleteMessageAttachment = Readonly<{
  media_type: "image" | "video";
  mime_type: string;
  byte_size: number;
  url: string;
  thumbnail_url: string | null;
}>;

export type CoachAthleteMessageRow = Readonly<{
  message_id: string;
  thread_id: string;
  sender_user_id: string;
  sender_role: "coach" | "athlete";
  body_text: string;
  created_at_iso8601: string;
  attachment: CoachAthleteMessageAttachment | null;
}>;

// viewerRole picks the URL prefix for the attachment routes
// (/messages/coach/attachments/... vs /messages/athlete/attachments/...) -
// the same underlying row is projected once per side when it matters
// (see the two mapMessageRow calls in sendCoachAthleteMessage), since a
// coach and an athlete authenticate via different cookies/routes even
// when looking at the exact same message.
function mapMessageRow(value: unknown, viewerRole: "coach" | "athlete"): CoachAthleteMessageRow | null {
  if (!isRecord(value)) return null;
  const role = value.sender_role;
  if (role !== "coach" && role !== "athlete") return null;

  const messageId = cleanString(value.message_id);
  const attachmentMediaType = value.attachment_media_type;
  const attachment: CoachAthleteMessageAttachment | null =
    attachmentMediaType === "image" || attachmentMediaType === "video"
      ? Object.freeze({
          media_type: attachmentMediaType,
          mime_type: cleanString(value.attachment_mime_type),
          byte_size: typeof value.attachment_byte_size === "number" ? value.attachment_byte_size : 0,
          url: `/messages/${viewerRole}/attachments/${encodeURIComponent(messageId)}`,
          thumbnail_url: cleanString(value.attachment_thumbnail_storage_key)
            ? `/messages/${viewerRole}/attachments/${encodeURIComponent(messageId)}/thumbnail`
            : null
        })
      : null;

  return Object.freeze({
    message_id: messageId,
    thread_id: cleanString(value.thread_id),
    sender_user_id: cleanString(value.sender_user_id),
    sender_role: role,
    body_text: cleanString(value.body_text),
    created_at_iso8601: value.created_at instanceof Date ? value.created_at.toISOString() : "",
    attachment
  });
}

async function findOrCreateThread(
  client: PoolClient,
  coachUserId: string,
  athleteUserId: string
): Promise<string> {
  const candidateThreadId = randomId("msg_thread");
  await client.query(
    `
    INSERT INTO product_message_threads (thread_id, thread_type, coach_user_id, athlete_user_id)
    VALUES ($1, 'coach_athlete', $2, $3)
    ON CONFLICT (coach_user_id, athlete_user_id) WHERE thread_type = 'coach_athlete' DO NOTHING
    `,
    [candidateThreadId, coachUserId, athleteUserId]
  );

  const result = await client.query(
    `
    SELECT thread_id FROM product_message_threads
    WHERE thread_type = 'coach_athlete' AND coach_user_id = $1 AND athlete_user_id = $2
    LIMIT 1
    `,
    [coachUserId, athleteUserId]
  );
  return cleanString(result.rows[0]?.thread_id);
}

export type SentCoachAthleteMessage = Readonly<{
  thread: CoachAthleteThreadRow;
  message: CoachAthleteMessageRow;
}>;

export async function sendCoachAthleteMessage(
  senderRole: "coach" | "athlete",
  senderUserId: string,
  peerUserId: string,
  bodyTextInput: unknown,
  clientRequestIdInput: unknown,
  attachment: PendingAttachmentUpload | null = null
): Promise<SentCoachAthleteMessage> {
  const coachUserId = senderRole === "coach" ? senderUserId : cleanString(peerUserId);
  const athleteUserId = senderRole === "athlete" ? senderUserId : cleanString(peerUserId);
  if (!coachUserId || !athleteUserId) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_peer_required", 400);
  }

  await requireAcceptedCoachAthleteRelationship(coachUserId, athleteUserId);

  const bodyTextRaw = cleanString(bodyTextInput);
  if (!attachment && !bodyTextRaw) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_body_text_invalid", 400);
  }
  if (bodyTextRaw && bodyTextRaw.length > 4000) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_body_text_invalid", 400);
  }
  const bodyText = bodyTextRaw || null;
  const clientRequestId = cleanString(clientRequestIdInput) || randomId("msg_req");

  const messageId = randomId("msg");
  let attachmentColumns: Readonly<{ storageKey: string; thumbnailStorageKey: string | null }> | null = null;
  if (attachment) {
    attachmentColumns = await finalizeAttachment(attachment, messageId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const threadId = await findOrCreateThread(client, coachUserId, athleteUserId);

    const insertResult = await client.query(
      `
      INSERT INTO product_messages (
        message_id, thread_id, sender_user_id, sender_role, body_text, client_request_id,
        attachment_media_type, attachment_mime_type, attachment_byte_size,
        attachment_storage_key, attachment_thumbnail_storage_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (thread_id, sender_user_id, client_request_id) DO NOTHING
      `,
      [
        messageId, threadId, senderUserId, senderRole, bodyText, clientRequestId,
        attachment?.mediaType ?? null, attachment?.mimeType ?? null, attachment?.byteSize ?? null,
        attachmentColumns?.storageKey ?? null, attachmentColumns?.thumbnailStorageKey ?? null
      ]
    );

    // Idempotent replay of an existing (thread_id, sender_user_id,
    // client_request_id) tuple - the row we tried to insert already
    // exists under a different message_id, so the file we just moved
    // into place under THIS message_id is now an orphan nothing will
    // ever reference. Text-only messaging never needed this cleanup
    // (nothing but the DB row itself exists on a replay); attachments do.
    if (attachment && insertResult.rowCount === 0) {
      await cleanupAttachmentFiles(messageId).catch(() => {});
    }

    await client.query(
      `UPDATE product_message_threads SET updated_at = now() WHERE thread_id = $1`,
      [threadId]
    );

    await client.query("COMMIT");

    const threadRow = await pool.query(
      `SELECT * FROM product_message_threads WHERE thread_id = $1 LIMIT 1`,
      [threadId]
    );
    const messageRow = await pool.query(
      `SELECT * FROM product_messages WHERE thread_id = $1 AND sender_user_id = $2 AND client_request_id = $3 LIMIT 1`,
      [threadId, senderUserId, clientRequestId]
    );

    const thread = mapThreadRow(threadRow.rows[0]);
    const senderMessage = mapMessageRow(messageRow.rows[0], senderRole);
    if (!thread || !senderMessage) throw new CoachAthleteMessagingError("coach_athlete_messaging_send_failed", 500);

    // Best-effort live push to whichever side did NOT send - a missed
    // push (no live connection) is never a correctness problem, only a
    // delayed one; the recipient sees it next time they open/refresh the
    // thread exactly as before this existed. Projected separately from
    // the sender's own copy since the attachment URL prefix
    // (/messages/coach/... vs /messages/athlete/...) depends on which
    // side is viewing the exact same underlying row.
    const recipientRole = senderRole === "coach" ? "athlete" : "coach";
    const recipientUserId = senderRole === "coach" ? athleteUserId : coachUserId;
    const recipientMessage = mapMessageRow(messageRow.rows[0], recipientRole);
    pushToUser(recipientRole, recipientUserId, { type: "coach_athlete_message", thread, message: recipientMessage });

    return Object.freeze({ thread, message: senderMessage });
  }
  catch (error) {
    await client.query("ROLLBACK");
    if (attachment) await cleanupAttachmentFiles(messageId).catch(() => {});
    throw error;
  }
  finally {
    client.release();
  }
}

async function requireThreadAccessibleBy(
  threadId: string,
  userId: string,
  role: "coach" | "athlete"
): Promise<CoachAthleteThreadRow> {
  const result = await pool.query(
    `SELECT * FROM product_message_threads WHERE thread_id = $1 AND thread_type = 'coach_athlete' LIMIT 1`,
    [threadId]
  );
  const thread = mapThreadRow(result.rows[0]);
  if (!thread) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_thread_not_found", 404);
  }
  const ownerId = role === "coach" ? thread.coach_user_id : thread.athlete_user_id;
  if (ownerId !== userId) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_thread_access_denied", 403);
  }
  return thread;
}

export async function listCoachAthleteThreads(
  userId: string,
  role: "coach" | "athlete"
): Promise<readonly CoachAthleteThreadRow[]> {
  const column = role === "coach" ? "coach_user_id" : "athlete_user_id";
  const peerRole = role === "coach" ? "athlete" : "coach";
  const lastReadColumn = role === "coach" ? "coach_last_read_at" : "athlete_last_read_at";

  const result = await pool.query(
    `
    SELECT t.*,
      (
        SELECT COUNT(*) FROM product_messages m
        WHERE m.thread_id = t.thread_id
          AND m.sender_role = $2
          AND m.created_at > COALESCE(t.${lastReadColumn}, '-infinity'::timestamptz)
      ) AS unread_count
    FROM product_message_threads t
    WHERE thread_type = 'coach_athlete' AND ${column} = $1
    ORDER BY updated_at DESC
    `,
    [userId, peerRole]
  );
  return result.rows.map(mapThreadRow).filter((row): row is CoachAthleteThreadRow => row !== null);
}

export async function listCoachAthleteThreadMessages(
  threadId: string,
  userId: string,
  role: "coach" | "athlete"
): Promise<readonly CoachAthleteMessageRow[]> {
  await requireThreadAccessibleBy(threadId, userId, role);

  const lastReadColumn = role === "coach" ? "coach_last_read_at" : "athlete_last_read_at";

  const result = await pool.query(
    `SELECT * FROM product_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
    [threadId]
  );

  // Opening a thread's messages marks it read for this viewer only -
  // the peer's own last_read_at column is untouched, and this is a
  // best-effort UI convenience, never gated behind a separate endpoint.
  await pool.query(
    `UPDATE product_message_threads SET ${lastReadColumn} = now() WHERE thread_id = $1`,
    [threadId]
  );

  return result.rows
    .map((row) => mapMessageRow(row, role))
    .filter((row): row is CoachAthleteMessageRow => row !== null);
}

export type ResolvedMessageAttachmentFile = Readonly<{
  absolutePath: string;
  mimeType: string;
}>;

async function loadMessageAttachmentRow(
  messageId: string,
  userId: string,
  role: "coach" | "athlete"
): Promise<JsonRecord> {
  const result = await pool.query(
    `SELECT * FROM product_messages WHERE message_id = $1 LIMIT 1`,
    [messageId]
  );
  const row = result.rows[0];
  if (!isRecord(row)) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_attachment_not_found", 404);
  }
  await requireThreadAccessibleBy(cleanString(row.thread_id), userId, role);
  return row;
}

export async function resolveCoachAthleteMessageAttachment(
  messageId: string,
  userId: string,
  role: "coach" | "athlete"
): Promise<ResolvedMessageAttachmentFile | null> {
  const row = await loadMessageAttachmentRow(messageId, userId, role);
  const storageKey = cleanString(row.attachment_storage_key);
  if (!storageKey) return null;
  const absolutePath = resolveAttachmentPath(storageKey);
  if (!absolutePath) return null;
  return Object.freeze({ absolutePath, mimeType: cleanString(row.attachment_mime_type) || "application/octet-stream" });
}

export async function resolveCoachAthleteMessageAttachmentThumbnail(
  messageId: string,
  userId: string,
  role: "coach" | "athlete"
): Promise<ResolvedMessageAttachmentFile | null> {
  const row = await loadMessageAttachmentRow(messageId, userId, role);
  const storageKey = cleanString(row.attachment_thumbnail_storage_key);
  if (!storageKey) return null;
  const absolutePath = resolveAttachmentPath(storageKey);
  if (!absolutePath) return null;
  return Object.freeze({ absolutePath, mimeType: "image/jpeg" });
}
