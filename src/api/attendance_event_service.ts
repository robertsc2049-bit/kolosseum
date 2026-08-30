// DEV NOTE: Attendance events (slice 1) - a coach creates a real calendar
// commitment (a class, practice or session, with actual start/end times)
// that invited athletes RSVP to. This is a DIFFERENT, unrelated concept
// from beta19_coach_event/beta19_event_athlete_link (a single-date, no-
// time-of-day competition/target date used to periodize a training
// block, with no athlete response state) - this file never touches that
// system's files, routes, or record types. Two record types live here:
// attendance_event (the series/definition - descriptive fields only, no
// date/time, so it never drifts from its own occurrences) and
// attendance_event_occurrence (one row per computed date, carrying the
// actual scheduling: date, start/end time, status). Both are append-only
// JSONB facts in beta_product_records, "current" state = latest by
// effective_at (matching every other record type in this file family) -
// see beta_product_record_store.ts for the fixed record-type allowlist
// this feature was added to.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";

type JsonRecord = Record<string, unknown>;

export class AttendanceEventError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`attendance_event_${reason}`);
    this.name = "AttendanceEventError";
    this.status = status;
  }
}

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

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

function isTimeOnly(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value);
}

async function requireActiveCoachProfile(coachUserId: string): Promise<void> {
  const profile = await loadLatestBetaProductRecord("beta17_coach_profile", coachUserId, coachUserId);
  if (!profile || profile.account_role !== "coach" || profile.account_state !== "active") {
    throw new AttendanceEventError("coach_not_active", 403);
  }
}

async function latestEventRecord(eventId: string): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE record_type = 'attendance_event' AND record_id = $1
    ORDER BY effective_at DESC, created_at DESC, record_sha256 DESC
    LIMIT 1
    `,
    [eventId]
  );
  const row = result.rows[0];
  return row && isRecord(row.record_payload) ? row.record_payload : null;
}

async function latestOccurrenceRecords(eventId: string): Promise<readonly Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_id, record_payload
    FROM beta_product_records
    WHERE record_type = 'attendance_event_occurrence' AND record_payload ->> 'event_id' = $1
    ORDER BY record_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `,
    [eventId]
  );
  return result.rows
    .map((row) => (isRecord(row.record_payload) ? row.record_payload : null))
    .filter((occurrence): occurrence is JsonRecord => occurrence !== null)
    .sort((left, right) => cleanString(left.occurrence_date).localeCompare(cleanString(right.occurrence_date)));
}

