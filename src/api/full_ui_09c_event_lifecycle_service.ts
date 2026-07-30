// DEV NOTE: FULL-UI-09C coach-owned standalone event lifecycle.
// This module persists factual product state only. It does not create team,
// roster, organisation or deterministic engine runtime.

import crypto from "node:crypto";
import type { PoolClient } from "pg";

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
  compileStandaloneCoachEvent
} from "./beta19_coach_event_service.js";

type JsonRecord = Record<string, unknown>;
type QueryClient = Pick<PoolClient, "query">;

type EventLibraryFilters = Readonly<{
  search?: string;
  status?: string;
  activity_id?: string;
  date_scope?: string;
  current_date?: string;
}>;

export class FullUi09cEventLifecycleError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`full_ui_09c_event_lifecycle_${reason}`);
    this.name = "FullUi09cEventLifecycleError";
    this.reason = reason;
  }
}

const supportedActivities = new Set([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const eventStates = new Set([
  "active",
  "cancelled",
  "archived"
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
      throw new FullUi09cEventLifecycleError(`${reason}_unknown_field`);
    }
  }
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

function dateOnly(value: unknown, reason: string): string {
  const text = cleanString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    throw new FullUi09cEventLifecycleError(reason);
  }

  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== text) {
    throw new FullUi09cEventLifecycleError(reason);
  }

  return text;
}

function iso8601(value: unknown, reason: string): string {
  const text = cleanString(value);
  const parsed = Date.parse(text);
  if (!text || !Number.isFinite(parsed)) {
    throw new FullUi09cEventLifecycleError(reason);
  }
  return new Date(parsed).toISOString();
}

function integerAtLeast(value: unknown, minimum: number, reason: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new FullUi09cEventLifecycleError(reason);
  }
  return parsed;
}

function eventPlan(event: JsonRecord): JsonRecord {
  return isRecord(event.event_plan) ? event.event_plan : {};
}

function eventDate(event: JsonRecord): string {
  return cleanString(eventPlan(event).event_date);
}

function eventVersion(event: JsonRecord): number {
  return integerAtLeast(event.event_version ?? 1, 1, "event_version_invalid");
}

function recordRevision(record: JsonRecord): number {
  return integerAtLeast(record.record_revision ?? 1, 1, "event_record_revision_invalid");
}

function linkRevision(record: JsonRecord | null): number {
  if (!record) return 0;
  return integerAtLeast(record.link_revision ?? 1, 1, "event_link_revision_invalid");
}

function currentDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function validateStandaloneEventDates(input: unknown): Readonly<{
  programme_start_date: string;
  event_date: string;
  current_date: string;
}> {
  if (!isRecord(input)) {
    throw new FullUi09cEventLifecycleError("event_dates_invalid");
  }

  exactKeys(
    input,
    ["programme_start_date", "event_date", "current_date"],
    "event_dates"
  );

  const currentDate = dateOnly(
    input.current_date ?? currentDateUtc(),
    "event_current_date_invalid"
  );
  const programmeStartDate = dateOnly(
    input.programme_start_date,
    "event_programme_start_date_invalid"
  );
  const eventDateValue = dateOnly(
    input.event_date,
    "event_date_invalid"
  );

  if (programmeStartDate < currentDate) {
    throw new FullUi09cEventLifecycleError("event_programme_start_date_in_past");
  }
  if (eventDateValue < currentDate) {
    throw new FullUi09cEventLifecycleError("event_date_in_past");
  }
  if (programmeStartDate >= eventDateValue) {
    throw new FullUi09cEventLifecycleError("event_date_order_invalid");
  }

  return deepFreeze({
    programme_start_date: programmeStartDate,
    event_date: eventDateValue,
    current_date: currentDate
  });
}

