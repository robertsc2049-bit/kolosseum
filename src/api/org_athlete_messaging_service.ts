// DEV NOTE: Organisation/team billing commercial expansion (part D.4) -
// org-owner<->athlete messaging. Mirrors org_coach_messaging_service.ts's
// shape (lazy thread creation on first send, idempotent via
// client_request_id, preserved history, attachment support reused as-is
// from message_attachment_storage.ts). This is the SECOND deliberate,
// explicitly-gated exception to "no org file touches athlete-scoped
// data" - org_visibility_service.ts is the first. The gate here is
// stricter than a mere relationship check: an org owner may message an
// athlete only while (a) the org's visibility_mode is 'shared' (a "team"
// org, where the owner already is the coaching authority over the whole
// roster - 'individual'-mode orgs, which only ever expose aggregate
// counts, have no messaging path to any athlete at all, structurally),
// and (b) the athlete holds a currently-accepted relationship with one of
// that org's currently-active coaches.

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

export class OrgAthleteMessagingError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "OrgAthleteMessagingError";
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

type OrgForMessaging = Readonly<{ org_id: string; owner_user_id: string; visibility_mode: "individual" | "shared" }>;

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
    `SELECT org_id, owner_user_id, visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const row = result.rows[0];
  if (!isRecord(row)) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_organisation_not_found", 404);
  }
  if (cleanString(row.owner_user_id) !== ownerUserId) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_organisation_access_denied", 403);
  }
  return Object.freeze({
    org_id: cleanString(row.org_id),
    owner_user_id: cleanString(row.owner_user_id),
    visibility_mode: row.visibility_mode === "shared" ? "shared" : "individual"
  });
}

function isRelationshipExpired(relationshipState: string, expiresAtIso8601: string): boolean {
  return (
    relationshipState === "invited" &&
    Boolean(expiresAtIso8601) &&
    Number.isFinite(Date.parse(expiresAtIso8601)) &&
    Date.parse(expiresAtIso8601) <= Date.now()
  );
}

// The shared gate for BOTH send directions (mirrors
// coach_athlete_messaging_service.ts's symmetric
// requireAcceptedCoachAthleteRelationship, called identically regardless
// of which side is sending). visibility_mode = 'shared' is the same
// structural boundary org_visibility_service.ts already enforces for
// reading a roster - messaging never widens it. The relationship query
// reuses org_visibility_service.ts's latestRelationshipsForCoaches/
// isRelationshipExpired shape, duplicated locally (same convention as
// every sibling org file) and scoped to one athlete via subject_user_id.
async function requireOrgAthleteMessagingContext(
  client: PoolClient,
  orgId: string,
  athleteUserId: string
): Promise<void> {
  const orgResult = await client.query(
    `SELECT visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const orgRow = orgResult.rows[0];
  if (!isRecord(orgRow)) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_organisation_not_found", 404);
  }
  if (orgRow.visibility_mode !== "shared") {
    throw new OrgAthleteMessagingError("org_athlete_messaging_visibility_not_shared", 403);
  }

  const membershipResult = await client.query(
    `SELECT coach_user_id FROM product_org_coach_memberships WHERE org_id = $1 AND membership_status = 'active'`,
    [orgId]
  );
  const coachUserIds = membershipResult.rows.map((row) => cleanString(row.coach_user_id)).filter(Boolean);
  if (coachUserIds.length === 0) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_athlete_not_visible", 403);
  }

  const relationshipResult = await client.query(
    `
    SELECT DISTINCT ON (actor_user_id)
      actor_user_id, record_payload
    FROM beta_product_records
    WHERE record_type = 'beta17_coach_relationship' AND actor_user_id = ANY($1::text[]) AND subject_user_id = $2
    ORDER BY actor_user_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `,
    [coachUserIds, athleteUserId]
  );

  const hasAcceptedRelationship = relationshipResult.rows.some((row) => {
    if (!isRecord(row) || !isRecord(row.record_payload)) return false;
    const storedState = cleanString(row.record_payload.relationship_state);
    const expiresAt = cleanString(row.record_payload.expires_at_iso8601);
    const state = isRelationshipExpired(storedState, expiresAt) ? "expired" : storedState;
    return state === "accepted";
  });

  if (!hasAcceptedRelationship) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_athlete_not_visible", 403);
  }
}

