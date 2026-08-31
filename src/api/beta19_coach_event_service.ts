// DEV NOTE: BETA-19 standalone coach event and athlete assignment workspace.
// Events are coach-owned product records. Athlete links remain individual
// coach-athlete records and do not create team, organisation or engine state.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  createBeta17AssignmentRecord
} from "./beta17_coach_managed_service.js";
import {
  loadBeta17StoredCoachContext,
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  loadActiveCoachTemplateById
} from "./beta18_programme_template_service.js";
import {
  compileEventProgrammeCalendar,
  eventWeekCalendar,
  EventProgrammeCompilerError
} from "./event_programme_compiler_service.js";

type JsonRecord = Record<string, unknown>;

type AssignmentResult = Readonly<{
  status: number;
  body: Readonly<JsonRecord>;
}>;

export class Beta19CoachEventError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`beta19_coach_event_${reason}`);
    this.name = "Beta19CoachEventError";
    this.reason = reason;
  }
}

const supportedActivities = new Set([
  "powerlifting",
  "general_strength",
  "rugby_union",
  "strongman"
]);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function exactKeys(
  record: JsonRecord,
  allowed: readonly string[],
  reason: string
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      throw new Beta19CoachEventError(`${reason}_unknown_field`);
    }
  }
}

function iso8601(value: unknown, reason: string): string {
  const text = cleanString(value);
  const parsed = Date.parse(text);
  if (!text || !Number.isFinite(parsed)) {
    throw new Beta19CoachEventError(reason);
  }
  return new Date(parsed).toISOString();
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (!isRecord(value)) return value;

  const output: JsonRecord = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = canonicalise(value[key]);
  }
  return output;
}

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalise(value)), "utf8")
    .digest("hex");
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

async function requireActiveCoach(coachUserId: string): Promise<Readonly<JsonRecord>> {
  const profile = await loadLatestBetaProductRecord(
    "beta17_coach_profile",
    coachUserId,
    coachUserId
  );

  if (
    !profile ||
    profile.account_role !== "coach" ||
    profile.account_state !== "active"
  ) {
    throw new Beta19CoachEventError("coach_not_active");
  }

  return profile;
}

async function latestEventById(
  coachUserId: string,
  eventId: string
): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_coach_event'
      AND record_id = $1
      AND actor_user_id = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [eventId, coachUserId]
  );

  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? deepFreeze(payload) : null;
}

async function latestLinkByPair(
  coachUserId: string,
  athleteUserId: string,
  eventId: string
): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_event_athlete_link'
      AND actor_user_id = $1
      AND subject_user_id = $2
      AND record_payload ->> 'event_id' = $3
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [coachUserId, athleteUserId, eventId]
  );

  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? deepFreeze(payload) : null;
}