export function filterStandaloneEventLibrary(
  eventValues: unknown,
  filterValues: unknown = {}
): readonly Readonly<JsonRecord>[] {
  if (!Array.isArray(eventValues) || !isRecord(filterValues)) {
    throw new FullUi09cEventLifecycleError("event_library_filter_invalid");
  }

  exactKeys(
    filterValues,
    ["search", "status", "activity_id", "date_scope", "current_date"],
    "event_library_filter"
  );

  const search = cleanString(filterValues.search).toLowerCase();
  const status = cleanString(filterValues.status) || "all";
  const activityId = cleanString(filterValues.activity_id) || "all";
  const dateScope = cleanString(filterValues.date_scope) || "all";
  const currentDate = dateOnly(
    filterValues.current_date ?? currentDateUtc(),
    "event_library_current_date_invalid"
  );

  if (status !== "all" && !eventStates.has(status)) {
    throw new FullUi09cEventLifecycleError("event_library_status_filter_invalid");
  }
  if (activityId !== "all" && !supportedActivities.has(activityId)) {
    throw new FullUi09cEventLifecycleError("event_library_activity_filter_invalid");
  }
  if (!["all", "future", "past"].includes(dateScope)) {
    throw new FullUi09cEventLifecycleError("event_library_date_filter_invalid");
  }

  const filtered = eventValues
    .filter(isRecord)
    .filter((event) => {
      const plan = eventPlan(event);
      const fields = [
        event.event_id,
        event.event_status,
        event.activity_id,
        plan.event_name,
        plan.event_type,
        plan.location,
        plan.timezone
      ]
        .map((value) => cleanString(value).toLowerCase())
        .join(" ");

      if (search && !fields.includes(search)) return false;
      if (status !== "all" && cleanString(event.event_status) !== status) return false;
      if (activityId !== "all" && cleanString(event.activity_id) !== activityId) return false;

      const date = cleanString(plan.event_date);
      if (dateScope === "future" && date < currentDate) return false;
      if (dateScope === "past" && date >= currentDate) return false;
      return true;
    })
    .sort((left, right) =>
      eventDate(left).localeCompare(eventDate(right)) ||
      cleanString(left.event_id).localeCompare(cleanString(right.event_id))
    );

  return deepFreeze(filtered);
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
    throw new FullUi09cEventLifecycleError("coach_access_denied");
  }

  return profile;
}

async function serverClock(
  client: QueryClient,
  previousIso8601 = ""
): Promise<string> {
  const result = await client.query(
    `
    SELECT to_char(
      clock_timestamp() AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) AS server_now
    `
  );

  const serverNow = iso8601(
    result.rows?.[0]?.server_now,
    "event_server_time_invalid"
  );
  const previous = Date.parse(previousIso8601);
  if (!Number.isFinite(previous)) return serverNow;

  return new Date(
    Math.max(Date.parse(serverNow), previous + 1)
  ).toISOString();
}

async function serverDate(client: QueryClient): Promise<string> {
  const result = await client.query(
    `
    SELECT to_char(
      clock_timestamp() AT TIME ZONE 'UTC',
      'YYYY-MM-DD'
    ) AS server_date
    `
  );
  return dateOnly(result.rows?.[0]?.server_date, "event_server_date_invalid");
}

async function latestOwnedEvent(
  client: QueryClient,
  coachUserId: string,
  eventId: string,
  lockForUpdate = false
): Promise<JsonRecord | null> {
  const result = await client.query(
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
    ${lockForUpdate ? "FOR UPDATE" : ""}
    `,
    [eventId, coachUserId]
  );

  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? payload : null;
}

async function eventExistsForAnotherActor(
  client: QueryClient,
  coachUserId: string,
  eventId: string
): Promise<boolean> {
  const result = await client.query(
    `
    SELECT 1
    FROM beta_product_records
    WHERE
      record_type = 'beta19_coach_event'
      AND record_id = $1
      AND actor_user_id <> $2
    LIMIT 1
    `,
    [eventId, coachUserId]
  );
  return (result.rowCount ?? 0) > 0;
}

async function requireOwnedEvent(
  client: QueryClient,
  coachUserId: string,
  eventId: string,
  lockForUpdate = false
): Promise<JsonRecord> {
  const event = await latestOwnedEvent(
    client,
    coachUserId,
    eventId,
    lockForUpdate
  );
  if (event) return event;

  if (await eventExistsForAnotherActor(client, coachUserId, eventId)) {
    throw new FullUi09cEventLifecycleError("event_ownership_denied");
  }
  throw new FullUi09cEventLifecycleError("event_not_found");
}

async function eventHistory(
  client: QueryClient,
  coachUserId: string,
  eventId: string
): Promise<JsonRecord[]> {
  const result = await client.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_coach_event'
      AND record_id = $1
      AND actor_user_id = $2
    ORDER BY
      effective_at ASC,
      created_at ASC,
      record_sha256 ASC
    `,
    [eventId, coachUserId]
  );

  return result.rows
    .map((row) => row.record_payload)
    .filter(isRecord);
}

