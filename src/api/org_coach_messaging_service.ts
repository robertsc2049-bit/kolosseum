// DEV NOTE: Organisation/team billing commercial expansion (part D.2) -
// org-owner<->coach messaging. Mirrors coach_athlete_messaging_service.ts's
// shape (lazy thread creation on first send, idempotent via
// client_request_id, preserved history), but the access gate is entirely
// different: a coach may exchange messages with an org owner only while
// they hold an EXACTLY 'active' membership in that owner's org (never
// 'invited' or 'removed'). This file, like every other org file, never
// imports, queries, or references any relationship/athlete-scoped file
// or table - athletes are structurally out of scope here.

import crypto from "node:crypto";

import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { pushToUser } from "./realtime_hub.js";
import {
  cleanupAttachmentFiles,
  finalizeAttachment,
  resolveAttachmentPath,
  type PendingAttachmentUpload
} from "./message_attachment_storage.js";

type JsonRecord = Record<string, unknown>;

export class OrgCoachMessagingError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "OrgCoachMessagingError";
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

type OrgForMessaging = Readonly<{ org_id: string; owner_user_id: string }>;

// Duplicated locally rather than imported from org_billing_service.ts /
// org_visibility_service.ts - each sibling org-service file already
// re-implements this same shape independently, avoiding a cross-file
// dependency between them.
async function requireOrgOwnedBy(
  client: PoolClient,
  orgId: string,
  ownerUserId: string
): Promise<OrgForMessaging> {
  const result = await client.query(
    `SELECT org_id, owner_user_id FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const row = result.rows[0];
  if (!isRecord(row)) {
    throw new OrgCoachMessagingError("org_coach_messaging_organisation_not_found", 404);
  }
  if (cleanString(row.owner_user_id) !== ownerUserId) {
    throw new OrgCoachMessagingError("org_coach_messaging_organisation_access_denied", 403);
  }
  return Object.freeze({ org_id: cleanString(row.org_id), owner_user_id: cleanString(row.owner_user_id) });
}

// An exact 'active' match - unlike activeAndInvitedCoachMemberships
// (org_visibility_service.ts) or orgOccupiedSeatCount
// (org_billing_service.ts), which only ever exclude 'removed' for
// aggregate/roster purposes, messaging requires the coach to be a genuine
// current member, not merely invited.
async function requireActiveCoachMembership(
  client: PoolClient,
  orgId: string,
  coachUserId: string
): Promise<void> {
  const result = await client.query(
    `
    SELECT 1 FROM product_org_coach_memberships
    WHERE org_id = $1 AND coach_user_id = $2 AND membership_status = 'active'
    LIMIT 1
    `,
    [orgId, coachUserId]
  );
  if (result.rows.length === 0) {
    throw new OrgCoachMessagingError("org_coach_messaging_membership_not_active", 403);
  }
}

export type OrgCoachThreadRow = Readonly<{
  thread_id: string;
  org_id: string;
  coach_user_id: string;
  created_at_iso8601: string;
  updated_at_iso8601: string;
  unread_count?: number;
}>;

function mapThreadRow(value: unknown): OrgCoachThreadRow | null {
  if (!isRecord(value) || value.thread_type !== "org_owner_coach") return null;
  const orgId = cleanString(value.org_id);
  if (!orgId) return null;

  const row: Record<string, unknown> = {
    thread_id: cleanString(value.thread_id),
    org_id: orgId,
    coach_user_id: cleanString(value.coach_user_id),
    created_at_iso8601: value.created_at instanceof Date ? value.created_at.toISOString() : "",
    updated_at_iso8601: value.updated_at instanceof Date ? value.updated_at.toISOString() : ""
  };
  if (value.unread_count !== undefined) {
    row.unread_count = Number(value.unread_count) || 0;
  }
  return Object.freeze(row) as OrgCoachThreadRow;
}

export type OrgCoachMessageAttachment = Readonly<{
  media_type: "image" | "video";
  mime_type: string;
  byte_size: number;
  url: string;
  thumbnail_url: string | null;
}>;

export type OrgCoachMessageRow = Readonly<{
  message_id: string;
  thread_id: string;
  sender_user_id: string;
  sender_role: "org_owner" | "coach";
  body_text: string;
  created_at_iso8601: string;
  attachment: OrgCoachMessageAttachment | null;
}>;

// Unlike the coach<->athlete side, the owner-side attachment route is
// nested under its org (mirrors every other owner-side route in
// org_owner.routes.ts, e.g. /organisations/:org_id/messages/threads/...),
// while the coach-side route isn't (mirrors /org-messages/threads/...,
// which also carries no org_id - a coach's own message_id/thread_id is
// already enough to resolve without one).
type MessageViewer =
  | Readonly<{ role: "org_owner"; orgId: string }>
  | Readonly<{ role: "coach" }>;

function attachmentRouteBase(viewer: MessageViewer): string {
  return viewer.role === "org_owner"
    ? `/org/organisations/${encodeURIComponent(viewer.orgId)}/messages/attachments`
    : `/coach-workspace/org-messages/attachments`;
}

function mapMessageRow(value: unknown, viewer: MessageViewer): OrgCoachMessageRow | null {
  if (!isRecord(value)) return null;
  const role = value.sender_role;
  if (role !== "org_owner" && role !== "coach") return null;

  const messageId = cleanString(value.message_id);
  const attachmentMediaType = value.attachment_media_type;
  const attachment: OrgCoachMessageAttachment | null =
    attachmentMediaType === "image" || attachmentMediaType === "video"
      ? Object.freeze({
          media_type: attachmentMediaType,
          mime_type: cleanString(value.attachment_mime_type),
          byte_size: typeof value.attachment_byte_size === "number" ? value.attachment_byte_size : 0,
          url: `${attachmentRouteBase(viewer)}/${encodeURIComponent(messageId)}`,
          thumbnail_url: cleanString(value.attachment_thumbnail_storage_key)
            ? `${attachmentRouteBase(viewer)}/${encodeURIComponent(messageId)}/thumbnail`
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
  orgId: string,
  coachUserId: string
): Promise<string> {
  const candidateThreadId = randomId("msg_thread");
  await client.query(
    `
    INSERT INTO product_message_threads (thread_id, thread_type, coach_user_id, org_id)
    VALUES ($1, 'org_owner_coach', $2, $3)
    ON CONFLICT (org_id, coach_user_id) WHERE thread_type = 'org_owner_coach' DO NOTHING
    `,
    [candidateThreadId, coachUserId, orgId]
  );

  const result = await client.query(
    `
    SELECT thread_id FROM product_message_threads
    WHERE thread_type = 'org_owner_coach' AND org_id = $1 AND coach_user_id = $2
    LIMIT 1
    `,
    [orgId, coachUserId]
  );
  return cleanString(result.rows[0]?.thread_id);
}

export type SentOrgCoachMessage = Readonly<{
  thread: OrgCoachThreadRow;
  message: OrgCoachMessageRow;
}>;

async function sendMessageToThread(
  orgId: string,
  coachUserId: string,
  senderRole: "org_owner" | "coach",
  senderUserId: string,
  bodyTextInput: unknown,
  clientRequestIdInput: unknown,
  attachment: PendingAttachmentUpload | null = null
): Promise<SentOrgCoachMessage> {
  const bodyTextRaw = cleanString(bodyTextInput);
  if (!attachment && !bodyTextRaw) {
    throw new OrgCoachMessagingError("org_coach_messaging_body_text_invalid", 400);
  }
  if (bodyTextRaw && bodyTextRaw.length > 4000) {
    throw new OrgCoachMessagingError("org_coach_messaging_body_text_invalid", 400);
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

    const threadId = await findOrCreateThread(client, orgId, coachUserId);

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

    // Idempotent replay - see the identical comment in
    // coach_athlete_messaging_service.ts's sendCoachAthleteMessage for
    // why this cleanup has no text-only precedent.
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
    const senderViewer: MessageViewer = senderRole === "org_owner" ? { role: "org_owner", orgId } : { role: "coach" };
    const senderMessage = mapMessageRow(messageRow.rows[0], senderViewer);
    if (!thread || !senderMessage) throw new OrgCoachMessagingError("org_coach_messaging_send_failed", 500);

    // Best-effort live push to whichever side did NOT send - a missed
    // push is never a correctness problem, only a delayed one. The
    // sender's role is what's known here; the coach's id is already in
    // scope, but the org owner's id isn't (this function only ever
    // receives orgId/coachUserId) - resolved via product_organisations
    // only when the recipient actually is the owner. Projected separately
    // from the sender's own copy since the attachment URL depends on
    // which side is viewing the exact same underlying row.
    if (senderRole === "coach") {
      const ownerRow = await pool.query(
        `SELECT owner_user_id FROM product_organisations WHERE org_id = $1 LIMIT 1`,
        [orgId]
      );
      const ownerUserId = cleanString(ownerRow.rows[0]?.owner_user_id);
      if (ownerUserId) {
        const ownerMessage = mapMessageRow(messageRow.rows[0], { role: "org_owner", orgId });
        pushToUser("org_owner", ownerUserId, { type: "org_coach_message", thread, message: ownerMessage });
      }
    }
    else {
      const coachMessage = mapMessageRow(messageRow.rows[0], { role: "coach" });
      pushToUser("coach", coachUserId, { type: "org_coach_message", thread, message: coachMessage });
    }

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

export async function sendOrgCoachMessageFromOwner(
  ownerUserId: string,
  orgId: string,
  coachUserIdInput: unknown,
  bodyTextInput: unknown,
  clientRequestIdInput: unknown,
  attachment: PendingAttachmentUpload | null = null
): Promise<SentOrgCoachMessage> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new OrgCoachMessagingError("org_coach_messaging_peer_required", 400);
  }

  const ownershipClient = await pool.connect();
  try {
    await requireOrgOwnedBy(ownershipClient, orgId, ownerUserId);
    await requireActiveCoachMembership(ownershipClient, orgId, coachUserId);
  }
  finally {
    ownershipClient.release();
  }

  return sendMessageToThread(orgId, coachUserId, "org_owner", ownerUserId, bodyTextInput, clientRequestIdInput, attachment);
}

export async function sendOrgCoachMessageFromCoach(
  coachUserId: string,
  orgId: string,
  bodyTextInput: unknown,
  clientRequestIdInput: unknown,
  attachment: PendingAttachmentUpload | null = null
): Promise<SentOrgCoachMessage> {
  const membershipClient = await pool.connect();
  try {
    await requireActiveCoachMembership(membershipClient, orgId, coachUserId);
  }
  finally {
    membershipClient.release();
  }

  return sendMessageToThread(orgId, coachUserId, "coach", coachUserId, bodyTextInput, clientRequestIdInput, attachment);
}

export async function listOrgCoachThreadsForOwner(
  ownerUserId: string,
  orgId: string
): Promise<readonly OrgCoachThreadRow[]> {
  const client = await pool.connect();
  try {
    await requireOrgOwnedBy(client, orgId, ownerUserId);
    const result = await client.query(
      `
      SELECT t.*,
        (
          SELECT COUNT(*) FROM product_messages m
          WHERE m.thread_id = t.thread_id
            AND m.sender_role = 'coach'
            AND m.created_at > COALESCE(t.owner_last_read_at, '-infinity'::timestamptz)
        ) AS unread_count
      FROM product_message_threads t
      WHERE thread_type = 'org_owner_coach' AND org_id = $1
      ORDER BY updated_at DESC
      `,
      [orgId]
    );
    return result.rows.map(mapThreadRow).filter((row): row is OrgCoachThreadRow => row !== null);
  }
  finally {
    client.release();
  }
}

export async function listOrgCoachThreadsForCoach(
  coachUserId: string
): Promise<readonly OrgCoachThreadRow[]> {
  const result = await pool.query(
    `
    SELECT t.*,
      (
        SELECT COUNT(*) FROM product_messages m
        WHERE m.thread_id = t.thread_id
          AND m.sender_role = 'org_owner'
          AND m.created_at > COALESCE(t.coach_last_read_at, '-infinity'::timestamptz)
      ) AS unread_count
    FROM product_message_threads t
    WHERE thread_type = 'org_owner_coach' AND coach_user_id = $1
    ORDER BY updated_at DESC
    `,
    [coachUserId]
  );
  return result.rows.map(mapThreadRow).filter((row): row is OrgCoachThreadRow => row !== null);
}

export async function listOrgCoachThreadMessagesForOwner(
  threadId: string,
  ownerUserId: string
): Promise<readonly OrgCoachMessageRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM product_message_threads WHERE thread_id = $1 AND thread_type = 'org_owner_coach' LIMIT 1`,
      [threadId]
    );
    const thread = mapThreadRow(result.rows[0]);
    if (!thread) {
      throw new OrgCoachMessagingError("org_coach_messaging_thread_not_found", 404);
    }
    await requireOrgOwnedBy(client, thread.org_id, ownerUserId);

    const messages = await client.query(
      `SELECT * FROM product_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [threadId]
    );

    // Opening this thread's messages marks it read for the owner only -
    // mirrors coach_athlete_messaging_service.ts's identical convention.
    await client.query(
      `UPDATE product_message_threads SET owner_last_read_at = now() WHERE thread_id = $1`,
      [threadId]
    );

    const viewer: MessageViewer = { role: "org_owner", orgId: thread.org_id };
    return messages.rows
      .map((row) => mapMessageRow(row, viewer))
      .filter((row): row is OrgCoachMessageRow => row !== null);
  }
  finally {
    client.release();
  }
}

export async function listOrgCoachThreadMessagesForCoach(
  threadId: string,
  coachUserId: string
): Promise<readonly OrgCoachMessageRow[]> {
  const threadResult = await pool.query(
    `SELECT * FROM product_message_threads WHERE thread_id = $1 AND thread_type = 'org_owner_coach' LIMIT 1`,
    [threadId]
  );
  const thread = mapThreadRow(threadResult.rows[0]);
  if (!thread) {
    throw new OrgCoachMessagingError("org_coach_messaging_thread_not_found", 404);
  }
  if (thread.coach_user_id !== coachUserId) {
    throw new OrgCoachMessagingError("org_coach_messaging_thread_access_denied", 403);
  }

  const messages = await pool.query(
    `SELECT * FROM product_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
    [threadId]
  );

  await pool.query(
    `UPDATE product_message_threads SET coach_last_read_at = now() WHERE thread_id = $1`,
    [threadId]
  );

  return messages.rows
    .map((row) => mapMessageRow(row, { role: "coach" }))
    .filter((row): row is OrgCoachMessageRow => row !== null);
}

