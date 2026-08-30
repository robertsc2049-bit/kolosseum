// DEV NOTE: Attendance events (slice 1) - RSVP read/write and the two
// "my events" views (organizer roster, athlete's own invited events).
// attendance_event_rsvp is written ONLY when an athlete actually
// responds (attending | maybe | not_attending) - absence of a row means
// no response yet, mirroring the beta17_coach_relationship convention
// where "pending" is the absence of an accept/decline record, never a
// stored state of its own.
//
// actor_user_id/subject_user_id convention: organizer_user_id stays
// actor_user_id even though the athlete is the one submitting the RSVP -
// see attendance_event_invite_service.ts's DEV NOTE for the full
// reasoning (mirrors beta17_coach_relationship's identical choice).

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { loadLatestBetaProductRecord, persistBetaProductRecord } from "./beta_product_record_store.js";
import {
  AttendanceEventError,
  loadAttendanceEventRecord,
  loadAttendanceOccurrenceRecord,
  loadAttendanceOccurrenceRecords
} from "./attendance_event_service.js";
import { listInvitesForEvent, loadInviteForEventAndAthlete, listAttendanceInvitesForAthlete } from "./attendance_event_invite_service.js";

type JsonRecord = Record<string, unknown>;

const RSVP_STATES = new Set(["attending", "maybe", "not_attending"]);

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

async function latestRsvpRecord(occurrenceId: string, athleteUserId: string): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'attendance_event_rsvp'
      AND record_payload ->> 'occurrence_id' = $1
      AND subject_user_id = $2
    ORDER BY effective_at DESC, created_at DESC, record_sha256 DESC
    LIMIT 1
    `,
    [occurrenceId, athleteUserId]
  );
  const row = result.rows[0];
  return row && isRecord(row.record_payload) ? row.record_payload : null;
}

async function latestRsvpsForOccurrence(occurrenceId: string): Promise<readonly Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (subject_user_id) subject_user_id, record_payload
    FROM beta_product_records
    WHERE record_type = 'attendance_event_rsvp' AND record_payload ->> 'occurrence_id' = $1
    ORDER BY subject_user_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `,
    [occurrenceId]
  );
  return result.rows
    .map((row) => (isRecord(row.record_payload) ? row.record_payload : null))
    .filter((rsvp): rsvp is JsonRecord => rsvp !== null);
}

// Athlete action: respond to one occurrence of an event they were
// actually invited to. Re-validated server-side every time - an
// occurrence_id alone is never trusted to imply a valid invite, and a
// non-"scheduled" (skipped) occurrence can never be RSVP'd to.
export async function submitAttendanceRsvp(
  athleteUserIdInput: string,
  occurrenceIdInput: unknown,
  rsvpStateInput: unknown
): Promise<Readonly<JsonRecord>> {
  const athleteUserId = cleanString(athleteUserIdInput);
  const occurrenceId = cleanString(occurrenceIdInput);
  const rsvpState = cleanString(rsvpStateInput);

  if (!athleteUserId) {
    throw new AttendanceEventError("athlete_identity_required", 401);
  }
  if (!occurrenceId) {
    throw new AttendanceEventError("occurrence_identity_required");
  }
  if (!RSVP_STATES.has(rsvpState)) {
    throw new AttendanceEventError("rsvp_state_invalid");
  }

  const occurrence = await loadAttendanceOccurrenceRecord(occurrenceId);
  if (!occurrence || occurrence.status !== "scheduled") {
    throw new AttendanceEventError("occurrence_not_available", 404);
  }

  const eventId = cleanString(occurrence.event_id);
  const event = await loadAttendanceEventRecord(eventId);
  if (!event || event.status === "cancelled") {
    throw new AttendanceEventError("event_not_available", 404);
  }

  const invite = await loadInviteForEventAndAthlete(eventId, athleteUserId);
  if (!invite || invite.invite_state !== "invited") {
    throw new AttendanceEventError("not_invited", 403);
  }

  const recordWithoutHash = {
    record_type: "attendance_event_rsvp" as const,
    rsvp_id: randomId("attendance_rsvp"),
    occurrence_id: occurrenceId,
    event_id: eventId,
    athlete_user_id: athleteUserId,
    organizer_user_id: cleanString(event.owner_coach_user_id),
    rsvp_state: rsvpState as "attending" | "maybe" | "not_attending",
    responded_at_iso8601: new Date().toISOString(),
    engine_visible: false as const
  };

  const record = deepFreeze({ ...recordWithoutHash, record_sha256: sha256(recordWithoutHash) });
  return persistBetaProductRecord(record);
}