async function latestLinkByPair(
  client: QueryClient,
  coachUserId: string,
  athleteUserId: string,
  eventId: string,
  lockForUpdate = false
): Promise<JsonRecord | null> {
  const result = await client.query(
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
    ${lockForUpdate ? "FOR UPDATE" : ""}
    `,
    [coachUserId, athleteUserId, eventId]
  );

  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? payload : null;
}

async function currentLinksForEvent(
  client: QueryClient,
  coachUserId: string,
  eventId: string
): Promise<JsonRecord[]> {
  const result = await client.query(
    `
    SELECT DISTINCT ON (record_id)
      record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_event_athlete_link'
      AND actor_user_id = $1
      AND record_payload ->> 'event_id' = $2
    ORDER BY
      record_id,
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    `,
    [coachUserId, eventId]
  );

  return result.rows
    .map((row) => row.record_payload)
    .filter(isRecord)
    .filter((link) => link.link_state === "linked");
}

async function eventLinkHistory(
  client: QueryClient,
  coachUserId: string,
  eventId: string
): Promise<JsonRecord[]> {
  const result = await client.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_event_athlete_link'
      AND actor_user_id = $1
      AND record_payload ->> 'event_id' = $2
    ORDER BY
      effective_at ASC,
      created_at ASC,
      record_sha256 ASC
    `,
    [coachUserId, eventId]
  );

  return result.rows
    .map((row) => row.record_payload)
    .filter(isRecord);
}

async function templateById(
  client: QueryClient,
  coachUserId: string,
  templateId: string
): Promise<JsonRecord | null> {
  if (!templateId) return null;

  const result = await client.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta18_programme_template'
      AND record_id = $1
      AND actor_user_id = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [templateId, coachUserId]
  );
  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? payload : null;
}

function lifecycleRecord(
  source: JsonRecord,
  index: number
): Readonly<JsonRecord> {
  return deepFreeze({
    lifecycle_record_id:
      `event_lifecycle_${sha256({
        source_record_sha256: source.record_sha256,
        index
      }).slice(0, 24)}`,
    lifecycle_action:
      cleanString(source.lifecycle_action) || "historical_record",
    event_id: cleanString(source.event_id),
    event_version: Number(source.event_version ?? 1),
    actor_user_id: cleanString(source.coach_user_id),
    athlete_user_id: cleanString(source.athlete_user_id) || null,
    assignment_id: cleanString(source.assignment_id) || null,
    template_id: cleanString(source.template_id) || null,
    occurred_at_iso8601:
      cleanString(source.updated_at_iso8601) ||
      cleanString(source.created_at_iso8601),
    source_record_sha256: cleanString(source.record_sha256),
    factual_product_record: true,
    notification_emitted: false,
    engine_visible: false
  });
}

