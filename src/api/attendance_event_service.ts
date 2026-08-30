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

// Occurrences are materialized upfront at creation time (never lazily
// expanded on read) - this cap is a hard reject, never a silent
// truncation, so a coach never ends up with a series shorter than what
// they asked for. 200 gives real headroom over a common worst case
// (weekly for 2 years ~= 104 occurrences) without being pathological.
const ATTENDANCE_OCCURRENCE_CAP = 200;

const WEEKDAY_TOKENS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function weekdayTokenToIndex(token: string): number {
  return WEEKDAY_TOKENS.indexOf(token as (typeof WEEKDAY_TOKENS)[number]);
}

type RecurrenceEnds =
  | Readonly<{ type: "on_date"; value: string }>
  | Readonly<{ type: "after_count"; value: number }>;

type RecurrenceRule = Readonly<{
  frequency: "daily" | "weekly";
  interval: number;
  weekdays: readonly string[];
  ends: RecurrenceEnds;
}>;

// Full recurrence rules (weekdays + interval + end-date-or-count),
// deliberately hand-rolled - there is no RRULE library anywhere in this
// codebase, and every other domain date is a plain JSONB string, not a
// typed date column, so this stays consistent with that.
function validateRecurrenceRule(raw: unknown, anchorDate: string): RecurrenceRule | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) {
    throw new AttendanceEventError("recurrence_rule_invalid");
  }

  if (raw.frequency !== "daily" && raw.frequency !== "weekly") {
    throw new AttendanceEventError("recurrence_frequency_invalid");
  }
  const frequency = raw.frequency;

  if (!Number.isInteger(raw.interval) || (raw.interval as number) < 1 || (raw.interval as number) > 52) {
    throw new AttendanceEventError("recurrence_interval_invalid");
  }
  const interval = raw.interval as number;

  let weekdays: string[] = [];
  if (frequency === "weekly") {
    if (!Array.isArray(raw.weekdays) || raw.weekdays.length === 0) {
      throw new AttendanceEventError("recurrence_weekdays_required");
    }
    weekdays = [...new Set(raw.weekdays.map((value) => cleanString(value).toLowerCase()))];
    if (weekdays.some((token) => weekdayTokenToIndex(token) === -1)) {
      throw new AttendanceEventError("recurrence_weekdays_invalid");
    }
    const anchorToken = WEEKDAY_TOKENS[new Date(`${anchorDate}T00:00:00.000Z`).getUTCDay()];
    if (!weekdays.includes(anchorToken)) {
      throw new AttendanceEventError("recurrence_start_date_weekday_mismatch");
    }
  }
  else if (Array.isArray(raw.weekdays) && raw.weekdays.length > 0) {
    throw new AttendanceEventError("recurrence_weekdays_not_allowed_for_daily");
  }

  if (!isRecord(raw.ends)) {
    throw new AttendanceEventError("recurrence_ends_invalid");
  }
  if (raw.ends.type === "on_date") {
    if (!isDateOnly(raw.ends.value) || raw.ends.value < anchorDate) {
      throw new AttendanceEventError("recurrence_ends_on_date_invalid");
    }
    return Object.freeze({
      frequency,
      interval,
      weekdays: Object.freeze(weekdays),
      ends: Object.freeze({ type: "on_date" as const, value: raw.ends.value })
    });
  }
  if (raw.ends.type === "after_count") {
    const count = raw.ends.value;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > ATTENDANCE_OCCURRENCE_CAP) {
      throw new AttendanceEventError("recurrence_ends_after_count_invalid");
    }
    return Object.freeze({
      frequency,
      interval,
      weekdays: Object.freeze(weekdays),
      ends: Object.freeze({ type: "after_count" as const, value: count })
    });
  }
  throw new AttendanceEventError("recurrence_ends_invalid");
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Deterministic occurrence-date generation from a validated recurrence
// rule. Every branch either terminates on a finite, already-validated
// bound (an after_count value capped at ATTENDANCE_OCCURRENCE_CAP, or a
// fixed end date) or throws before the occurrence count can exceed the
// cap - this never silently truncates a series short of what was asked.
function generateOccurrenceDates(anchorDate: string, rule: RecurrenceRule | null): readonly string[] {
  if (rule === null) return Object.freeze([anchorDate]);

  const anchor = new Date(`${anchorDate}T00:00:00.000Z`);
  const dates: string[] = [];

  if (rule.frequency === "daily") {
    const endDate = rule.ends.type === "on_date" ? new Date(`${rule.ends.value}T00:00:00.000Z`) : null;
    let cursor = anchor;
    while (true) {
      if (rule.ends.type === "after_count" && dates.length >= rule.ends.value) break;
      if (endDate !== null && cursor.getTime() > endDate.getTime()) break;
      dates.push(toDateOnly(cursor));
      if (dates.length > ATTENDANCE_OCCURRENCE_CAP) {
        throw new AttendanceEventError("recurrence_occurrence_cap_exceeded");
      }
      cursor = new Date(cursor.getTime() + rule.interval * 24 * 60 * 60 * 1000);
    }
    return Object.freeze(dates);
  }

  const weekdayIndexes = [...new Set(rule.weekdays.map((token) => weekdayTokenToIndex(token)))].sort((left, right) => left - right);
  const anchorWeekStart = new Date(anchor.getTime() - anchor.getUTCDay() * 24 * 60 * 60 * 1000);
  const endDate = rule.ends.type === "on_date" ? new Date(`${rule.ends.value}T00:00:00.000Z`) : null;

  let weekIndex = 0;
  outer:
  while (true) {
    // Defense in depth against a logic bug above - every real
    // termination path is already bounded (an after_count value capped
    // at ATTENDANCE_OCCURRENCE_CAP, or a fixed end date a finite number
    // of weeks away), so this should never actually trip.
    if (weekIndex > ATTENDANCE_OCCURRENCE_CAP * 8) {
      throw new AttendanceEventError("recurrence_occurrence_cap_exceeded");
    }

    const weekStart = new Date(anchorWeekStart.getTime() + weekIndex * rule.interval * 7 * 24 * 60 * 60 * 1000);
    if (endDate !== null && weekStart.getTime() > endDate.getTime()) break;

    for (const weekdayIndex of weekdayIndexes) {
      const date = new Date(weekStart.getTime() + weekdayIndex * 24 * 60 * 60 * 1000);
      if (date.getTime() < anchor.getTime()) continue;
      if (endDate !== null && date.getTime() > endDate.getTime()) continue;
      if (rule.ends.type === "after_count" && dates.length >= rule.ends.value) break outer;
      dates.push(toDateOnly(date));
      if (dates.length > ATTENDANCE_OCCURRENCE_CAP) {
        throw new AttendanceEventError("recurrence_occurrence_cap_exceeded");
      }
    }
    weekIndex += 1;
  }

  dates.sort();
  return Object.freeze(dates);
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
  recurrence_rule?: unknown;
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
  recurrence_rule: RecurrenceRule | null;
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

  const recurrenceRule = validateRecurrenceRule(input.recurrence_rule, input.occurrence_date);

  return {
    title,
    description,
    location,
    activity_label: activityLabel,
    timezone,
    occurrence_date: input.occurrence_date,
    start_time: startTime as string | null,
    end_time: endTime as string | null,
    recurrence_rule: recurrenceRule
  };
}