// Part O.8 - the coach's own accepted-relationship gate for viewing an
// org<->athlete thread. Duplicated from coach_athlete_messaging_service.ts's
// requireAcceptedCoachAthleteRelationship (same field-level checks: scope,
// state, revoked/expires timestamps, product/engine-visibility flags,
// active coach profile) rather than cross-imported, matching this file's own
// requireOrgOwnedBy precedent of duplicating small gate functions across
// sibling service files. Stricter than requireOrgAthleteMessagingContext's
// "is there any accepted relationship with one of the org's coaches" check,
// because here a SPECIFIC coach is asserting a claim to a SPECIFIC athlete's
// thread.
async function requireCoachHasAcceptedRelationshipWithAthlete(
  coachUserId: string,
  athleteUserId: string
): Promise<void> {
  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_coach_relationship_not_found", 403);
  }

  const profile = isRecord(context.coach_profile) ? context.coach_profile : {};
  if (
    profile.account_role !== "coach" ||
    profile.account_state !== "active" ||
    profile.product_auth_state_only !== true ||
    profile.engine_visible !== false
  ) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_coach_profile_not_active", 403);
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
    throw new OrgAthleteMessagingError("org_athlete_messaging_coach_relationship_not_accepted", 403);
  }
}

export type OrgAthleteThreadRow = Readonly<{
  thread_id: string;
  org_id: string;
  org_name: string;
  athlete_user_id: string;
  created_at_iso8601: string;
  updated_at_iso8601: string;
  unread_count?: number;
}>;

function mapThreadRow(value: unknown): OrgAthleteThreadRow | null {
  if (!isRecord(value) || value.thread_type !== "org_owner_athlete") return null;
  const orgId = cleanString(value.org_id);
  const athleteUserId = cleanString(value.athlete_user_id);
  if (!orgId || !athleteUserId) return null;

  const row: Record<string, unknown> = {
    thread_id: cleanString(value.thread_id),
    org_id: orgId,
    org_name: cleanString(value.org_name),
    athlete_user_id: athleteUserId,
    created_at_iso8601: value.created_at instanceof Date ? value.created_at.toISOString() : "",
    updated_at_iso8601: value.updated_at instanceof Date ? value.updated_at.toISOString() : ""
  };
  if (value.unread_count !== undefined) {
    row.unread_count = Number(value.unread_count) || 0;
  }
  return Object.freeze(row) as OrgAthleteThreadRow;
}

export type OrgAthleteMessageAttachment = Readonly<{
  media_type: "image" | "video";
  mime_type: string;
  byte_size: number;
  url: string;
  thumbnail_url: string | null;
}>;

export type OrgAthleteMessageRow = Readonly<{
  message_id: string;
  thread_id: string;
  sender_user_id: string;
  sender_role: "org_owner" | "athlete";
  body_text: string;
  created_at_iso8601: string;
  attachment: OrgAthleteMessageAttachment | null;
}>;

// Same asymmetric nesting precedent as org_coach_messaging_service.ts's
// attachmentRouteBase: the owner-side route is nested under its org
// (mirrors /organisations/:org_id/messages/attachments/...), while the
// athlete-side route lives under the existing /messages/athlete/... family
// (mirrors /messages/athlete/attachments/... from the coach<->athlete
// side) with an org-messages differentiator so it can't collide with
// coach_athlete_messaging_service.ts's own attachment routes. Part O.8 adds
// a third, read-only "coach" viewer - symmetric with the athlete-side path,
// under /messages/coach/org-messages/... so it can't collide with either
// the D.1 /messages/coach/attachments/... family (no org-messages segment)
// or the D.2 /coach-workspace/org-messages/... family (a different router
// entirely, for the coach's own thread with the org owner).
type MessageViewer =
  | Readonly<{ role: "org_owner"; orgId: string }>
  | Readonly<{ role: "athlete" }>
  | Readonly<{ role: "coach" }>;

function attachmentRouteBase(viewer: MessageViewer): string {
  if (viewer.role === "org_owner") {
    return `/org/organisations/${encodeURIComponent(viewer.orgId)}/athlete-messages/attachments`;
  }
  return viewer.role === "athlete"
    ? `/messages/athlete/org-messages/attachments`
    : `/messages/coach/org-messages/attachments`;
}