function eventRecordWithoutHash(input: Readonly<{
  event_id: string;
  coach_user_id: string;
  event_status: string;
  event_version: number;
  record_revision: number;
  previous_event_record_sha256: string | null;
  activity_id: string;
  event_plan: Readonly<JsonRecord>;
  event_compile_summary: Readonly<JsonRecord>;
  created_at_iso8601: string;
  updated_at_iso8601: string;
  lifecycle_action: string;
  cancellation_state: string;
  cancelled_at_iso8601: string | null;
  archive_state: string;
  archived_at_iso8601: string | null;
}>): Readonly<JsonRecord> {
  return deepFreeze({
    record_type: "beta19_coach_event",
    contract_version: "full_ui_09c.1.0.0",
    event_id: input.event_id,
    event_lineage_id: input.event_id,
    coach_user_id: input.coach_user_id,
    event_status: input.event_status,
    event_version: input.event_version,
    record_revision: input.record_revision,
    previous_event_record_sha256: input.previous_event_record_sha256,
    activity_id: input.activity_id,
    event_plan: input.event_plan,
    event_compile_summary: input.event_compile_summary,
    lifecycle_action: input.lifecycle_action,
    cancellation_state: input.cancellation_state,
    cancelled_at_iso8601: input.cancelled_at_iso8601,
    archive_state: input.archive_state,
    archived_at_iso8601: input.archived_at_iso8601,
    created_at_iso8601: input.created_at_iso8601,
    updated_at_iso8601: input.updated_at_iso8601,
    ordering_time_authority: "postgres_server_clock",
    immutable_event_history: true,
    factual_product_state: true,
    engine_visible: false,
    creates_team_runtime: false,
    creates_roster_runtime: false,
    creates_organisation_runtime: false
  });
}

function eventInput(value: JsonRecord): JsonRecord {
  return {
    event_id: value.event_id,
    event_name: value.event_name,
    activity_id: value.activity_id,
    event_type: value.event_type,
    programme_start_date: value.programme_start_date,
    event_date: value.event_date,
    location: value.location,
    timezone: value.timezone,
    notes: value.notes
  };
}

export async function createStandaloneEventLifecycle(
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(inputValue)) {
    throw new FullUi09cEventLifecycleError("event_input_invalid");
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
      "notes"
    ],
    "event"
  );

  const coachUserId = cleanString(inputValue.coach_user_id);
  if (!coachUserId) {
    throw new FullUi09cEventLifecycleError("coach_user_id_required");
  }
  await requireActiveCoach(coachUserId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentDate = await serverDate(client);
    validateStandaloneEventDates({
      programme_start_date: inputValue.programme_start_date,
      event_date: inputValue.event_date,
      current_date: currentDate
    });

    const compiled = compileStandaloneCoachEvent(eventInput(inputValue));
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`full_ui_09c_event:${coachUserId}:${compiled.event_id}`]
    );

    if (await latestOwnedEvent(client, coachUserId, compiled.event_id, true)) {
      throw new FullUi09cEventLifecycleError("event_already_exists");
    }
    if (await eventExistsForAnotherActor(client, coachUserId, compiled.event_id)) {
      throw new FullUi09cEventLifecycleError("event_ownership_denied");
    }

    const occurredAt = await serverClock(client);
    const withoutHash = eventRecordWithoutHash({
      event_id: compiled.event_id,
      coach_user_id: coachUserId,
      event_status: "active",
      event_version: 1,
      record_revision: 1,
      previous_event_record_sha256: null,
      activity_id: cleanString(inputValue.activity_id),
      event_plan: compiled.event_plan,
      event_compile_summary: compiled.event_compile_summary,
      created_at_iso8601: occurredAt,
      updated_at_iso8601: occurredAt,
      lifecycle_action: "event_created",
      cancellation_state: "not_cancelled",
      cancelled_at_iso8601: null,
      archive_state: "not_archived",
      archived_at_iso8601: null
    });

    const persisted = await persistBetaProductRecord(
      deepFreeze({
        ...withoutHash,
        record_sha256: sha256(withoutHash)
      }),
      client
    );
    await client.query("COMMIT");
    return persisted;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