async function withAthleteDisplay(athleteUserId: string): Promise<Readonly<{ display_name: string; email: string | null }>> {
  // A failure loading one athlete's auth record must never take down the
  // entire roster read - mirrors the identical resilience pattern already
  // used by org_visibility_service.ts's fullRosterForOrg().
  try {
    const auth = await loadLatestBetaProductRecord("beta16_auth", athleteUserId, athleteUserId);
    return Object.freeze({
      display_name: cleanString(auth?.display_name) || athleteUserId,
      email: cleanString(auth?.email) || null
    });
  }
  catch {
    return Object.freeze({ display_name: athleteUserId, email: null });
  }
}

export type AttendanceRosterEntry = Readonly<{
  athlete_user_id: string;
  display_name: string;
  email: string | null;
  invite_state: string;
  rsvp_by_occurrence: Readonly<Record<string, string | null>>;
}>;

// Organizer action: the full invited roster for an event, each athlete's
// current RSVP state per occurrence. Ownership of the event is verified
// by the caller (routes layer) before this is ever invoked.
export async function getAttendanceRosterForEvent(
  eventId: string
): Promise<readonly AttendanceRosterEntry[]> {
  const [invites, occurrences] = await Promise.all([
    listInvitesForEvent(eventId),
    loadAttendanceOccurrenceRecords(eventId)
  ]);

  const invited = invites.filter((invite) => invite.invite_state === "invited");

  return Promise.all(
    invited.map(async (invite) => {
      const athleteUserId = cleanString(invite.athlete_user_id);
      const display = await withAthleteDisplay(athleteUserId);

      const rsvpByOccurrence: Record<string, string | null> = {};
      for (const occurrence of occurrences) {
        const occurrenceId = cleanString(occurrence.occurrence_id);
        const rsvp = await latestRsvpRecord(occurrenceId, athleteUserId);
        rsvpByOccurrence[occurrenceId] = rsvp ? cleanString(rsvp.rsvp_state) : null;
      }

      return Object.freeze({
        athlete_user_id: athleteUserId,
        display_name: display.display_name,
        email: display.email,
        invite_state: cleanString(invite.invite_state),
        rsvp_by_occurrence: Object.freeze(rsvpByOccurrence)
      });
    })
  );
}

export type MyAttendanceOccurrence = Readonly<{
  event_id: string;
  title: string;
  description: string;
  location: string;
  activity_label: string;
  timezone: string;
  occurrence_id: string;
  occurrence_date: string;
  start_time: string | null;
  end_time: string | null;
  my_rsvp_state: string | null;
}>;

// Athlete action: every scheduled occurrence this athlete is currently
// invited to, across every organizing coach, with their own current RSVP
// state (null = no response yet).
export async function listMyAttendanceOccurrences(
  athleteUserIdInput: string
): Promise<readonly MyAttendanceOccurrence[]> {
  const athleteUserId = cleanString(athleteUserIdInput);
  if (!athleteUserId) {
    throw new AttendanceEventError("athlete_identity_required", 401);
  }

  const invites = await listAttendanceInvitesForAthlete(athleteUserId);
  const results: MyAttendanceOccurrence[] = [];

  for (const invite of invites) {
    const eventId = cleanString(invite.event_id);
    const event = await loadAttendanceEventRecord(eventId);
    if (!event || event.status === "cancelled") continue;

    const occurrences = await loadAttendanceOccurrenceRecords(eventId);
    for (const occurrence of occurrences) {
      if (occurrence.status !== "scheduled") continue;
      const occurrenceId = cleanString(occurrence.occurrence_id);
      const rsvp = await latestRsvpRecord(occurrenceId, athleteUserId);

      results.push(Object.freeze({
        event_id: eventId,
        title: cleanString(event.title),
        description: cleanString(event.description),
        location: cleanString(event.location),
        activity_label: cleanString(event.activity_label),
        timezone: cleanString(event.timezone),
        occurrence_id: occurrenceId,
        occurrence_date: cleanString(occurrence.occurrence_date),
        start_time: cleanString(occurrence.start_time) || null,
        end_time: cleanString(occurrence.end_time) || null,
        my_rsvp_state: rsvp ? cleanString(rsvp.rsvp_state) : null
      }));
    }
  }

  return Object.freeze(results.sort((left, right) => left.occurrence_date.localeCompare(right.occurrence_date)));
}

// Exposed for potential future reuse (e.g. slice 5 notification
// derivation may want raw per-occurrence RSVP rows rather than the
// per-athlete rollup above).
export async function loadRsvpsForOccurrence(occurrenceId: string): Promise<readonly Readonly<JsonRecord>[]> {
  return latestRsvpsForOccurrence(occurrenceId);
}