function mapMessageRow(value: unknown, viewer: MessageViewer): OrgAthleteMessageRow | null {
  if (!isRecord(value)) return null;
  const role = value.sender_role;
  if (role !== "org_owner" && role !== "athlete") return null;

  const messageId = cleanString(value.message_id);
  const attachmentMediaType = value.attachment_media_type;
  const attachment: OrgAthleteMessageAttachment | null =
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
  athleteUserId: string
): Promise<string> {
  const candidateThreadId = randomId("msg_thread");
  await client.query(
    `
    INSERT INTO product_message_threads (thread_id, thread_type, athlete_user_id, org_id)
    VALUES ($1, 'org_owner_athlete', $2, $3)
    ON CONFLICT (org_id, athlete_user_id) WHERE thread_type = 'org_owner_athlete' DO NOTHING
    `,
    [candidateThreadId, athleteUserId, orgId]
  );

  const result = await client.query(
    `
    SELECT thread_id FROM product_message_threads
    WHERE thread_type = 'org_owner_athlete' AND org_id = $1 AND athlete_user_id = $2
    LIMIT 1
    `,
    [orgId, athleteUserId]
  );
  return cleanString(result.rows[0]?.thread_id);
}

async function loadThreadWithOrgName(threadId: string): Promise<JsonRecord | null> {
  const result = await pool.query(
    `
    SELECT t.*, o.org_name
    FROM product_message_threads t
    JOIN product_organisations o ON o.org_id = t.org_id
    WHERE t.thread_id = $1 AND t.thread_type = 'org_owner_athlete'
    LIMIT 1
    `,
    [threadId]
  );
  return isRecord(result.rows[0]) ? result.rows[0] : null;
}

export type SentOrgAthleteMessage = Readonly<{
  thread: OrgAthleteThreadRow;
  message: OrgAthleteMessageRow;
}>;

async function sendMessageToThread(
  orgId: string,
  athleteUserId: string,
  senderRole: "org_owner" | "athlete",
  senderUserId: string,
  bodyTextInput: unknown,
  clientRequestIdInput: unknown,
  attachment: PendingAttachmentUpload | null = null
): Promise<SentOrgAthleteMessage> {
  const bodyTextRaw = cleanString(bodyTextInput);
  if (!attachment && !bodyTextRaw) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_body_text_invalid", 400);
  }
  if (bodyTextRaw && bodyTextRaw.length > 4000) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_body_text_invalid", 400);
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

    const threadId = await findOrCreateThread(client, orgId, athleteUserId);

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
    // coach_athlete_messaging_service.ts's sendCoachAthleteMessage for why
    // this cleanup has no text-only precedent.
    if (attachment && insertResult.rowCount === 0) {
      await cleanupAttachmentFiles(messageId).catch(() => {});
    }

    await client.query(
      `UPDATE product_message_threads SET updated_at = now() WHERE thread_id = $1`,
      [threadId]
    );

    await client.query("COMMIT");

    const threadRow = await loadThreadWithOrgName(threadId);
    const messageRow = await pool.query(
      `SELECT * FROM product_messages WHERE thread_id = $1 AND sender_user_id = $2 AND client_request_id = $3 LIMIT 1`,
      [threadId, senderUserId, clientRequestId]
    );

    const thread = mapThreadRow(threadRow);
    const senderViewer: MessageViewer = senderRole === "org_owner" ? { role: "org_owner", orgId } : { role: "athlete" };
    const senderMessage = mapMessageRow(messageRow.rows[0], senderViewer);
    if (!thread || !senderMessage) throw new OrgAthleteMessagingError("org_athlete_messaging_send_failed", 500);

    // Best-effort live push to whichever side did NOT send - a missed
    // push is never a correctness problem, only a delayed one. Projected
    // separately from the sender's own copy since the attachment URL
    // depends on which side is viewing the exact same underlying row.
    if (senderRole === "athlete") {
      const ownerRow = await pool.query(
        `SELECT owner_user_id FROM product_organisations WHERE org_id = $1 LIMIT 1`,
        [orgId]
      );
      const ownerUserId = cleanString(ownerRow.rows[0]?.owner_user_id);
      if (ownerUserId) {
        const ownerMessage = mapMessageRow(messageRow.rows[0], { role: "org_owner", orgId });
        pushToUser("org_owner", ownerUserId, { type: "org_athlete_message", thread, message: ownerMessage });
      }
    }
    else {
      const athleteMessage = mapMessageRow(messageRow.rows[0], { role: "athlete" });
      pushToUser("athlete", athleteUserId, { type: "org_athlete_message", thread, message: athleteMessage });
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

export async function sendOrgAthleteMessageFromOwner(
  ownerUserId: string,
  orgId: string,
  athleteUserIdInput: unknown,
  bodyTextInput: unknown,
  clientRequestIdInput: unknown,
  attachment: PendingAttachmentUpload | null = null
): Promise<SentOrgAthleteMessage> {
  const athleteUserId = cleanString(athleteUserIdInput);
  if (!athleteUserId) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_peer_required", 400);
  }

  const gateClient = await pool.connect();
  try {
    await requireOrgOwnedBy(gateClient, orgId, ownerUserId);
    await requireOrgAthleteMessagingContext(gateClient, orgId, athleteUserId);
  }
  finally {
    gateClient.release();
  }

  return sendMessageToThread(orgId, athleteUserId, "org_owner", ownerUserId, bodyTextInput, clientRequestIdInput, attachment);
}

