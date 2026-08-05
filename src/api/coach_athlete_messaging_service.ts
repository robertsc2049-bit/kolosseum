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
}>;

function mapThreadRow(value: unknown): CoachAthleteThreadRow | null {
  if (!isRecord(value) || value.thread_type !== "coach_athlete") return null;
  const athleteUserId = cleanString(value.athlete_user_id);
  if (!athleteUserId) return null;

  return Object.freeze({
    thread_id: cleanString(value.thread_id),
    coach_user_id: cleanString(value.coach_user_id),
    athlete_user_id: athleteUserId,
    created_at_iso8601: value.created_at instanceof Date ? value.created_at.toISOString() : "",
    updated_at_iso8601: value.updated_at instanceof Date ? value.updated_at.toISOString() : ""
  });
}

export type CoachAthleteMessageRow = Readonly<{
  message_id: string;
  thread_id: string;
  sender_user_id: string;
  sender_role: "coach" | "athlete";
  body_text: string;
  created_at_iso8601: string;
}>;

function mapMessageRow(value: unknown): CoachAthleteMessageRow | null {
  if (!isRecord(value)) return null;
  const role = value.sender_role;
  if (role !== "coach" && role !== "athlete") return null;

  return Object.freeze({
    message_id: cleanString(value.message_id),
    thread_id: cleanString(value.thread_id),
    sender_user_id: cleanString(value.sender_user_id),
    sender_role: role,
    body_text: cleanString(value.body_text),
    created_at_iso8601: value.created_at instanceof Date ? value.created_at.toISOString() : ""
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
  clientRequestIdInput: unknown
): Promise<SentCoachAthleteMessage> {
  const coachUserId = senderRole === "coach" ? senderUserId : cleanString(peerUserId);
  const athleteUserId = senderRole === "athlete" ? senderUserId : cleanString(peerUserId);
  if (!coachUserId || !athleteUserId) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_peer_required", 400);
  }

  await requireAcceptedCoachAthleteRelationship(coachUserId, athleteUserId);

  const bodyText = cleanString(bodyTextInput);
  if (!bodyText || bodyText.length > 4000) {
    throw new CoachAthleteMessagingError("coach_athlete_messaging_body_text_invalid", 400);
  }
  const clientRequestId = cleanString(clientRequestIdInput) || randomId("msg_req");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const threadId = await findOrCreateThread(client, coachUserId, athleteUserId);

    const messageId = randomId("msg");
    await client.query(
      `
      INSERT INTO product_messages (message_id, thread_id, sender_user_id, sender_role, body_text, client_request_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (thread_id, sender_user_id, client_request_id) DO NOTHING
      `,
      [messageId, threadId, senderUserId, senderRole, bodyText, clientRequestId]
    );

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
    const message = mapMessageRow(messageRow.rows[0]);
    if (!thread || !message) throw new CoachAthleteMessagingError("coach_athlete_messaging_send_failed", 500);
    return Object.freeze({ thread, message });
  }
  catch (error) {
    await client.query("ROLLBACK");
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
  const result = await pool.query(
    `
    SELECT * FROM product_message_threads
    WHERE thread_type = 'coach_athlete' AND ${column} = $1
    ORDER BY updated_at DESC
    `,
    [userId]
  );
  return result.rows.map(mapThreadRow).filter((row): row is CoachAthleteThreadRow => row !== null);
}

export async function listCoachAthleteThreadMessages(
  threadId: string,
  userId: string,
  role: "coach" | "athlete"
): Promise<readonly CoachAthleteMessageRow[]> {
  await requireThreadAccessibleBy(threadId, userId, role);

  const result = await pool.query(
    `SELECT * FROM product_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
    [threadId]
  );
  return result.rows.map(mapMessageRow).filter((row): row is CoachAthleteMessageRow => row !== null);
}
