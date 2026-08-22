// DEV NOTE: Coach broadcast messaging. Sends the same message text into
// every one of a coach's currently-accepted individual athlete threads by
// calling sendCoachAthleteMessage once per athlete - there is no separate
// broadcast record type or delivery mechanism, only a fan-out over the
// same per-athlete send path (and its own accepted-relationship gate)
// that a coach's single-athlete message already goes through. The athlete
// list is resolved fresh from listConnectedCoachAthletes on every call,
// never client-supplied, so a coach can only ever broadcast to athletes
// who are accepted right now.
//
// Read-receipt grouping: every fan-out send in one broadcast is given the
// SAME server-generated client_request_id (never client-supplied) rather
// than each getting its own random one - safe, since sendCoachAthleteMessage's
// idempotency uniqueness is scoped to (thread_id, sender_user_id,
// client_request_id), and each fan-out send lands in a different thread.
// This turns that already-existing column into a free broadcast_id, with
// no new column and no new record type - getBroadcastReadStatus below just
// re-derives "read" per athlete from their thread's own athlete_last_read_at
// marker (added for FULL coach-athlete unread tracking), the same
// "never a stored/cached number" posture used throughout this codebase.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { listConnectedCoachAthletes } from "./beta19_coach_workspace_service.js";
import { sendCoachAthleteMessage } from "./coach_athlete_messaging_service.js";

type JsonRecord = Record<string, unknown>;

export class CoachBroadcastMessagingError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CoachBroadcastMessagingError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}

export async function sendCoachBroadcastMessage(
  coachUserIdInput: string,
  bodyTextInput: unknown
): Promise<Readonly<JsonRecord>> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new CoachBroadcastMessagingError("coach_broadcast_messaging_coach_required");
  }

  const bodyText = cleanString(bodyTextInput);
  if (!bodyText) {
    throw new CoachBroadcastMessagingError("coach_broadcast_messaging_body_text_invalid");
  }
  if (bodyText.length > 4000) {
    throw new CoachBroadcastMessagingError("coach_broadcast_messaging_body_text_invalid");
  }

  const athletes = await listConnectedCoachAthletes(coachUserId);
  const broadcastId = randomId("broadcast");

  const results: JsonRecord[] = [];
  for (const athlete of athletes) {
    const athleteUserId = cleanString(athlete.athlete_user_id);
    const sent = await sendCoachAthleteMessage("coach", coachUserId, athleteUserId, bodyText, broadcastId, null);
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

export type BroadcastReadStatusEntry = Readonly<{
  athlete_user_id: string;
  read: boolean;
  read_at_iso8601: string | null;
}>;

export type BroadcastReadStatus = Readonly<{
  broadcast_id: string;
  sent_count: number;
  read_count: number;
  athletes: readonly BroadcastReadStatusEntry[];
}>;

// Re-derived live on every call, never stored/cached - matches every other
// unread/read-state query in this codebase. A broadcast this coach never
// actually sent (wrong id, or one of someone else's) simply resolves to
// zero rows, never a distinguishing error - the same "quiet empty over
// access-denied for a structural non-match" posture already used elsewhere.
export async function getBroadcastReadStatus(
  coachUserIdInput: string,
  broadcastIdInput: string
): Promise<BroadcastReadStatus> {
  const coachUserId = cleanString(coachUserIdInput);
  const broadcastId = cleanString(broadcastIdInput);
  if (!coachUserId || !broadcastId) {
    throw new CoachBroadcastMessagingError("coach_broadcast_messaging_broadcast_id_required");
  }

  const result = await pool.query(
    `
    SELECT m.created_at, t.athlete_user_id, t.athlete_last_read_at
    FROM product_messages m
    JOIN product_message_threads t ON t.thread_id = m.thread_id
    WHERE t.thread_type = 'coach_athlete'
      AND t.coach_user_id = $1
      AND m.sender_user_id = $1
      AND m.sender_role = 'coach'
      AND m.client_request_id = $2
    ORDER BY t.athlete_user_id
    `,
    [coachUserId, broadcastId]
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
