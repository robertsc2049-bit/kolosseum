// DEV NOTE: Org-owner broadcast messaging. Sends the same message text into
// every one of an org owner's currently-active coach threads, or (shared-
// visibility orgs only) every accepted athlete thread across those coaches,
// by calling sendOrgCoachMessageFromOwner/sendOrgAthleteMessageFromOwner
// once per recipient - same "no separate broadcast record type, just a
// fan-out over the existing per-recipient send path" shape as
// coach_broadcast_messaging_service.ts's own coach->athlete broadcast.
// Recipient lists are resolved fresh on every call (activeCoachIdsForOrg/
// resolveOrgActiveCoachAcceptedAthletes, both already exported from
// attendance_event_org_invite_service.ts for the gym-wide attendance-event
// fan-out), never client-supplied.
//
// Read-receipt grouping: every fan-out send in one broadcast shares the
// SAME server-generated client_request_id (never client-supplied), exactly
// like the coach broadcast - safe because each fan-out send lands in a
// different thread, and the existing (thread_id, sender_user_id,
// client_request_id) uniqueness never collides across threads. This turns
// that already-existing column into a free broadcast_id, with no new
// column and no new record type - the read-status functions below just
// re-derive "read" per recipient from their thread's own
// coach_last_read_at/athlete_last_read_at marker.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  activeCoachIdsForOrg,
  resolveOrgActiveCoachAcceptedAthletes
} from "./attendance_event_org_invite_service.js";
import { sendOrgAthleteMessageFromOwner } from "./org_athlete_messaging_service.js";
import { sendOrgCoachMessageFromOwner } from "./org_coach_messaging_service.js";

type JsonRecord = Record<string, unknown>;

export class OrgBroadcastMessagingError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgBroadcastMessagingError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}

function validatedBroadcastInputs(ownerUserIdInput: string, orgIdInput: string, bodyTextInput: unknown): {
  ownerUserId: string;
  orgId: string;
  bodyText: string;
} {
  const ownerUserId = cleanString(ownerUserIdInput);
  if (!ownerUserId) {
    throw new OrgBroadcastMessagingError("org_broadcast_messaging_owner_required");
  }

  const orgId = cleanString(orgIdInput);
  if (!orgId) {
    throw new OrgBroadcastMessagingError("org_broadcast_messaging_org_required");
  }

  const bodyText = cleanString(bodyTextInput);
  if (!bodyText) {
    throw new OrgBroadcastMessagingError("org_broadcast_messaging_body_text_invalid");
  }
  if (bodyText.length > 4000) {
    throw new OrgBroadcastMessagingError("org_broadcast_messaging_body_text_invalid");
  }

  return { ownerUserId, orgId, bodyText };
}