export async function loadStandaloneEventLibrary(
  coachUserIdInput: string,
  filters: EventLibraryFilters = {}
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new FullUi09cEventLifecycleError("coach_user_id_required");
  }
  await requireActiveCoach(coachUserId);

  const [eventsResult, linksResult, dateResult] = await Promise.all([
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
    ),
    pool.query(
      `
      SELECT to_char(
        clock_timestamp() AT TIME ZONE 'UTC',
        'YYYY-MM-DD'
      ) AS server_date
      `
    )
  ]);

  const linkedCounts = new Map<string, number>();
  for (const row of linksResult.rows) {
    const link = row.record_payload;
    if (!isRecord(link) || link.link_state !== "linked") continue;
    const eventId = cleanString(link.event_id);
    if (!eventId) continue;
    linkedCounts.set(eventId, (linkedCounts.get(eventId) ?? 0) + 1);
  }

  const events = eventsResult.rows
    .map((row) => row.record_payload)
    .filter(isRecord)
    .map((event) => deepFreeze({
      ...event,
      linked_athlete_count:
        linkedCounts.get(cleanString(event.event_id)) ?? 0
    }));

  return filterStandaloneEventLibrary(events, {
    ...filters,
    current_date:
      filters.current_date ??
      dateOnly(dateResult.rows?.[0]?.server_date, "event_library_server_date_invalid")
  });
}

export async function createStandaloneEventVersion(
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(inputValue)) {
    throw new FullUi09cEventLifecycleError("event_version_input_invalid");
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
      "expected_current_record_sha256"
    ],
    "event_version"
  );

  const coachUserId = cleanString(inputValue.coach_user_id);
  const eventId = cleanString(inputValue.event_id);
  const expectedHash = cleanString(inputValue.expected_current_record_sha256);
  if (!coachUserId || !eventId || !/^[a-f0-9]{64}$/u.test(expectedHash)) {
    throw new FullUi09cEventLifecycleError("event_version_identity_invalid");
  }
  await requireActiveCoach(coachUserId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`full_ui_09c_event:${coachUserId}:${eventId}`]
    );

    const current = await requireOwnedEvent(client, coachUserId, eventId, true);
    if (current.event_status !== "active") {
      throw new FullUi09cEventLifecycleError("event_version_state_conflict");
    }
    if (cleanString(current.record_sha256) !== expectedHash) {
      throw new FullUi09cEventLifecycleError("event_stale_write");
    }

    const currentDate = await serverDate(client);
    if (eventDate(current) <= currentDate) {
      throw new FullUi09cEventLifecycleError("event_version_future_required");
    }
    validateStandaloneEventDates({
      programme_start_date: inputValue.programme_start_date,
      event_date: inputValue.event_date,
      current_date: currentDate
    });

    const compiled = compileStandaloneCoachEvent({
      ...eventInput(inputValue),
      event_id: eventId
    });
    const occurredAt = await serverClock(
      client,
      cleanString(current.updated_at_iso8601)
    );
    const withoutHash = eventRecordWithoutHash({
      event_id: eventId,
      coach_user_id: coachUserId,
      event_status: "active",
      event_version: eventVersion(current) + 1,
      record_revision: recordRevision(current) + 1,
      previous_event_record_sha256: expectedHash,
      activity_id: cleanString(inputValue.activity_id),
      event_plan: compiled.event_plan,
      event_compile_summary: compiled.event_compile_summary,
      created_at_iso8601:
        cleanString(current.created_at_iso8601) || occurredAt,
      updated_at_iso8601: occurredAt,
      lifecycle_action: "event_version_created",
      cancellation_state: "not_cancelled",
      cancelled_at_iso8601: null,
      archive_state: "not_archived",
      archived_at_iso8601: null
    });

    const persisted = await persistBetaProductRecord(
      deepFreeze({
        ...withoutHash,
        record_sha256: sha256(withoutHash)
      }),
      client
    );
    await client.query("COMMIT");
    return persisted;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