export async function sendOrgAthleteMessageFromAthlete(
  athleteUserId: string,
  orgId: string,
  bodyTextInput: unknown,
  clientRequestIdInput: unknown,
  attachment: PendingAttachmentUpload | null = null
): Promise<SentOrgAthleteMessage> {
  const gateClient = await pool.connect();
  try {
    await requireOrgAthleteMessagingContext(gateClient, orgId, athleteUserId);
  }
  finally {
    gateClient.release();
  }

  return sendMessageToThread(orgId, athleteUserId, "athlete", athleteUserId, bodyTextInput, clientRequestIdInput, attachment);
}

export async function listOrgAthleteThreadsForOwner(
  ownerUserId: string,
  orgId: string
): Promise<readonly OrgAthleteThreadRow[]> {
  const client = await pool.connect();
  try {
    await requireOrgOwnedBy(client, orgId, ownerUserId);
    const result = await client.query(
      `
      SELECT t.*, o.org_name,
        (
          SELECT COUNT(*) FROM product_messages m
          WHERE m.thread_id = t.thread_id
            AND m.sender_role = 'athlete'
            AND m.created_at > COALESCE(t.owner_last_read_at, '-infinity'::timestamptz)
        ) AS unread_count
      FROM product_message_threads t
      JOIN product_organisations o ON o.org_id = t.org_id
      WHERE t.thread_type = 'org_owner_athlete' AND t.org_id = $1
      ORDER BY t.updated_at DESC
      `,
      [orgId]
    );
    return result.rows.map(mapThreadRow).filter((row): row is OrgAthleteThreadRow => row !== null);
  }
  finally {
    client.release();
  }
}

export async function listOrgAthleteThreadsForAthlete(
  athleteUserId: string
): Promise<readonly OrgAthleteThreadRow[]> {
  const result = await pool.query(
    `
    SELECT t.*, o.org_name,
      (
        SELECT COUNT(*) FROM product_messages m
        WHERE m.thread_id = t.thread_id
          AND m.sender_role = 'org_owner'
          AND m.created_at > COALESCE(t.athlete_last_read_at, '-infinity'::timestamptz)
      ) AS unread_count
    FROM product_message_threads t
    JOIN product_organisations o ON o.org_id = t.org_id
    WHERE t.thread_type = 'org_owner_athlete' AND t.athlete_user_id = $1
    ORDER BY t.updated_at DESC
    `,
    [athleteUserId]
  );
  return result.rows.map(mapThreadRow).filter((row): row is OrgAthleteThreadRow => row !== null);
}

// Part O.8 - a coach's read-only view of their own athlete's org<->owner
// threads. Two-tier gate mirroring listOrganisationRosterForCoach's own
// precedent (org_roster_service.ts, part O.7): a real access-control
// failure (no accepted relationship with this athlete at all) throws, but
// a structural non-match (no active membership in any shared-mode org that
// happens to have a thread with this athlete) returns an empty list quietly
// - "nothing to show" is not the same as "access denied".
export async function listOrgAthleteThreadsVisibleToCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<readonly OrgAthleteThreadRow[]> {
  await requireCoachHasAcceptedRelationshipWithAthlete(coachUserId, athleteUserId);

  const result = await pool.query(
    `
    SELECT t.*, o.org_name
    FROM product_message_threads t
    JOIN product_organisations o ON o.org_id = t.org_id
    JOIN product_org_coach_memberships m ON m.org_id = t.org_id
    WHERE t.thread_type = 'org_owner_athlete'
      AND t.athlete_user_id = $1
      AND m.coach_user_id = $2
      AND m.membership_status = 'active'
      AND o.visibility_mode = 'shared'
    ORDER BY t.updated_at DESC
    `,
    [athleteUserId, coachUserId]
  );
  return result.rows.map(mapThreadRow).filter((row): row is OrgAthleteThreadRow => row !== null);
}