export type ResolvedOrgMessageAttachmentFile = Readonly<{
  absolutePath: string;
  mimeType: string;
}>;

async function loadOrgMessageAttachmentRowForOwner(messageId: string, ownerUserId: string): Promise<JsonRecord> {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM product_messages WHERE message_id = $1 LIMIT 1`, [messageId]);
    const row = result.rows[0];
    if (!isRecord(row)) {
      throw new OrgCoachMessagingError("org_coach_messaging_attachment_not_found", 404);
    }
    const threadResult = await client.query(
      `SELECT * FROM product_message_threads WHERE thread_id = $1 AND thread_type = 'org_owner_coach' LIMIT 1`,
      [cleanString(row.thread_id)]
    );
    const thread = mapThreadRow(threadResult.rows[0]);
    if (!thread) {
      throw new OrgCoachMessagingError("org_coach_messaging_attachment_not_found", 404);
    }
    await requireOrgOwnedBy(client, thread.org_id, ownerUserId);
    return row;
  }
  finally {
    client.release();
  }
}

async function loadOrgMessageAttachmentRowForCoach(messageId: string, coachUserId: string): Promise<JsonRecord> {
  const result = await pool.query(`SELECT * FROM product_messages WHERE message_id = $1 LIMIT 1`, [messageId]);
  const row = result.rows[0];
  if (!isRecord(row)) {
    throw new OrgCoachMessagingError("org_coach_messaging_attachment_not_found", 404);
  }
  const threadResult = await pool.query(
    `SELECT * FROM product_message_threads WHERE thread_id = $1 AND thread_type = 'org_owner_coach' LIMIT 1`,
    [cleanString(row.thread_id)]
  );
  const thread = mapThreadRow(threadResult.rows[0]);
  if (!thread) {
    throw new OrgCoachMessagingError("org_coach_messaging_attachment_not_found", 404);
  }
  // Matches listOrgCoachThreadMessagesForCoach's identical split: a
  // genuinely missing thread is 404, but a real thread belonging to a
  // DIFFERENT coach is 403 access-denied, not "not found".
  if (thread.coach_user_id !== coachUserId) {
    throw new OrgCoachMessagingError("org_coach_messaging_thread_access_denied", 403);
  }
  return row;
}

function resolvedAttachmentFromRow(row: JsonRecord, key: "attachment_storage_key" | "attachment_thumbnail_storage_key"): ResolvedOrgMessageAttachmentFile | null {
  const storageKey = cleanString(row[key]);
  if (!storageKey) return null;
  const absolutePath = resolveAttachmentPath(storageKey);
  if (!absolutePath) return null;
  return Object.freeze({
    absolutePath,
    mimeType: key === "attachment_thumbnail_storage_key" ? "image/jpeg" : (cleanString(row.attachment_mime_type) || "application/octet-stream")
  });
}

export async function resolveOrgCoachMessageAttachmentForOwner(
  messageId: string,
  ownerUserId: string
): Promise<ResolvedOrgMessageAttachmentFile | null> {
  const row = await loadOrgMessageAttachmentRowForOwner(messageId, ownerUserId);
  return resolvedAttachmentFromRow(row, "attachment_storage_key");
}

export async function resolveOrgCoachMessageAttachmentThumbnailForOwner(
  messageId: string,
  ownerUserId: string
): Promise<ResolvedOrgMessageAttachmentFile | null> {
  const row = await loadOrgMessageAttachmentRowForOwner(messageId, ownerUserId);
  return resolvedAttachmentFromRow(row, "attachment_thumbnail_storage_key");
}

export async function resolveOrgCoachMessageAttachmentForCoach(
  messageId: string,
  coachUserId: string
): Promise<ResolvedOrgMessageAttachmentFile | null> {
  const row = await loadOrgMessageAttachmentRowForCoach(messageId, coachUserId);
  return resolvedAttachmentFromRow(row, "attachment_storage_key");
}

export async function resolveOrgCoachMessageAttachmentThumbnailForCoach(
  messageId: string,
  coachUserId: string
): Promise<ResolvedOrgMessageAttachmentFile | null> {
  const row = await loadOrgMessageAttachmentRowForCoach(messageId, coachUserId);
  return resolvedAttachmentFromRow(row, "attachment_thumbnail_storage_key");
}