// A plain pool.query check (not a PoolClient/transaction, unlike the 1:1
// messaging services' own private requireOrgOwnedBy copies) - nothing here
// writes anything itself, every actual send re-verifies ownership again on
// its own via the existing per-recipient sender it delegates to.
async function requireOrgOwnedByForBroadcast(orgId: string, ownerUserId: string): Promise<{ visibilityMode: "shared" | "individual" }> {
  const result = await pool.query(
    `SELECT owner_user_id, visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new OrgBroadcastMessagingError("org_broadcast_messaging_organisation_not_found", 404);
  }
  if (cleanString(row.owner_user_id) !== ownerUserId) {
    throw new OrgBroadcastMessagingError("org_broadcast_messaging_organisation_access_denied", 403);
  }
  return { visibilityMode: row.visibility_mode === "shared" ? "shared" : "individual" };
}

export async function sendOrgCoachBroadcastMessage(
  ownerUserIdInput: string,
  orgIdInput: string,
  bodyTextInput: unknown
): Promise<Readonly<JsonRecord>> {
  const { ownerUserId, orgId, bodyText } = validatedBroadcastInputs(ownerUserIdInput, orgIdInput, bodyTextInput);
  await requireOrgOwnedByForBroadcast(orgId, ownerUserId);

  const coachUserIds = await activeCoachIdsForOrg(orgId);
  const broadcastId = randomId("broadcast");

  const results: JsonRecord[] = [];
  for (const coachUserId of coachUserIds) {
    const sent = await sendOrgCoachMessageFromOwner(ownerUserId, orgId, coachUserId, bodyText, broadcastId);
    results.push({
      coach_user_id: coachUserId,
      thread_id: sent.thread.thread_id,
      message_id: sent.message.message_id
    });
  }

  return Object.freeze({
    broadcast_id: broadcastId,
    sent_count: results.length,
    coach_user_ids: results.map((entry) => entry.coach_user_id),
    results: Object.freeze(results)
  });
}

export async function sendOrgAthleteBroadcastMessage(
  ownerUserIdInput: string,
  orgIdInput: string,
  bodyTextInput: unknown
): Promise<Readonly<JsonRecord>> {
  const { ownerUserId, orgId, bodyText } = validatedBroadcastInputs(ownerUserIdInput, orgIdInput, bodyTextInput);
  const { visibilityMode } = await requireOrgOwnedByForBroadcast(orgId, ownerUserId);
  if (visibilityMode !== "shared") {
    throw new OrgBroadcastMessagingError("org_broadcast_messaging_athletes_require_shared_visibility", 403);
  }

  const athletes = await resolveOrgActiveCoachAcceptedAthletes(orgId);
  const broadcastId = randomId("broadcast");

  const results: JsonRecord[] = [];
  for (const athlete of athletes) {
    const athleteUserId = cleanString(athlete.athlete_user_id);
    const sent = await sendOrgAthleteMessageFromOwner(ownerUserId, orgId, athleteUserId, bodyText, broadcastId);
    results.push({
      athlete_user_id: athleteUserId,
      thread_id: sent.thread.thread_id,
      message_id: sent.message.message_id
    });
  }

  return Object.freeze({
    broadcast_id: broadcastId,
    sent_count: results.length,
    athlete_user_ids: results.map((entry) => entry.athlete_user_id),
    results: Object.freeze(results)
  });
}

export type OrgBroadcastReadStatusEntry = Readonly<{
  read: boolean;
  read_at_iso8601: string | null;
}>;

export type OrgCoachBroadcastReadStatus = Readonly<{
  broadcast_id: string;
  sent_count: number;
  read_count: number;
  coaches: readonly (OrgBroadcastReadStatusEntry & { coach_user_id: string })[];
}>;

export type OrgAthleteBroadcastReadStatus = Readonly<{
  broadcast_id: string;
  sent_count: number;
  read_count: number;
  athletes: readonly (OrgBroadcastReadStatusEntry & { athlete_user_id: string })[];
}>;

function requireBroadcastId(ownerUserIdInput: string, orgIdInput: string, broadcastIdInput: string): {
  ownerUserId: string;
  orgId: string;
  broadcastId: string;
} {
  const ownerUserId = cleanString(ownerUserIdInput);
  const orgId = cleanString(orgIdInput);
  const broadcastId = cleanString(broadcastIdInput);
  if (!ownerUserId || !orgId || !broadcastId) {
    throw new OrgBroadcastMessagingError("org_broadcast_messaging_broadcast_id_required");
  }
  return { ownerUserId, orgId, broadcastId };
}

// Re-derived live on every call, never stored/cached - matches
// coach_broadcast_messaging_service.ts's getBroadcastReadStatus exactly. A
// broadcast id that doesn't belong to this owner/org (wrong id, someone
// else's) simply resolves to zero rows, never a distinguishing error.
export async function getOrgCoachBroadcastReadStatus(
  ownerUserIdInput: string,
  orgIdInput: string,
  broadcastIdInput: string
): Promise<OrgCoachBroadcastReadStatus> {
  const { ownerUserId, orgId, broadcastId } = requireBroadcastId(ownerUserIdInput, orgIdInput, broadcastIdInput);

  const result = await pool.query(
    `
    SELECT m.created_at, t.coach_user_id, t.coach_last_read_at
    FROM product_messages m
    JOIN product_message_threads t ON t.thread_id = m.thread_id
    WHERE t.thread_type = 'org_owner_coach'
      AND t.org_id = $1
      AND m.sender_user_id = $2
      AND m.sender_role = 'org_owner'
      AND m.client_request_id = $3
    ORDER BY t.coach_user_id
    `,
    [orgId, ownerUserId, broadcastId]
  );

  const coaches = result.rows.map((row) => {
    const readAt = row.coach_last_read_at instanceof Date ? row.coach_last_read_at : null;
    const createdAt = row.created_at instanceof Date ? row.created_at : null;
    const read = Boolean(readAt && createdAt && readAt.getTime() >= createdAt.getTime());
    return Object.freeze({
      coach_user_id: cleanString(row.coach_user_id),
      read,
      read_at_iso8601: read && readAt ? readAt.toISOString() : null
    });
  });

  return Object.freeze({
    broadcast_id: broadcastId,
    sent_count: coaches.length,
    read_count: coaches.filter((entry) => entry.read).length,
    coaches: Object.freeze(coaches)
  });
}

export async function getOrgAthleteBroadcastReadStatus(
  ownerUserIdInput: string,
  orgIdInput: string,
  broadcastIdInput: string
): Promise<OrgAthleteBroadcastReadStatus> {
  const { ownerUserId, orgId, broadcastId } = requireBroadcastId(ownerUserIdInput, orgIdInput, broadcastIdInput);

  const result = await pool.query(
    `
    SELECT m.created_at, t.athlete_user_id, t.athlete_last_read_at
    FROM product_messages m
    JOIN product_message_threads t ON t.thread_id = m.thread_id
    WHERE t.thread_type = 'org_owner_athlete'
      AND t.org_id = $1
      AND m.sender_user_id = $2
      AND m.sender_role = 'org_owner'
      AND m.client_request_id = $3
    ORDER BY t.athlete_user_id
    `,
    [orgId, ownerUserId, broadcastId]
  );

  const athletes = result.rows.map((row) => {
    const readAt = row.athlete_last_read_at instanceof Date ? row.athlete_last_read_at : null;
    const createdAt = row.created_at instanceof Date ? row.created_at : null;
    const read = Boolean(readAt && createdAt && readAt.getTime() >= createdAt.getTime());
    return Object.freeze({
      athlete_user_id: cleanString(row.athlete_user_id),
      read,
      read_at_iso8601: read && readAt ? readAt.toISOString() : null
    });
  });

  return Object.freeze({
    broadcast_id: broadcastId,
    sent_count: athletes.length,
    read_count: athletes.filter((entry) => entry.read).length,
    athletes: Object.freeze(athletes)
  });
}