export type AttendanceEventWithOccurrences = Readonly<{
  event: Readonly<JsonRecord>;
  occurrences: readonly Readonly<JsonRecord>[];
}>;

// Coach creates an event for their own roster - a single occurrence when
// recurrence_rule is omitted, or a full materialized series (every
// occurrence written upfront, capped) when it's provided.
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
  const occurrenceDates = generateOccurrenceDates(validated.occurrence_date, validated.recurrence_rule);

  const timestamp = new Date().toISOString();
  const eventId = randomId("attendance_event");

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
    recurrence_rule: validated.recurrence_rule,
    status: "active",
    created_at_iso8601: timestamp,
    updated_at_iso8601: timestamp
  });

  const occurrences: Readonly<JsonRecord>[] = [];
  for (const occurrenceDate of occurrenceDates) {
    occurrences.push(await writeOccurrenceVersion({
      occurrence_id: randomId("attendance_occurrence"),
      event_id: eventId,
      owner_coach_user_id: coachUserId,
      occurrence_date: occurrenceDate,
      start_time: validated.start_time,
      end_time: validated.end_time,
      status: "scheduled",
      rescheduled_to_date: null,
      rescheduled_to_start_time: null,
      rescheduled_to_end_time: null,
      created_at_iso8601: timestamp,
      updated_at_iso8601: timestamp
    }));
  }

  return Object.freeze({ event, occurrences: Object.freeze(occurrences) });
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

