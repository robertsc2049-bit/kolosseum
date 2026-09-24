// DEV NOTE: Attendance events (slice 4) - gym-mode (individual-
// visibility) org-wide events, org-owner-only. This is the FOURTH
// deliberate, narrowly-scoped exception to org_visibility_service.ts's
// "no athlete identity ever leaves individual-mode" invariant - see
// that file's own updated DEV NOTE, which now names this file alongside
// org_athlete_messaging_service.ts and org_progress_rollup_service.ts.
// The exception is scoped PRECISELY to events the org owner themselves
// created: every function below re-checks (a) the caller is the real
// owner of this exact org (product_organisations.owner_user_id), (b)
// the org's visibility_mode is 'individual' right now, and (c) the
// event in question actually belongs to this org - never a general
// "show me every gym-mode athlete" capability. A regular coach can
// never create or view a gym-wide event through this file - only the
// org owner (gym-mode's coach-to-coach privacy is stronger than owner-
// to-coach privacy, so only the strongest-privileged actor gets this).
//
// Creation deliberately takes NO athlete_user_ids from the owner at
// all - a gym-wide event auto-invites every currently-accepted athlete
// across every ACTIVE coach in the org (resolved server-side via
// resolveOrgActiveCoachAcceptedAthletes, the same cross-coach resolver
// slice 3 uses). This keeps the identity exception as narrow as
// possible: the owner never gets an athlete PICKER (which would itself
// be a standing "show me my gym's roster" capability) - real identity
// is only ever revealed through getGymAttendanceEventDetailForOwner,
// for one specific event they already created.
//
// Management (cancel/skip/reschedule/list) reuses the exact same
// service functions attendance_event.routes.ts already calls for a
// coach caller (cancelAttendanceEvent, listAttendanceEventsForCoach,
// skipAttendanceOccurrence, rescheduleAttendanceOccurrence) - none of
// those functions ever call requireActiveCoachProfile (only
// createAttendanceEventForCoach does), they only compare identity
// strings against owner_coach_user_id/actor_user_id. Storing the org
// owner's own user_id in that field at creation time (see
// createGymWideAttendanceEventForOwner below) lets them work unchanged
// for an owner caller - no coach-specific validation ever runs for a
// gym-wide event's lifecycle.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  cancelAttendanceEvent,
  generateOccurrenceDates,
  listAttendanceEventsForCoach,
  loadAttendanceEventRecord,
  loadAttendanceOccurrenceRecords,
  rescheduleAttendanceOccurrence,
  skipAttendanceOccurrence,
  validateCreateInput,
  writeEventVersion,
  writeOccurrenceVersion,
  type AttendanceEventWithOccurrences,
  type CreateAttendanceEventInput
} from "./attendance_event_service.js";
import { writeInviteVersion } from "./attendance_event_invite_service.js";
import { getAttendanceRosterForEvent, type AttendanceRosterEntry } from "./attendance_event_rsvp_service.js";
import { resolveOrgActiveCoachAcceptedAthletes } from "./attendance_event_org_invite_service.js";

type JsonRecord = Record<string, unknown>;

export class AttendanceEventGymRosterError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`attendance_event_${reason}`);
    this.name = "AttendanceEventGymRosterError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

// Returns the cleaned org_id on success. Throws if the org doesn't
// exist, the caller isn't its real owner, or the org isn't in
// individual-visibility mode - every failure is a hard reject, matching
// requireActiveSharedOrgMembership's own convention in
// attendance_event_org_invite_service.ts (slice 3).
export async function requireIndividualModeOrgOwnership(
  ownerUserIdInput: string,
  orgIdInput: unknown
): Promise<string> {
  const ownerUserId = cleanString(ownerUserIdInput);
  const orgId = cleanString(orgIdInput);
  if (!ownerUserId) {
    throw new AttendanceEventGymRosterError("owner_identity_required", 401);
  }
  if (!orgId) {
    throw new AttendanceEventGymRosterError("org_identity_required");
  }

  const result = await pool.query(
    `SELECT owner_user_id, visibility_mode FROM product_organisations WHERE org_id = $1 LIMIT 1`,
    [orgId]
  );
  const org = result.rows[0];
  if (!org) {
    throw new AttendanceEventGymRosterError("org_not_found", 404);
  }
  if (cleanString(org.owner_user_id) !== ownerUserId) {
    throw new AttendanceEventGymRosterError("org_access_denied", 403);
  }
  if (org.visibility_mode !== "individual") {
    throw new AttendanceEventGymRosterError("org_not_individual_visibility", 403);
  }

  return orgId;
}

async function requireEventBelongsToOrg(eventId: string, orgId: string, ownerUserId: string): Promise<Readonly<JsonRecord>> {
  const event = await loadAttendanceEventRecord(eventId);
  if (!event || cleanString(event.owner_org_id) !== orgId || cleanString(event.owner_coach_user_id) !== ownerUserId) {
    throw new AttendanceEventGymRosterError("event_not_found", 404);
  }
  return event;
}