async function latestOccurrenceRecord(occurrenceId: string): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE record_type = 'attendance_event_occurrence' AND record_id = $1
    ORDER BY effective_at DESC, created_at DESC, record_sha256 DESC
    LIMIT 1
    `,
    [occurrenceId]
  );
  const row = result.rows[0];
  return row && isRecord(row.record_payload) ? row.record_payload : null;
}

async function writeEventVersion(input: Readonly<{
  event_id: string;
  owner_scope: "coach" | "org";
  owner_coach_user_id: string;
  owner_org_id: string | null;
  title: string;
  description: string;
  location: string;
  activity_label: string;
  timezone: string;
  recurrence_rule: JsonRecord | null;
  status: "active" | "cancelled";
  created_at_iso8601: string;
  updated_at_iso8601: string;
}>): Promise<Readonly<JsonRecord>> {
  const recordWithoutHash = {
    record_type: "attendance_event" as const,
    event_id: input.event_id,
    owner_scope: input.owner_scope,
    owner_coach_user_id: input.owner_coach_user_id,
    owner_org_id: input.owner_org_id,
    title: input.title,
    description: input.description,
    location: input.location,
    activity_label: input.activity_label,
    timezone: input.timezone,
    recurrence_rule: input.recurrence_rule,
    status: input.status,
    created_at_iso8601: input.created_at_iso8601,
    updated_at_iso8601: input.updated_at_iso8601,
    engine_visible: false as const
  };

  const record = deepFreeze({ ...recordWithoutHash, record_sha256: sha256(recordWithoutHash) });
  return persistBetaProductRecord(record);
}

async function writeOccurrenceVersion(input: Readonly<{
  occurrence_id: string;
  event_id: string;
  owner_coach_user_id: string;
  occurrence_date: string;
  start_time: string | null;
  end_time: string | null;
  status: "scheduled" | "skipped" | "rescheduled";
  rescheduled_to_date: string | null;
  rescheduled_to_start_time: string | null;
  rescheduled_to_end_time: string | null;
  created_at_iso8601: string;
  updated_at_iso8601: string;
}>): Promise<Readonly<JsonRecord>> {
  const recordWithoutHash = {
    record_type: "attendance_event_occurrence" as const,
    occurrence_id: input.occurrence_id,
    event_id: input.event_id,
    owner_coach_user_id: input.owner_coach_user_id,
    occurrence_date: input.occurrence_date,
    start_time: input.start_time,
    end_time: input.end_time,
    status: input.status,
    rescheduled_to_date: input.rescheduled_to_date,
    rescheduled_to_start_time: input.rescheduled_to_start_time,
    rescheduled_to_end_time: input.rescheduled_to_end_time,
    created_at_iso8601: input.created_at_iso8601,
    updated_at_iso8601: input.updated_at_iso8601,
    engine_visible: false as const
  };

  const record = deepFreeze({ ...recordWithoutHash, record_sha256: sha256(recordWithoutHash) });
  return persistBetaProductRecord(record);
}

type CreateAttendanceEventInput = Readonly<{
  title?: unknown;
  description?: unknown;
  location?: unknown;
  activity_label?: unknown;
  timezone?: unknown;
  occurrence_date?: unknown;
  start_time?: unknown;
  end_time?: unknown;
}>;

function validateCreateInput(input: CreateAttendanceEventInput): Readonly<{
  title: string;
  description: string;
  location: string;
  activity_label: string;
  timezone: string;
  occurrence_date: string;
  start_time: string | null;
  end_time: string | null;
}> {
  const title = cleanString(input.title);
  if (!title || title.length > 120) {
    throw new AttendanceEventError("title_invalid");
  }

  const description = cleanString(input.description);
  if (description.length > 1000) {
    throw new AttendanceEventError("description_invalid");
  }

  const location = cleanString(input.location);
  if (location.length > 200) {
    throw new AttendanceEventError("location_invalid");
  }

  const activityLabel = cleanString(input.activity_label);
  if (activityLabel.length > 80) {
    throw new AttendanceEventError("activity_label_invalid");
  }

  const timezone = cleanString(input.timezone) || "Europe/London";
  if (timezone.length > 80) {
    throw new AttendanceEventError("timezone_invalid");
  }

  if (!isDateOnly(input.occurrence_date)) {
    throw new AttendanceEventError("occurrence_date_invalid");
  }

  const startTime = input.start_time === null || input.start_time === undefined ? null : input.start_time;
  const endTime = input.end_time === null || input.end_time === undefined ? null : input.end_time;
  if (startTime !== null && !isTimeOnly(startTime)) {
    throw new AttendanceEventError("start_time_invalid");
  }
  if (endTime !== null && !isTimeOnly(endTime)) {
    throw new AttendanceEventError("end_time_invalid");
  }
  if (startTime !== null && endTime !== null && endTime <= startTime) {
    throw new AttendanceEventError("end_time_before_start_time");
  }

  return {
    title,
    description,
    location,
    activity_label: activityLabel,
    timezone,
    occurrence_date: input.occurrence_date,
    start_time: startTime as string | null,
    end_time: endTime as string | null
  };
}

export type AttendanceEventWithOccurrences = Readonly<{
  event: Readonly<JsonRecord>;
  occurrences: readonly Readonly<JsonRecord>[];
}>;

// Slice 1: a coach creates a single (non-recurring) event for their own
// roster. recurrence_rule is always null here - slice 2 adds the
// recurrence input and multi-occurrence materialization on top of this
// same data model without changing its shape.
export async function createAttendanceEventForCoach(
  coachUserIdInput: string,
  input: CreateAttendanceEventInput
): Promise<AttendanceEventWithOccurrences> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new AttendanceEventError("coach_identity_required", 401);
  }
  await requireActiveCoachProfile(coachUserId);

  const validated = validateCreateInput(input);
  const timestamp = new Date().toISOString();
  const eventId = randomId("attendance_event");
  const occurrenceId = randomId("attendance_occurrence");

  const event = await writeEventVersion({
    event_id: eventId,
    owner_scope: "coach",
    owner_coach_user_id: coachUserId,
    owner_org_id: null,
    title: validated.title,
    description: validated.description,
    location: validated.location,
    activity_label: validated.activity_label,
    timezone: validated.timezone,
    recurrence_rule: null,
    status: "active",
    created_at_iso8601: timestamp,
    updated_at_iso8601: timestamp
  });

  const occurrence = await writeOccurrenceVersion({
    occurrence_id: occurrenceId,
    event_id: eventId,
    owner_coach_user_id: coachUserId,
    occurrence_date: validated.occurrence_date,
    start_time: validated.start_time,
    end_time: validated.end_time,
    status: "scheduled",
    rescheduled_to_date: null,
    rescheduled_to_start_time: null,
    rescheduled_to_end_time: null,
    created_at_iso8601: timestamp,
    updated_at_iso8601: timestamp
  });

  return Object.freeze({ event, occurrences: Object.freeze([occurrence]) });
}

export async function cancelAttendanceEvent(
  coachUserIdInput: string,
  eventIdInput: unknown
): Promise<Readonly<JsonRecord>> {
  const coachUserId = cleanString(coachUserIdInput);
  const eventId = cleanString(eventIdInput);
  if (!coachUserId || !eventId) {
    throw new AttendanceEventError("event_identity_required");
  }

  const current = await latestEventRecord(eventId);
  if (!current || cleanString(current.owner_coach_user_id) !== coachUserId) {
    throw new AttendanceEventError("event_not_found", 404);
  }
  if (current.status === "cancelled") {
    throw new AttendanceEventError("event_already_cancelled", 409);
  }

  const timestamp = new Date().toISOString();
  return writeEventVersion({
    event_id: eventId,
    owner_scope: current.owner_scope === "org" ? "org" : "coach",
    owner_coach_user_id: cleanString(current.owner_coach_user_id),
    owner_org_id: cleanString(current.owner_org_id) || null,
    title: cleanString(current.title),
    description: cleanString(current.description),
    location: cleanString(current.location),
    activity_label: cleanString(current.activity_label),
    timezone: cleanString(current.timezone),
    recurrence_rule: isRecord(current.recurrence_rule) ? current.recurrence_rule : null,
    status: "cancelled",
    created_at_iso8601: cleanString(current.created_at_iso8601) || timestamp,
    updated_at_iso8601: timestamp
  });
}

export async function listAttendanceEventsForCoach(
  coachUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new AttendanceEventError("coach_identity_required", 401);
  }

  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_id, record_payload
    FROM beta_product_records
    WHERE record_type = 'attendance_event' AND actor_user_id = $1
    ORDER BY record_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `,
    [coachUserId]
  );

  return result.rows
    .map((row) => (isRecord(row.record_payload) ? row.record_payload : null))
    .filter((event): event is JsonRecord => event !== null)
    .sort((left, right) => cleanString(right.updated_at_iso8601).localeCompare(cleanString(left.updated_at_iso8601)));
}