async function loadOwnedOccurrence(
  coachUserId: string,
  eventId: string,
  occurrenceId: string
): Promise<Readonly<JsonRecord>> {
  const event = await latestEventRecord(eventId);
  if (!event || cleanString(event.owner_coach_user_id) !== coachUserId) {
    throw new AttendanceEventError("event_not_found", 404);
  }

  const occurrence = await latestOccurrenceRecord(occurrenceId);
  if (!occurrence || cleanString(occurrence.event_id) !== eventId) {
    throw new AttendanceEventError("occurrence_not_found", 404);
  }
  if (occurrence.status === "skipped") {
    throw new AttendanceEventError("occurrence_already_skipped", 409);
  }

  return occurrence;
}

// Coach action: skip a single occurrence of a series they own, without
// touching any sibling occurrence or any RSVP already recorded against
// it (the RSVP history stays attached to occurrence_id regardless of the
// occurrence's own status changes over time).
export async function skipAttendanceOccurrence(
  coachUserIdInput: string,
  eventIdInput: unknown,
  occurrenceIdInput: unknown
): Promise<Readonly<JsonRecord>> {
  const coachUserId = cleanString(coachUserIdInput);
  const eventId = cleanString(eventIdInput);
  const occurrenceId = cleanString(occurrenceIdInput);
  if (!coachUserId || !eventId || !occurrenceId) {
    throw new AttendanceEventError("event_identity_required");
  }

  const occurrence = await loadOwnedOccurrence(coachUserId, eventId, occurrenceId);
  const timestamp = new Date().toISOString();

  return writeOccurrenceVersion({
    occurrence_id: occurrenceId,
    event_id: eventId,
    owner_coach_user_id: coachUserId,
    occurrence_date: cleanString(occurrence.occurrence_date),
    start_time: (occurrence.start_time as string | null) ?? null,
    end_time: (occurrence.end_time as string | null) ?? null,
    status: "skipped",
    rescheduled_to_date: null,
    rescheduled_to_start_time: null,
    rescheduled_to_end_time: null,
    created_at_iso8601: cleanString(occurrence.created_at_iso8601) || timestamp,
    updated_at_iso8601: timestamp
  });
}

type RescheduleAttendanceOccurrenceInput = Readonly<{
  new_date?: unknown;
  new_start_time?: unknown;
  new_end_time?: unknown;
}>;

// Coach action: move a single occurrence of a series they own to a new
// date/time, independent of the rest of the series - occurrence_date
// (the original slot) never changes, only the rescheduled_to_* target
// fields do, so the record still reflects what was originally scheduled.
export async function rescheduleAttendanceOccurrence(
  coachUserIdInput: string,
  eventIdInput: unknown,
  occurrenceIdInput: unknown,
  input: RescheduleAttendanceOccurrenceInput
): Promise<Readonly<JsonRecord>> {
  const coachUserId = cleanString(coachUserIdInput);
  const eventId = cleanString(eventIdInput);
  const occurrenceId = cleanString(occurrenceIdInput);
  if (!coachUserId || !eventId || !occurrenceId) {
    throw new AttendanceEventError("event_identity_required");
  }

  const occurrence = await loadOwnedOccurrence(coachUserId, eventId, occurrenceId);

  if (!isDateOnly(input.new_date)) {
    throw new AttendanceEventError("reschedule_date_invalid");
  }
  const newStartTime = input.new_start_time === null || input.new_start_time === undefined ? null : input.new_start_time;
  const newEndTime = input.new_end_time === null || input.new_end_time === undefined ? null : input.new_end_time;
  if (newStartTime !== null && !isTimeOnly(newStartTime)) {
    throw new AttendanceEventError("reschedule_start_time_invalid");
  }
  if (newEndTime !== null && !isTimeOnly(newEndTime)) {
    throw new AttendanceEventError("reschedule_end_time_invalid");
  }
  if (newStartTime !== null && newEndTime !== null && newEndTime <= newStartTime) {
    throw new AttendanceEventError("reschedule_end_time_before_start_time");
  }

  const timestamp = new Date().toISOString();
  return writeOccurrenceVersion({
    occurrence_id: occurrenceId,
    event_id: eventId,
    owner_coach_user_id: coachUserId,
    occurrence_date: cleanString(occurrence.occurrence_date),
    start_time: (occurrence.start_time as string | null) ?? null,
    end_time: (occurrence.end_time as string | null) ?? null,
    status: "rescheduled",
    rescheduled_to_date: input.new_date,
    rescheduled_to_start_time: newStartTime as string | null,
    rescheduled_to_end_time: newEndTime as string | null,
    created_at_iso8601: cleanString(occurrence.created_at_iso8601) || timestamp,
    updated_at_iso8601: timestamp
  });
}
