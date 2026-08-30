// DEV NOTE: Attendance events (slice 1) - invite fan-out. One
// attendance_event_invite row per (event_id, athlete_user_id), written
// ONCE at series-creation time (never per-occurrence - a large recurring
// series would otherwise mean hundreds of placeholder rows just to
// represent "invited"). This is the roster attendance_event_rsvp_
// service.ts's RSVP reads/writes are validated against, and the thing a
// future attendance_event_invited notification (slice 5) keys off.
//
// actor_user_id/subject_user_id convention (deliberately not "whoever
// clicked"): mirrors beta17_coach_relationship's own convention, where
// the coach stays actor_user_id even for a transition the athlete
// performs. Here, actor_user_id is always the organizer (the coach who
// created the event), subject_user_id is always the invited athlete -
// this keeps the organizer's own roster read
// (actor_user_id = organizerId AND record_payload->>'event_id' = eventId)
// on the same selective, indexed pattern beta19_event_athlete_link
// already uses, while the athlete's own read
// (subject_user_id = athleteId) stays on the existing
// idx_beta_product_records_subject_type_effective index either way.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { persistBetaProductRecord } from "./beta_product_record_store.js";
import { listConnectedCoachAthletes } from "./beta19_coach_workspace_service.js";
import { AttendanceEventError, loadAttendanceEventRecord } from "./attendance_event_service.js";
import { assertOrgAthletesCurrentlyAccepted } from "./attendance_event_org_invite_service.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (isRecord(value)) {
    const output: JsonRecord = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalise(value[key]);
    }
    return output;
  }
  return value;
}

function sha256(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalise(value)), "utf8").digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function writeInviteVersion(input: Readonly<{
  invite_id: string;
  event_id: string;
  athlete_user_id: string;
  organizer_user_id: string;
  invite_state: "invited" | "revoked";
  created_at_iso8601: string;
  updated_at_iso8601: string;
}>): Promise<Readonly<JsonRecord>> {
  const recordWithoutHash = {
    record_type: "attendance_event_invite" as const,
    invite_id: input.invite_id,
    event_id: input.event_id,
    athlete_user_id: input.athlete_user_id,
    organizer_user_id: input.organizer_user_id,
    invite_state: input.invite_state,
    created_at_iso8601: input.created_at_iso8601,
    updated_at_iso8601: input.updated_at_iso8601,
    engine_visible: false as const
  };

  const record = deepFreeze({ ...recordWithoutHash, record_sha256: sha256(recordWithoutHash) });
  return persistBetaProductRecord(record);
}

export async function listInvitesForEvent(eventId: string): Promise<readonly Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_id, record_payload
    FROM beta_product_records
    WHERE record_type = 'attendance_event_invite' AND record_payload ->> 'event_id' = $1
    ORDER BY record_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `,
    [eventId]
  );
  return result.rows
    .map((row) => (isRecord(row.record_payload) ? row.record_payload : null))
    .filter((invite): invite is JsonRecord => invite !== null);
}

export async function loadInviteForEventAndAthlete(
  eventId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord> | null> {
  const invites = await listInvitesForEvent(eventId);
  return invites.find((invite) => cleanString(invite.athlete_user_id) === athleteUserId) ?? null;
}

// Exposed so the route layer can validate a requested invite list is
// fully eligible BEFORE creating the event record itself - creating the
// event first and only discovering an invalid invite list afterward
// would leave an orphaned, invite-less event behind despite the caller
// receiving an error response. inviteAthletesToAttendanceEvent below
// still independently re-validates too (real defense in depth against a
// relationship changing state between this pre-check and the write),
// matching this codebase's established per-athlete re-validation
// convention (see getProgressInsightsForCoachRoster's own DEV NOTE).
export async function assertAthletesCurrentlyAccepted(
  coachUserIdInput: string,
  athleteUserIdsInput: unknown
): Promise<readonly string[]> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new AttendanceEventError("event_identity_required");
  }

  if (!Array.isArray(athleteUserIdsInput) || athleteUserIdsInput.length === 0) {
    throw new AttendanceEventError("invite_athlete_ids_required");
  }
  const requestedAthleteIds = [...new Set(athleteUserIdsInput.map((value) => cleanString(value)).filter(Boolean))];
  if (requestedAthleteIds.length === 0) {
    throw new AttendanceEventError("invite_athlete_ids_required");
  }

  const accepted = await listConnectedCoachAthletes(coachUserId);
  const acceptedIds = new Set(accepted.map((athlete) => cleanString(athlete.athlete_user_id)));
  for (const athleteId of requestedAthleteIds) {
    if (!acceptedIds.has(athleteId)) {
      throw new AttendanceEventError("invite_athlete_not_accepted", 403);
    }
  }

  return Object.freeze(requestedAthleteIds);
}

// Coach action: invite a chosen subset of the coach's own currently-
// accepted athletes to an event they own. The live accepted-athlete list
// is resolved fresh (never client-supplied) via listConnectedCoachAthletes
// - the same authorized building block the coach roster progress rollup
// already reuses - so a coach can only ever invite athletes accepted
// right now.
export async function inviteAthletesToAttendanceEvent(
  coachUserIdInput: string,
  eventIdInput: unknown,
  athleteUserIdsInput: unknown
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId = cleanString(coachUserIdInput);
  const eventId = cleanString(eventIdInput);
  if (!coachUserId || !eventId) {
    throw new AttendanceEventError("event_identity_required");
  }

  const event = await loadAttendanceEventRecord(eventId);
  if (!event || cleanString(event.owner_coach_user_id) !== coachUserId) {
    throw new AttendanceEventError("event_not_found", 404);
  }
  if (event.status === "cancelled") {
    throw new AttendanceEventError("event_cancelled", 409);
  }

  const requestedAthleteIds = event.owner_scope === "org"
    ? await assertOrgAthletesCurrentlyAccepted(coachUserId, event.owner_org_id, athleteUserIdsInput)
    : await assertAthletesCurrentlyAccepted(coachUserId, athleteUserIdsInput);

  const timestamp = new Date().toISOString();
  const invites: Readonly<JsonRecord>[] = [];
  for (const athleteId of requestedAthleteIds) {
    invites.push(await writeInviteVersion({
      invite_id: randomId("attendance_invite"),
      event_id: eventId,
      athlete_user_id: athleteId,
      organizer_user_id: coachUserId,
      invite_state: "invited",
      created_at_iso8601: timestamp,
      updated_at_iso8601: timestamp
    }));
  }

  return Object.freeze(invites);
}

// Athlete action: list every event this athlete currently holds an
// "invited" invite for, across every coach - the athlete's own identity
// comes only from the caller's resolved session (see the route layer),
// never a client-supplied id.
export async function listAttendanceInvitesForAthlete(
  athleteUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const athleteUserId = cleanString(athleteUserIdInput);
  if (!athleteUserId) {
    throw new AttendanceEventError("athlete_identity_required", 401);
  }

  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_id, record_payload
    FROM beta_product_records
    WHERE record_type = 'attendance_event_invite' AND subject_user_id = $1
    ORDER BY record_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `,
    [athleteUserId]
  );

  return result.rows
    .map((row) => (isRecord(row.record_payload) ? row.record_payload : null))
    .filter((invite): invite is JsonRecord => invite !== null && invite.invite_state === "invited");
}