async function transitionEventState(
  inputValue: unknown,
  transition: "cancel" | "archive"
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(inputValue)) {
    throw new FullUi09cEventLifecycleError(`event_${transition}_input_invalid`);
  }
  exactKeys(
    inputValue,
    ["coach_user_id", "event_id", "expected_current_record_sha256"],
    `event_${transition}`
  );

  const coachUserId = cleanString(inputValue.coach_user_id);
  const eventId = cleanString(inputValue.event_id);
  const expectedHash = cleanString(inputValue.expected_current_record_sha256);
  if (!coachUserId || !eventId || !/^[a-f0-9]{64}$/u.test(expectedHash)) {
    throw new FullUi09cEventLifecycleError(`event_${transition}_identity_invalid`);
  }
  await requireActiveCoach(coachUserId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`full_ui_09c_event:${coachUserId}:${eventId}`]
    );
    const current = await requireOwnedEvent(client, coachUserId, eventId, true);
    if (cleanString(current.record_sha256) !== expectedHash) {
      throw new FullUi09cEventLifecycleError("event_stale_write");
    }

    if (transition === "cancel" && current.event_status !== "active") {
      throw new FullUi09cEventLifecycleError("event_cancel_state_conflict");
    }
    if (transition === "archive" && current.event_status === "archived") {
      throw new FullUi09cEventLifecycleError("event_archive_state_conflict");
    }

    const occurredAt = await serverClock(
      client,
      cleanString(current.updated_at_iso8601)
    );
    const cancelling = transition === "cancel";
    const withoutHash = eventRecordWithoutHash({
      event_id: eventId,
      coach_user_id: coachUserId,
      event_status: cancelling ? "cancelled" : "archived",
      event_version: eventVersion(current),
      record_revision: recordRevision(current) + 1,
      previous_event_record_sha256: expectedHash,
      activity_id: cleanString(current.activity_id),
      event_plan: eventPlan(current),
      event_compile_summary:
        isRecord(current.event_compile_summary)
          ? current.event_compile_summary
          : {},
      created_at_iso8601:
        cleanString(current.created_at_iso8601) || occurredAt,
      updated_at_iso8601: occurredAt,
      lifecycle_action: cancelling ? "event_cancelled" : "event_archived",
      cancellation_state:
        cancelling
          ? "cancelled"
          : cleanString(current.cancellation_state) || "not_cancelled",
      cancelled_at_iso8601:
        cancelling
          ? occurredAt
          : cleanString(current.cancelled_at_iso8601) || null,
      archive_state: cancelling ? "not_archived" : "archived",
      archived_at_iso8601: cancelling ? null : occurredAt
    });

    const persisted = await persistBetaProductRecord(
      deepFreeze({
        ...withoutHash,
        record_sha256: sha256(withoutHash)
      }),
      client
    );
    await client.query("COMMIT");
    return persisted;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

export async function cancelStandaloneEvent(
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  return transitionEventState(inputValue, "cancel");
}

export async function archiveStandaloneEvent(
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  return transitionEventState(inputValue, "archive");
}

async function assertRelationship(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>> {
  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new FullUi09cEventLifecycleError("relationship_access_denied");
  }

  const relationship = isRecord(context.relationship) ? context.relationship : {};
  if (
    relationship.relationship_state !== "accepted" ||
    relationship.coach_user_id !== coachUserId ||
    relationship.athlete_user_id !== athleteUserId
  ) {
    throw new FullUi09cEventLifecycleError("relationship_access_denied");
  }
  return context;
}

async function assertNoDateConflict(
  client: QueryClient,
  coachUserId: string,
  athleteUserId: string,
  targetEvent: JsonRecord
): Promise<void> {
  const result = await client.query(
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
    if (!linkedEventId || linkedEventId === cleanString(targetEvent.event_id)) continue;

    const linkedEvent = await latestOwnedEvent(client, coachUserId, linkedEventId);
    if (
      linkedEvent &&
      linkedEvent.event_status === "active" &&
      eventDate(linkedEvent) === eventDate(targetEvent)
    ) {
      throw new FullUi09cEventLifecycleError("event_link_date_conflict");
    }
  }
}