export async function getAttendanceEventForCoach(
  coachUserIdInput: string,
  eventIdInput: unknown
): Promise<AttendanceEventWithOccurrences> {
  const coachUserId = cleanString(coachUserIdInput);
  const eventId = cleanString(eventIdInput);
  if (!coachUserId || !eventId) {
    throw new AttendanceEventError("event_identity_required");
  }

  const event = await latestEventRecord(eventId);
  if (!event || cleanString(event.owner_coach_user_id) !== coachUserId) {
    throw new AttendanceEventError("event_not_found", 404);
  }

  const occurrences = await latestOccurrenceRecords(eventId);
  return Object.freeze({ event, occurrences });
}

// Exposed for the invite/rsvp services, which validate an occurrence
// belongs to the event a caller is invited to / organizing before
// accepting any action against it - never trusting a client-supplied
// event_id/occurrence_id pairing on its own.
export async function loadAttendanceEventRecord(eventId: string): Promise<Readonly<JsonRecord> | null> {
  return latestEventRecord(eventId);
}

export async function loadAttendanceOccurrenceRecord(occurrenceId: string): Promise<Readonly<JsonRecord> | null> {
  return latestOccurrenceRecord(occurrenceId);
}

export async function loadAttendanceOccurrenceRecords(eventId: string): Promise<readonly Readonly<JsonRecord>[]> {
  return latestOccurrenceRecords(eventId);
}