// Org owner action: create a gym-wide event, auto-inviting every
// currently-accepted athlete across every ACTIVE coach in the org - see
// this file's own DEV NOTE for why there is deliberately no athlete
// picker here.
export async function createGymWideAttendanceEventForOwner(
  ownerUserIdInput: string,
  orgIdInput: unknown,
  input: CreateAttendanceEventInput
): Promise<Readonly<AttendanceEventWithOccurrences & { invited_count: number }>> {
  const ownerUserId = cleanString(ownerUserIdInput);
  const orgId = await requireIndividualModeOrgOwnership(ownerUserId, orgIdInput);

  const validated = validateCreateInput(input);
  const occurrenceDates = generateOccurrenceDates(validated.occurrence_date, validated.recurrence_rule);

  const timestamp = new Date().toISOString();
  const eventId = randomId("attendance_event");

  const event = await writeEventVersion({
    event_id: eventId,
    owner_scope: "org",
    owner_coach_user_id: ownerUserId,
    owner_org_id: orgId,
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
      owner_coach_user_id: ownerUserId,
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

  const roster = await resolveOrgActiveCoachAcceptedAthletes(orgId);
  for (const athlete of roster) {
    await writeInviteVersion({
      invite_id: randomId("attendance_invite"),
      event_id: eventId,
      athlete_user_id: athlete.athlete_user_id,
      organizer_user_id: ownerUserId,
      invite_state: "invited",
      created_at_iso8601: timestamp,
      updated_at_iso8601: timestamp
    });
  }

  return Object.freeze({ event, occurrences: Object.freeze(occurrences), invited_count: roster.length });
}

export async function listGymWideAttendanceEventsForOwner(
  ownerUserIdInput: string,
  orgIdInput: unknown
): Promise<readonly Readonly<JsonRecord>[]> {
  const ownerUserId = cleanString(ownerUserIdInput);
  const orgId = await requireIndividualModeOrgOwnership(ownerUserId, orgIdInput);

  const events = await listAttendanceEventsForCoach(ownerUserId);
  return Object.freeze(events.filter((event) => cleanString(event.owner_org_id) === orgId));
}

export type GymAttendanceEventDetail = Readonly<{
  event: Readonly<JsonRecord>;
  occurrences: readonly Readonly<JsonRecord>[];
  roster: readonly AttendanceRosterEntry[];
}>;

// Org owner action: the ONE place real athlete identity is revealed for
// a gym-mode org - and only for an event the owner themselves created
// (requireEventBelongsToOrg re-checks ownership of the SPECIFIC event,
// on top of requireIndividualModeOrgOwnership's org-level gate).
export async function getGymAttendanceEventDetailForOwner(
  ownerUserIdInput: string,
  orgIdInput: unknown,
  eventIdInput: unknown
): Promise<GymAttendanceEventDetail> {
  const ownerUserId = cleanString(ownerUserIdInput);
  const orgId = await requireIndividualModeOrgOwnership(ownerUserId, orgIdInput);
  const eventId = cleanString(eventIdInput);
  if (!eventId) {
    throw new AttendanceEventGymRosterError("event_identity_required");
  }

  const event = await requireEventBelongsToOrg(eventId, orgId, ownerUserId);
  const occurrences = await loadAttendanceOccurrenceRecords(eventId);
  const roster = await getAttendanceRosterForEvent(eventId);

  return Object.freeze({ event, occurrences, roster });
}

export async function cancelGymWideAttendanceEventForOwner(
  ownerUserIdInput: string,
  orgIdInput: unknown,
  eventIdInput: unknown
): Promise<Readonly<JsonRecord>> {
  const ownerUserId = cleanString(ownerUserIdInput);
  const orgId = await requireIndividualModeOrgOwnership(ownerUserId, orgIdInput);
  const eventId = cleanString(eventIdInput);
  if (!eventId) {
    throw new AttendanceEventGymRosterError("event_identity_required");
  }

  await requireEventBelongsToOrg(eventId, orgId, ownerUserId);
  return cancelAttendanceEvent(ownerUserId, eventId);
}

export async function skipGymWideAttendanceOccurrenceForOwner(
  ownerUserIdInput: string,
  orgIdInput: unknown,
  eventIdInput: unknown,
  occurrenceIdInput: unknown
): Promise<Readonly<JsonRecord>> {
  const ownerUserId = cleanString(ownerUserIdInput);
  const orgId = await requireIndividualModeOrgOwnership(ownerUserId, orgIdInput);
  const eventId = cleanString(eventIdInput);
  if (!eventId) {
    throw new AttendanceEventGymRosterError("event_identity_required");
  }

  await requireEventBelongsToOrg(eventId, orgId, ownerUserId);
  return skipAttendanceOccurrence(ownerUserId, eventId, occurrenceIdInput);
}

type RescheduleGymWideOccurrenceInput = Readonly<{
  new_date?: unknown;
  new_start_time?: unknown;
  new_end_time?: unknown;
}>;

export async function rescheduleGymWideAttendanceOccurrenceForOwner(
  ownerUserIdInput: string,
  orgIdInput: unknown,
  eventIdInput: unknown,
  occurrenceIdInput: unknown,
  input: RescheduleGymWideOccurrenceInput
): Promise<Readonly<JsonRecord>> {
  const ownerUserId = cleanString(ownerUserIdInput);
  const orgId = await requireIndividualModeOrgOwnership(ownerUserId, orgIdInput);
  const eventId = cleanString(eventIdInput);
  if (!eventId) {
    throw new AttendanceEventGymRosterError("event_identity_required");
  }

  await requireEventBelongsToOrg(eventId, orgId, ownerUserId);
  return rescheduleAttendanceOccurrence(ownerUserId, eventId, occurrenceIdInput, input);
}