export async function linkAthleteToStandaloneEvent(
  inputValue: unknown
): Promise<Readonly<{
  link: Readonly<JsonRecord>;
  assignment: Readonly<JsonRecord> | null;
}>> {
  if (!isRecord(inputValue)) {
    throw new FullUi09cEventLifecycleError("event_link_input_invalid");
  }
  exactKeys(
    inputValue,
    [
      "coach_user_id",
      "event_id",
      "athlete_user_id",
      "template_id",
      "request_id"
    ],
    "event_link"
  );

  const coachUserId = cleanString(inputValue.coach_user_id);
  const eventId = cleanString(inputValue.event_id);
  const athleteUserId = cleanString(inputValue.athlete_user_id);
  const templateId = cleanString(inputValue.template_id);
  const requestId = cleanString(inputValue.request_id) ||
    `event_link_request_${sha256({ coachUserId, eventId, athleteUserId, templateId }).slice(0, 24)}`;

  if (!coachUserId || !eventId || !athleteUserId) {
    throw new FullUi09cEventLifecycleError("event_link_identity_required");
  }

  await requireActiveCoach(coachUserId);
  const context = await assertRelationship(coachUserId, athleteUserId);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`full_ui_09c_event_link:${coachUserId}:${athleteUserId}:${eventId}`]
    );

    const event = await requireOwnedEvent(client, coachUserId, eventId, true);
    if (event.event_status !== "active") {
      throw new FullUi09cEventLifecycleError("event_not_active");
    }

    const currentLink = await latestLinkByPair(
      client,
      coachUserId,
      athleteUserId,
      eventId,
      true
    );
    if (currentLink?.link_state === "linked") {
      throw new FullUi09cEventLifecycleError("event_link_duplicate");
    }
    await assertNoDateConflict(client, coachUserId, athleteUserId, event);

    let assignment: Readonly<JsonRecord> | null = null;
    if (templateId) {
      const template = await loadActiveCoachTemplateById(coachUserId, templateId);
      if (!template || cleanString(template.activity_id) !== cleanString(event.activity_id)) {
        throw new FullUi09cEventLifecycleError("event_link_template_invalid");
      }
      const summary = isRecord(event.event_compile_summary)
        ? event.event_compile_summary
        : {};
      if (Number(template.week_count) !== Number(summary.required_week_count)) {
        throw new FullUi09cEventLifecycleError("event_link_programme_week_count_mismatch");
      }

      const requestedAt = await serverClock(client);
      const assignmentResult = createBeta17AssignmentRecord({
        request_id: requestId,
        requested_at_iso8601: requestedAt,
        coach_profile: context.coach_profile,
        relationship: context.relationship,
        athlete_user_id: athleteUserId,
        template_id: templateId,
        activity_id: cleanString(event.activity_id)
      });
      if (
        assignmentResult.status !== 201 ||
        assignmentResult.body.ok !== true ||
        !isRecord(assignmentResult.body.assignment)
      ) {
        throw new FullUi09cEventLifecycleError(
          cleanString(assignmentResult.body.reason) || "event_link_assignment_rejected"
        );
      }
      assignment = await persistBetaProductRecord(
        assignmentResult.body.assignment,
        client
      );
    }

    const occurredAt = await serverClock(
      client,
      cleanString(currentLink?.updated_at_iso8601)
    );
    const linkId = `event_link_${sha256({
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      event_id: eventId
    }).slice(0, 24)}`;
    const withoutHash = deepFreeze({
      record_type: "beta19_event_athlete_link",
      contract_version: "full_ui_09c.1.0.0",
      event_athlete_link_id: linkId,
      event_id: eventId,
      event_version_at_link: eventVersion(event),
      event_record_sha256: cleanString(event.record_sha256),
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      assignment_id: cleanString(assignment?.assignment_id) || null,
      template_id: templateId || null,
      activity_id: cleanString(event.activity_id),
      link_state: "linked",
      link_revision: linkRevision(currentLink) + 1,
      previous_link_record_sha256:
        cleanString(currentLink?.record_sha256) || null,
      lifecycle_action: "athlete_linked",
      created_at_iso8601:
        cleanString(currentLink?.created_at_iso8601) || occurredAt,
      updated_at_iso8601: occurredAt,
      ordering_time_authority: "postgres_server_clock",
      immutable_link_history: true,
      factual_product_state: true,
      engine_visible: false,
      creates_team_runtime: false,
      creates_roster_runtime: false,
      creates_organisation_runtime: false
    });
    const link = await persistBetaProductRecord(
      deepFreeze({
        ...withoutHash,
        record_sha256: sha256(withoutHash)
      }),
      client
    );

    await client.query("COMMIT");
    return deepFreeze({ link, assignment });
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