export async function listOrgAthleteThreadMessagesForCoach(
  threadId: string,
  coachUserId: string
): Promise<readonly OrgAthleteMessageRow[]> {
  const threadRow = await loadThreadWithOrgName(threadId);
  const thread = mapThreadRow(threadRow);
  if (!thread) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_thread_not_found", 404);
  }

  await requireCoachHasAcceptedRelationshipWithAthlete(coachUserId, thread.athlete_user_id);

  // Re-verify this coach is an ACTIVE member of THIS thread's org - unlike
  // the list function above, a failure here IS a genuine access denial
  // (the thread_id is real, just not this coach's to see), not a quiet
  // empty result.
  const membershipResult = await pool.query(
    `SELECT 1 FROM product_org_coach_memberships WHERE org_id = $1 AND coach_user_id = $2 AND membership_status = 'active' LIMIT 1`,
    [thread.org_id, coachUserId]
  );
  if (!membershipResult.rows[0]) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_thread_access_denied", 403);
  }

  const messages = await pool.query(
    `SELECT * FROM product_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
    [threadId]
  );
  const viewer: MessageViewer = { role: "coach" };
  return messages.rows
    .map((row) => mapMessageRow(row, viewer))
    .filter((row): row is OrgAthleteMessageRow => row !== null);
}

export async function listOrgAthleteThreadMessagesForOwner(
  threadId: string,
  ownerUserId: string
): Promise<readonly OrgAthleteMessageRow[]> {
  const client = await pool.connect();
  try {
    const threadRow = await loadThreadWithOrgName(threadId);
    const thread = mapThreadRow(threadRow);
    if (!thread) {
      throw new OrgAthleteMessagingError("org_athlete_messaging_thread_not_found", 404);
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
      .filter((row): row is OrgAthleteMessageRow => row !== null);
  }
  finally {
    client.release();
  }
}

export async function listOrgAthleteThreadMessagesForAthlete(
  threadId: string,
  athleteUserId: string
): Promise<readonly OrgAthleteMessageRow[]> {
  const threadRow = await loadThreadWithOrgName(threadId);
  const thread = mapThreadRow(threadRow);
  if (!thread) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_thread_not_found", 404);
  }
  if (thread.athlete_user_id !== athleteUserId) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_thread_access_denied", 403);
  }

  const messages = await pool.query(
    `SELECT * FROM product_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
    [threadId]
  );

  await pool.query(
    `UPDATE product_message_threads SET athlete_last_read_at = now() WHERE thread_id = $1`,
    [threadId]
  );

  return messages.rows
    .map((row) => mapMessageRow(row, { role: "athlete" }))
    .filter((row): row is OrgAthleteMessageRow => row !== null);
}

export type ResolvedOrgAthleteMessageAttachmentFile = Readonly<{
  absolutePath: string;
  mimeType: string;
}>;