// Mirrors the date-conflict rule enforced by the FULL-UI-09C event-detail link path
// (full_ui_09c_event_lifecycle_service.ts) so an athlete cannot be double-booked onto
// two same-day active events regardless of which surface created the link.
async function eventAthleteLinkDateConflictExists(
  coachUserId: string,
  athleteUserId: string,
  targetEventId: string,
  targetEventDate: string
): Promise<boolean> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id)
      record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_event_athlete_link'
      AND actor_user_id = $1
      AND subject_user_id = $2
    ORDER BY
      record_id,
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    `,
    [coachUserId, athleteUserId]
  );

  for (const row of result.rows) {
    const link = row.record_payload;
    if (!isRecord(link) || link.link_state !== "linked") continue;
    const linkedEventId = cleanString(link.event_id);
    if (!linkedEventId || linkedEventId === targetEventId) continue;

    const linkedEvent = await latestEventById(coachUserId, linkedEventId);
    const linkedEventPlan = linkedEvent && isRecord(linkedEvent.event_plan)
      ? linkedEvent.event_plan
      : {};

    if (
      linkedEvent &&
      linkedEvent.event_status === "active" &&
      cleanString(linkedEventPlan.event_date) === targetEventDate
    ) {
      return true;
    }
  }
  return false;
}

function linkRevision(record: JsonRecord | null): number {
  if (!record) return 0;
  const revision = Number(record.link_revision ?? 1);
  return Number.isFinite(revision) && revision >= 1 ? Math.trunc(revision) : 1;
}

function eventCompileInput(
  input: JsonRecord,
  eventId: string,
  blocks: readonly JsonRecord[]
): JsonRecord {
  return {
    activity_id: cleanString(input.activity_id),
    event_plan_id: eventId,
    event_name: cleanString(input.event_name),
    event_type: cleanString(input.event_type),
    event_date: cleanString(input.event_date),
    programme_start_date: cleanString(input.programme_start_date),
    location: cleanString(input.location),
    timezone: cleanString(input.timezone) || "Europe/London",
    notes: cleanString(input.notes),
    blocks
  };
}

export function compileStandaloneCoachEvent(
  inputValue: unknown
): Readonly<{
  event_id: string;
  event_plan: Readonly<JsonRecord>;
  event_compile_summary: Readonly<JsonRecord>;
}> {
  if (!isRecord(inputValue)) {
    throw new Beta19CoachEventError("event_input_invalid");
  }

  exactKeys(
    inputValue,
    [
      "event_id",
      "event_name",
      "activity_id",
      "event_type",
      "programme_start_date",
      "event_date",
      "location",
      "timezone",
      "notes"
    ],
    "event"
  );

  const activityId = cleanString(inputValue.activity_id);
  if (!supportedActivities.has(activityId)) {
    throw new Beta19CoachEventError("event_activity_invalid");
  }

  const requestedEventId = cleanString(inputValue.event_id);
  const eventId = requestedEventId ||
    `coach_event_${sha256({
      activity_id: activityId,
      event_name: cleanString(inputValue.event_name),
      event_type: cleanString(inputValue.event_type),
      event_date: cleanString(inputValue.event_date),
      programme_start_date: cleanString(inputValue.programme_start_date),
      location: cleanString(inputValue.location),
      timezone: cleanString(inputValue.timezone) || "Europe/London"
    }).slice(0, 24)}`;

  if (!/^[a-z0-9_:-]+$/u.test(eventId)) {
    throw new Beta19CoachEventError("event_id_invalid");
  }

  try {
    const probe = compileEventProgrammeCalendar(
      eventCompileInput(
        inputValue,
        eventId,
        [{
          block_id: `${eventId}_calendar_probe`,
          order_index: 1,
          name: "Preparation calendar",
          block_type: "custom",
          week_count: 1
        }]
      )
    );

    const requiredWeekCount = Number(probe.required_week_count);
    const blocks: JsonRecord[] = [];
    let remaining = requiredWeekCount;
    let orderIndex = 1;

    while (remaining > 0) {
      const weekCount = Math.min(52, remaining);
      blocks.push({
        block_id: `${eventId}_calendar_${orderIndex}`,
        order_index: orderIndex,
        name: `Preparation calendar ${orderIndex}`,
        block_type: "custom",
        week_count: weekCount
      });
      remaining -= weekCount;
      orderIndex += 1;
    }

    const compiled = compileEventProgrammeCalendar(
      eventCompileInput(inputValue, eventId, blocks)
    );

    const eventPlan = deepFreeze({
      event_plan_id: eventId,
      event_name: compiled.event_name,
      event_type: compiled.event_type,
      event_date: compiled.event_date,
      programme_start_date: compiled.programme_start_date,
      location: compiled.location,
      timezone: compiled.timezone,
      notes: compiled.notes
    });

    const eventCompileSummary = deepFreeze({
      event_plan_id: eventId,
      activity_id: compiled.activity_id,
      event_date: compiled.event_date,
      programme_start_date: compiled.programme_start_date,
      training_day_count: compiled.training_day_count,
      required_week_count: compiled.required_week_count,
      partial_final_week_days: compiled.partial_final_week_days,
      final_training_date: compiled.final_training_date,
      weeks: eventWeekCalendar(compiled)
    });

    return deepFreeze({
      event_id: eventId,
      event_plan: eventPlan,
      event_compile_summary: eventCompileSummary
    });
  }
  catch (error) {
    if (error instanceof EventProgrammeCompilerError) {
      throw new Beta19CoachEventError(error.reason);
    }
    throw error;
  }
}

export async function createCoachEvent(
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(inputValue)) {
    throw new Beta19CoachEventError("event_input_invalid");
  }

  exactKeys(
    inputValue,
    [
      "coach_user_id",
      "event_id",
      "event_name",
      "activity_id",
      "event_type",
      "programme_start_date",
      "event_date",
      "location",
      "timezone",
      "notes",
      "created_at_iso8601",
      "updated_at_iso8601"
    ],
    "event"
  );

  const coachUserId = cleanString(inputValue.coach_user_id);
  if (!coachUserId) {
    throw new Beta19CoachEventError("coach_user_id_required");
  }

  await requireActiveCoach(coachUserId);

  const compiled = compileStandaloneCoachEvent({
    event_id: inputValue.event_id,
    event_name: inputValue.event_name,
    activity_id: inputValue.activity_id,
    event_type: inputValue.event_type,
    programme_start_date: inputValue.programme_start_date,
    event_date: inputValue.event_date,
    location: inputValue.location,
    timezone: inputValue.timezone,
    notes: inputValue.notes
  });

  const createdAt = iso8601(
    inputValue.created_at_iso8601 ?? new Date().toISOString(),
    "event_created_at_invalid"
  );
  const updatedAt = iso8601(
    inputValue.updated_at_iso8601 ?? createdAt,
    "event_updated_at_invalid"
  );

  const existing = await latestEventById(coachUserId, compiled.event_id);
  if (existing && existing.event_status !== "draft") {
    return existing;
  }

  const recordWithoutHash = {
    record_type: "beta19_coach_event",
    event_id: compiled.event_id,
    coach_user_id: coachUserId,
    event_status: "active",
    activity_id: cleanString(inputValue.activity_id),
    event_plan: compiled.event_plan,
    event_compile_summary: compiled.event_compile_summary,
    created_at_iso8601: cleanString(existing?.created_at_iso8601) || createdAt,
    updated_at_iso8601: updatedAt,
    engine_visible: false,
    creates_team_runtime: false,
    creates_organisation_runtime: false
  };

  return persistBetaProductRecord(deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  }));
}

export async function listCoachEvents(
  coachUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new Beta19CoachEventError("coach_user_id_required");
  }

  await requireActiveCoach(coachUserId);

  const [eventResult, linkResult] = await Promise.all([
    pool.query(
      `
      SELECT DISTINCT ON (record_id)
        record_payload
      FROM beta_product_records
      WHERE
        record_type = 'beta19_coach_event'
        AND actor_user_id = $1
      ORDER BY
        record_id,
        effective_at DESC,
        created_at DESC,
        record_sha256 DESC
      `,
      [coachUserId]
    ),
    pool.query(
      `
      SELECT DISTINCT ON (record_id)
        record_payload
      FROM beta_product_records
      WHERE
        record_type = 'beta19_event_athlete_link'
        AND actor_user_id = $1
      ORDER BY
        record_id,
        effective_at DESC,
        created_at DESC,
        record_sha256 DESC
      `,
      [coachUserId]
    )
  ]);

  const linkedCounts = new Map<string, number>();
  for (const row of linkResult.rows) {
    const link = row.record_payload;
    if (!isRecord(link) || link.link_state !== "linked") continue;
    const eventId = cleanString(link.event_id);
    if (!eventId) continue;
    linkedCounts.set(eventId, (linkedCounts.get(eventId) ?? 0) + 1);
  }

  return eventResult.rows
    .map((row: JsonRecord) => row.record_payload)
    .filter(isRecord)
    .map((event) => deepFreeze({
      ...event,
      linked_athlete_count: linkedCounts.get(cleanString(event.event_id)) ?? 0
    }))
    .sort((left: JsonRecord, right: JsonRecord) => {
      const leftPlan = isRecord(left.event_plan) ? left.event_plan : {};
      const rightPlan = isRecord(right.event_plan) ? right.event_plan : {};
      return cleanString(leftPlan.event_date).localeCompare(cleanString(rightPlan.event_date)) ||
        cleanString(left.event_id).localeCompare(cleanString(right.event_id));
    });
}

export async function listAthleteEventLinks(
  coachUserIdInput: string,
  athleteUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId = cleanString(coachUserIdInput);
  const athleteUserId = cleanString(athleteUserIdInput);

  if (!coachUserId || !athleteUserId) {
    throw new Beta19CoachEventError("event_link_identity_required");
  }

  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new Beta19CoachEventError("relationship_access_denied");
  }

  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id)
      record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_event_athlete_link'
      AND actor_user_id = $1
      AND subject_user_id = $2
    ORDER BY
      record_id,
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    `,
    [coachUserId, athleteUserId]
  );

  const links = result.rows
    .map((row: JsonRecord) => row.record_payload)
    .filter(isRecord)
    .filter((link) => link.link_state === "linked");

  const enriched = await Promise.all(
    links.map(async (link) => {
      const event = await latestEventById(coachUserId, cleanString(link.event_id));
      return deepFreeze({
        ...link,
        event
      });
    })
  );

  return enriched
    .filter((link) => isRecord(link.event))
    .sort((left, right) => {
      const leftEvent = isRecord(left.event) ? left.event : {};
      const rightEvent = isRecord(right.event) ? right.event : {};
      const leftPlan = isRecord(leftEvent.event_plan) ? leftEvent.event_plan : {};
      const rightPlan = isRecord(rightEvent.event_plan) ? rightEvent.event_plan : {};
      return cleanString(leftPlan.event_date).localeCompare(cleanString(rightPlan.event_date));
    });
}