export async function loadStandaloneEventDetail(
  coachUserIdInput: string,
  eventIdInput: string
): Promise<Readonly<JsonRecord>> {
  const coachUserId = cleanString(coachUserIdInput);
  const eventId = cleanString(eventIdInput);
  if (!coachUserId || !eventId) {
    throw new FullUi09cEventLifecycleError("event_detail_identity_required");
  }
  await requireActiveCoach(coachUserId);

  const client = await pool.connect();
  try {
    const current = await requireOwnedEvent(client, coachUserId, eventId);
    const [versions, links, currentLinks] = await Promise.all([
      eventHistory(client, coachUserId, eventId),
      eventLinkHistory(client, coachUserId, eventId),
      currentLinksForEvent(client, coachUserId, eventId)
    ]);

    const linkedAthletes = await Promise.all(
      currentLinks.map(async (link) => {
        const athleteUserId = cleanString(link.athlete_user_id);
        const auth = await loadLatestBetaProductRecord(
          "beta16_auth",
          athleteUserId,
          athleteUserId
        );
        const programme = await templateById(
          client,
          coachUserId,
          cleanString(link.template_id)
        );
        return deepFreeze({
          athlete_user_id: athleteUserId,
          display_name: cleanString(auth?.display_name) || athleteUserId,
          link,
          linked_programme: programme
        });
      })
    );

    const assignmentIds = [...new Set(
      links.map((link) => cleanString(link.assignment_id)).filter(Boolean)
    )];
    let assignments: JsonRecord[] = [];
    let sessions: JsonRecord[] = [];

    if (assignmentIds.length > 0) {
      const [assignmentResult, sessionResult] = await Promise.all([
        client.query(
          `
          SELECT record_payload
          FROM beta_product_records
          WHERE
            record_type = 'beta17_assignment_trigger'
            AND actor_user_id = $1
            AND record_id = ANY($2::text[])
          ORDER BY
            effective_at ASC,
            created_at ASC,
            record_sha256 ASC
          `,
          [coachUserId, assignmentIds]
        ),
        client.query(
          `
          SELECT
            session_id,
            block_id,
            status,
            planned_session,
            session_state_summary,
            beta_subject_user_id,
            beta_coach_user_id,
            beta_assignment_id,
            created_at,
            updated_at
          FROM sessions
          WHERE beta_assignment_id = ANY($1::text[])
          ORDER BY created_at ASC, session_id ASC
          `,
          [assignmentIds]
        )
      ]);
      assignments = assignmentResult.rows
        .map((row) => row.record_payload)
        .filter(isRecord);
      sessions = sessionResult.rows.map((row) => ({ ...row }));
    }

    const lifecycle = [
      ...versions.map(lifecycleRecord),
      ...links.map((link, index) => lifecycleRecord(link, versions.length + index))
    ].sort((left, right) =>
      cleanString(left.occurred_at_iso8601).localeCompare(
        cleanString(right.occurred_at_iso8601)
      ) ||
      cleanString(left.lifecycle_record_id).localeCompare(
        cleanString(right.lifecycle_record_id)
      )
    );

    return deepFreeze({
      route_id: "coach_event_detail",
      event_id: eventId,
      coach_user_id: coachUserId,
      event: current,
      event_versions: versions,
      linked_athletes: linkedAthletes.sort((left, right) =>
        cleanString(left.display_name).localeCompare(cleanString(right.display_name)) ||
        cleanString(left.athlete_user_id).localeCompare(cleanString(right.athlete_user_id))
      ),
      link_history: links,
      assignment_history: assignments,
      session_history: sessions,
      lifecycle_records: lifecycle,
      historical_preservation: {
        event_versions_retained: versions.length,
        link_records_retained: links.length,
        assignment_records_retained: assignments.length,
        session_records_retained: sessions.length
      },
      server_authoritative: true,
      engine_visible: false,
      creates_team_runtime: false,
      creates_roster_runtime: false,
      creates_organisation_runtime: false
    });
  }
  finally {
    client.release();
  }
}