async function loadOrgAthleteMessageAttachmentRowForOwner(messageId: string, ownerUserId: string): Promise<JsonRecord> {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM product_messages WHERE message_id = $1 LIMIT 1`, [messageId]);
    const row = result.rows[0];
    if (!isRecord(row)) {
      throw new OrgAthleteMessagingError("org_athlete_messaging_attachment_not_found", 404);
    }
    const threadRow = await loadThreadWithOrgName(cleanString(row.thread_id));
    const thread = mapThreadRow(threadRow);
    if (!thread) {
      throw new OrgAthleteMessagingError("org_athlete_messaging_attachment_not_found", 404);
    }
    await requireOrgOwnedBy(client, thread.org_id, ownerUserId);
    return row;
  }
  finally {
    client.release();
  }
}

async function loadOrgAthleteMessageAttachmentRowForAthlete(messageId: string, athleteUserId: string): Promise<JsonRecord> {
  const result = await pool.query(`SELECT * FROM product_messages WHERE message_id = $1 LIMIT 1`, [messageId]);
  const row = result.rows[0];
  if (!isRecord(row)) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_attachment_not_found", 404);
  }
  const threadRow = await loadThreadWithOrgName(cleanString(row.thread_id));
  const thread = mapThreadRow(threadRow);
  if (!thread) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_attachment_not_found", 404);
  }
  // Matches listOrgAthleteThreadMessagesForAthlete's identical split: a
  // genuinely missing thread is 404, but a real thread belonging to a
  // DIFFERENT athlete is 403 access-denied, not "not found".
  if (thread.athlete_user_id !== athleteUserId) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_thread_access_denied", 403);
  }
  return row;
}

// Part O.8 - mirrors loadOrgAthleteMessageAttachmentRowForOwner/ForAthlete
// exactly, with the same two-tier gate as listOrgAthleteThreadMessagesForCoach:
// accepted relationship with the thread's athlete, then active membership
// in the thread's org - both real access-control checks (an attachment
// fetch always names a specific message/thread, never a list, so there is
// no "structural, quiet empty" branch here).
async function loadOrgAthleteMessageAttachmentRowForCoach(messageId: string, coachUserId: string): Promise<JsonRecord> {
  const result = await pool.query(`SELECT * FROM product_messages WHERE message_id = $1 LIMIT 1`, [messageId]);
  const row = result.rows[0];
  if (!isRecord(row)) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_attachment_not_found", 404);
  }
  const threadRow = await loadThreadWithOrgName(cleanString(row.thread_id));
  const thread = mapThreadRow(threadRow);
  if (!thread) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_attachment_not_found", 404);
  }

  await requireCoachHasAcceptedRelationshipWithAthlete(coachUserId, thread.athlete_user_id);

  const membershipResult = await pool.query(
    `SELECT 1 FROM product_org_coach_memberships WHERE org_id = $1 AND coach_user_id = $2 AND membership_status = 'active' LIMIT 1`,
    [thread.org_id, coachUserId]
  );
  if (!membershipResult.rows[0]) {
    throw new OrgAthleteMessagingError("org_athlete_messaging_thread_access_denied", 403);
  }
  return row;
}

function resolvedAttachmentFromRow(row: JsonRecord, key: "attachment_storage_key" | "attachment_thumbnail_storage_key"): ResolvedOrgAthleteMessageAttachmentFile | null {
  const storageKey = cleanString(row[key]);
  if (!storageKey) return null;
  const absolutePath = resolveAttachmentPath(storageKey);
  if (!absolutePath) return null;
  return Object.freeze({
    absolutePath,
    mimeType: key === "attachment_thumbnail_storage_key" ? "image/jpeg" : (cleanString(row.attachment_mime_type) || "application/octet-stream")
  });
}

export async function resolveOrgAthleteMessageAttachmentForOwner(
  messageId: string,
  ownerUserId: string
): Promise<ResolvedOrgAthleteMessageAttachmentFile | null> {
  const row = await loadOrgAthleteMessageAttachmentRowForOwner(messageId, ownerUserId);
  return resolvedAttachmentFromRow(row, "attachment_storage_key");
}

export async function resolveOrgAthleteMessageAttachmentThumbnailForOwner(
  messageId: string,
  ownerUserId: string
): Promise<ResolvedOrgAthleteMessageAttachmentFile | null> {
  const row = await loadOrgAthleteMessageAttachmentRowForOwner(messageId, ownerUserId);
  return resolvedAttachmentFromRow(row, "attachment_thumbnail_storage_key");
}

export async function resolveOrgAthleteMessageAttachmentForAthlete(
  messageId: string,
  athleteUserId: string
): Promise<ResolvedOrgAthleteMessageAttachmentFile | null> {
  const row = await loadOrgAthleteMessageAttachmentRowForAthlete(messageId, athleteUserId);
  return resolvedAttachmentFromRow(row, "attachment_storage_key");
}

export async function resolveOrgAthleteMessageAttachmentThumbnailForAthlete(
  messageId: string,
  athleteUserId: string
): Promise<ResolvedOrgAthleteMessageAttachmentFile | null> {
  const row = await loadOrgAthleteMessageAttachmentRowForAthlete(messageId, athleteUserId);
  return resolvedAttachmentFromRow(row, "attachment_thumbnail_storage_key");
}

export async function resolveOrgAthleteMessageAttachmentForCoach(
  messageId: string,
  coachUserId: string
): Promise<ResolvedOrgAthleteMessageAttachmentFile | null> {
  const row = await loadOrgAthleteMessageAttachmentRowForCoach(messageId, coachUserId);
  return resolvedAttachmentFromRow(row, "attachment_storage_key");
}

export async function resolveOrgAthleteMessageAttachmentThumbnailForCoach(
  messageId: string,
  coachUserId: string
): Promise<ResolvedOrgAthleteMessageAttachmentFile | null> {
  const row = await loadOrgAthleteMessageAttachmentRowForCoach(messageId, coachUserId);
  return resolvedAttachmentFromRow(row, "attachment_thumbnail_storage_key");
}