export async function assignAthleteProgrammeFromProfile(
  inputValue: unknown
): Promise<Readonly<{
  assignment: Readonly<JsonRecord>;
  event_link: Readonly<JsonRecord> | null;
}>> {
  if (!isRecord(inputValue)) {
    throw new Beta19CoachEventError("assignment_input_invalid");
  }

  exactKeys(
    inputValue,
    [
      "request_id",
      "requested_at_iso8601",
      "coach_user_id",
      "athlete_user_id",
      "template_id",
      "activity_id",
      "event_id"
    ],
    "assignment"
  );

  const coachUserId = cleanString(inputValue.coach_user_id);
  const athleteUserId = cleanString(inputValue.athlete_user_id);
  const templateId = cleanString(inputValue.template_id);
  const activityId = cleanString(inputValue.activity_id);
  const eventId = cleanString(inputValue.event_id);
  const requestedAt = iso8601(
    inputValue.requested_at_iso8601,
    "assignment_requested_at_invalid"
  );

  if (!coachUserId || !athleteUserId || !templateId) {
    throw new Beta19CoachEventError("assignment_identity_required");
  }

  if (!supportedActivities.has(activityId)) {
    throw new Beta19CoachEventError("assignment_activity_invalid");
  }

  const [context, template, event] = await Promise.all([
    loadBeta17StoredCoachContext(coachUserId, athleteUserId),
    loadActiveCoachTemplateById(coachUserId, templateId),
    eventId ? latestEventById(coachUserId, eventId) : Promise.resolve(null)
  ]);

  if (!context) {
    throw new Beta19CoachEventError("relationship_access_denied");
  }

  if (!template || cleanString(template.activity_id) !== activityId) {
    throw new Beta19CoachEventError("template_not_active_for_activity");
  }

  if (eventId) {
    if (!event || event.event_status !== "active") {
      throw new Beta19CoachEventError("event_not_active");
    }
    if (cleanString(event.activity_id) !== activityId) {
      throw new Beta19CoachEventError("event_activity_mismatch");
    }

    const eventSummary = isRecord(event.event_compile_summary)
      ? event.event_compile_summary
      : {};

    if (
      Number(template.week_count) !==
      Number(eventSummary.required_week_count)
    ) {
      throw new Beta19CoachEventError(
        "event_programme_week_count_mismatch"
      );
    }

    const eventPlanRecord = isRecord(event.event_plan) ? event.event_plan : {};
    if (
      await eventAthleteLinkDateConflictExists(
        coachUserId,
        athleteUserId,
        eventId,
        cleanString(eventPlanRecord.event_date)
      )
    ) {
      throw new Beta19CoachEventError("event_link_date_conflict");
    }
  }

  const assignmentResult: AssignmentResult = createBeta17AssignmentRecord({
    request_id: inputValue.request_id,
    requested_at_iso8601: requestedAt,
    coach_profile: context.coach_profile,
    relationship: context.relationship,
    athlete_user_id: athleteUserId,
    template_id: templateId,
    activity_id: activityId
  });

  if (
    assignmentResult.status !== 201 ||
    assignmentResult.body.ok !== true ||
    !isRecord(assignmentResult.body.assignment)
  ) {
    throw new Beta19CoachEventError(
      cleanString(assignmentResult.body.reason) || "assignment_rejected"
    );
  }

  const assignment = await persistBetaProductRecord(
    assignmentResult.body.assignment
  );

  if (!eventId || !event) {
    return deepFreeze({
      assignment,
      event_link: null
    });
  }

  const linkId = `event_link_${sha256({
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    event_id: eventId
  }).slice(0, 24)}`;

  const existingLink = await latestLinkByPair(
    coachUserId,
    athleteUserId,
    eventId
  );

  const linkWithoutHash = {
    record_type: "beta19_event_athlete_link",
    contract_version: "full_ui_09c.1.0.0",
    event_athlete_link_id: linkId,
    event_id: eventId,
    event_version_at_link: Number(event.event_version ?? 1),
    event_record_sha256: cleanString(event.record_sha256),
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    assignment_id: assignment.assignment_id,
    template_id: templateId,
    activity_id: activityId,
    link_state: "linked",
    link_revision: linkRevision(existingLink) + 1,
    previous_link_record_sha256:
      cleanString(existingLink?.record_sha256) || null,
    lifecycle_action: "athlete_linked",
    created_at_iso8601:
      cleanString(existingLink?.created_at_iso8601) || requestedAt,
    updated_at_iso8601: requestedAt,
    immutable_link_history: true,
    factual_product_state: true,
    engine_visible: false,
    creates_team_runtime: false,
    creates_roster_runtime: false,
    creates_organisation_runtime: false
  };

  const eventLink = await persistBetaProductRecord(deepFreeze({
    ...linkWithoutHash,
    record_sha256: sha256(linkWithoutHash)
  }));

  return deepFreeze({
    assignment,
    event_link: eventLink
  });
}

function icsEscapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDateOnly(dateOnly: string): string {
  return dateOnly.replace(/-/g, "");
}

// ICS all-day events use an exclusive DTEND per RFC 5545 - a one-day event
// spans DTSTART through DTSTART+1, not DTSTART itself.
function icsDateOnlyPlusOneDay(dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function icsTimestamp(iso8601Value: string): string {
  return iso8601Value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * FUNCTION NOTE:
 * Purpose: Renders a coach's active events as an RFC 5545 calendar for external subscription.
 * Boundary: Pure text formatting over already-persisted event facts; no query, no engine input.
 * Determinism: The same event list always renders the same VEVENT bodies (DTSTAMP aside).
 * Failure: An event missing event_date is silently skipped, never a partially-formed VEVENT.
 */
export function buildCoachEventsCalendar(
  events: readonly Readonly<JsonRecord>[]
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kolosseum//Coach Events//EN",
    "CALSCALE:GREGORIAN"
  ];

  const dtstamp = icsTimestamp(new Date().toISOString());

  for (const event of events) {
    if (event.event_status !== "active") continue;

    const plan = isRecord(event.event_plan) ? event.event_plan : {};
    const eventDate = cleanString(plan.event_date);
    if (!eventDate) continue;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${cleanString(event.event_id)}@kolosseum.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDateOnly(eventDate)}`,
      `DTEND;VALUE=DATE:${icsDateOnlyPlusOneDay(eventDate)}`,
      `SUMMARY:${icsEscapeText(cleanString(plan.event_name) || "Event")}`
    );

    const location = cleanString(plan.location);
    if (location) lines.push(`LOCATION:${icsEscapeText(location)}`);

    const notes = cleanString(plan.notes);
    if (notes) lines.push(`DESCRIPTION:${icsEscapeText(notes)}`);

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export async function loadEventBindingForAssignment(
  assignmentIdInput: string,
  coachUserIdInput: string,
  athleteUserIdInput: string
): Promise<Readonly<{
  event_id: string;
  event_plan: Readonly<JsonRecord>;
  event_compile_summary: Readonly<JsonRecord>;
  event_record_sha256: string;
}> | null> {
  const assignmentId = cleanString(assignmentIdInput);
  const coachUserId = cleanString(coachUserIdInput);
  const athleteUserId = cleanString(athleteUserIdInput);

  if (!assignmentId || !coachUserId || !athleteUserId) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_event_athlete_link'
      AND actor_user_id = $1
      AND subject_user_id = $2
      AND record_payload ->> 'assignment_id' = $3
      AND record_payload ->> 'link_state' = 'linked'
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [coachUserId, athleteUserId, assignmentId]
  );

  const link = result.rows?.[0]?.record_payload;
  if (!isRecord(link)) return null;

  const eventId = cleanString(link.event_id);
  const event = await latestEventById(coachUserId, eventId);
  if (
    !event ||
    event.event_status !== "active" ||
    !isRecord(event.event_plan) ||
    !isRecord(event.event_compile_summary)
  ) {
    return null;
  }

  return deepFreeze({
    event_id: eventId,
    event_plan: event.event_plan,
    event_compile_summary: event.event_compile_summary,
    event_record_sha256: cleanString(event.record_sha256)
  });
}
