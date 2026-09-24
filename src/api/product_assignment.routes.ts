// DEV NOTE: FULL-UI-06 immutable coach assignment lifecycle.
// Assignment replacement and cancellation append product-state records only.
// Existing sessions remain unchanged and the deterministic engine is never called.

import crypto from "node:crypto";

import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";

import { pool } from "../db/pool.js";
import { createBeta17AssignmentRecord } from "./beta17_coach_managed_service.js";
import { loadActiveCoachTemplateById } from "./beta18_programme_template_service.js";
import { loadBeta17StoredCoachContext } from "./beta_product_record_store.js";
import { asyncHandler } from "./async_handler.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound
} from "./http_errors.js";
import {
  FullUi09cEventLifecycleError,
  assertNoDateConflict,
  latestOwnedEvent
} from "./full_ui_09c_event_lifecycle_service.js";

type JsonRecord = Record<string, unknown>;

type AssignmentActionInput = Readonly<{
  request_id: string;
  requested_at_iso8601: string;
  coach_user_id: string;
  athlete_user_id: string;
  template_id: string;
  activity_id: string;
  event_id: string;
}>;

function isRecord(value: unknown): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonicalValue(value[key])
        ])
    );
  }

  return value;
}

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        canonicalValue(value)
      ),
      "utf8"
    )
    .digest("hex");
}

function iso8601(value: unknown): string {
  const text = cleanString(value);
  const timestamp = Date.parse(text);

  if (
    !text ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== text
  ) {
    throw badRequest(
      "Enter a valid ISO-8601 assignment timestamp."
    );
  }

  return text;
}

function requestBody(req: Request): JsonRecord {
  if (!isRecord(req.body)) {
    throw badRequest(
      "Assignment action input is required."
    );
  }

  return req.body;
}

function replaceInput(req: Request): AssignmentActionInput {
  const body = requestBody(req);
  const requestId = cleanString(body.request_id);
  const requestedAt = iso8601(
    body.requested_at_iso8601
  );
  const coachUserId = cleanString(
    body.coach_user_id
  );
  const athleteUserId = cleanString(
    body.athlete_user_id
  );
  const templateId = cleanString(
    body.template_id
  );
  const activityId = cleanString(
    body.activity_id
  );
  const eventId = cleanString(
    body.event_id
  );

  if (
    !requestId ||
    !coachUserId ||
    !athleteUserId ||
    !templateId ||
    !activityId
  ) {
    throw badRequest(
      "Assignment replacement identity is incomplete."
    );
  }

  return Object.freeze({
    request_id: requestId,
    requested_at_iso8601: requestedAt,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    template_id: templateId,
    activity_id: activityId,
    event_id: eventId
  });
}

function cancelInput(req: Request): Readonly<{
  request_id: string;
  requested_at_iso8601: string;
  coach_user_id: string;
  athlete_user_id: string;
}> {
  const body = requestBody(req);
  const requestId = cleanString(body.request_id);
  const requestedAt = iso8601(
    body.requested_at_iso8601
  );
  const coachUserId = cleanString(
    body.coach_user_id
  );
  const athleteUserId = cleanString(
    body.athlete_user_id
  );

  if (
    !requestId ||
    !coachUserId ||
    !athleteUserId
  ) {
    throw badRequest(
      "Assignment cancellation identity is incomplete."
    );
  }

  return Object.freeze({
    request_id: requestId,
    requested_at_iso8601: requestedAt,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId
  });
}

async function latestAssignmentForUpdate(
  client: PoolClient,
  coachUserId: string,
  athleteUserId: string
): Promise<JsonRecord | null> {
  const result = await client.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta17_assignment_trigger'
      AND actor_user_id = $1
      AND subject_user_id = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_id DESC,
      record_sha256 DESC
    LIMIT 1
    FOR UPDATE
    `,
    [coachUserId, athleteUserId]
  );

  const payload =
    result.rows?.[0]?.record_payload;

  return isRecord(payload)
    ? payload
    : null;
}

async function latestEvent(
  coachUserId: string,
  eventId: string
): Promise<JsonRecord | null> {
  if (!eventId) return null;

  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_coach_event'
      AND actor_user_id = $1
      AND record_id = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [coachUserId, eventId]
  );

  const payload =
    result.rows?.[0]?.record_payload;

  return isRecord(payload)
    ? payload
    : null;
}

async function insertedRecord(
  client: PoolClient,
  record: JsonRecord
): Promise<JsonRecord> {
  const recordType = cleanString(
    record.record_type
  );

  const assignmentRecord =
    recordType ===
      "beta17_assignment_trigger";

  const recordId = cleanString(
    assignmentRecord
      ? record.assignment_id
      : record.event_athlete_link_id
  );

  const subjectUserId = cleanString(
    assignmentRecord
      ? record.assigned_athlete_id
      : record.athlete_user_id
  );

  const actorUserId = cleanString(
    assignmentRecord
      ? record.assigned_by_coach_id
      : record.coach_user_id
  );

  const effectiveAt = cleanString(
    assignmentRecord
      ? record.requested_at_iso8601
      : record.updated_at_iso8601
  );

  const recordHash = cleanString(
    record.record_sha256
  );

  if (
    !recordId ||
    !subjectUserId ||
    !actorUserId ||
    !effectiveAt ||
    !/^[a-f0-9]{64}$/u.test(recordHash)
  ) {
    throw conflict(
      "The assignment lifecycle record is invalid."
    );
  }

  await client.query(
    `
    INSERT INTO beta_product_records (
      record_type,
      record_id,
      subject_user_id,
      actor_user_id,
      effective_at,
      record_sha256,
      record_payload
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::timestamptz,
      $6,
      $7::jsonb
    )
    ON CONFLICT (
      record_type,
      record_id,
      record_sha256
    )
    DO NOTHING
    `,
    [
      recordType,
      recordId,
      subjectUserId,
      actorUserId,
      effectiveAt,
      recordHash,
      JSON.stringify(record)
    ]
  );

  const stored = await client.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = $1
      AND record_id = $2
      AND record_sha256 = $3
    LIMIT 1
    `,
    [recordType, recordId, recordHash]
  );

  const payload =
    stored.rows?.[0]?.record_payload;

  if (!isRecord(payload)) {
    throw conflict(
      "The assignment lifecycle record was not stored."
    );
  }

  return payload;
}

async function preservedSessionCount(
  client: PoolClient,
  assignmentId: string
): Promise<number> {
  const result = await client.query(
    `
    SELECT count(*)::integer AS count
    FROM sessions
    WHERE beta_assignment_id = $1
    `,
    [assignmentId]
  );

  return Number(
    result.rows?.[0]?.count ?? 0
  );
}

async function latestLinkedEventRecords(
  client: PoolClient,
  coachUserId: string,
  athleteUserId: string,
  assignmentId: string
): Promise<JsonRecord[]> {
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

  return result.rows
    .map((row) => row.record_payload)
    .filter(isRecord)
    .filter((record) =>
      cleanString(record.assignment_id) ===
        assignmentId &&
      cleanString(record.link_state) ===
        "linked"
    );
}

async function unlinkAssignmentEvents(
  client: PoolClient,
  coachUserId: string,
  athleteUserId: string,
  assignmentId: string,
  requestedAt: string,
  reason: "assignment_replaced" | "assignment_cancelled"
): Promise<number> {
  const links =
    await latestLinkedEventRecords(
      client,
      coachUserId,
      athleteUserId,
      assignmentId
    );

  for (const link of links) {
    const withoutHash: JsonRecord = {
      ...link,
      link_state: "unlinked",
      updated_at_iso8601: requestedAt,
      unlinked_at_iso8601: requestedAt,
      unlink_reason: reason,
      preserves_assignment_history: true,
      preserves_session_history: true,
      engine_visible: false
    };

    delete withoutHash.record_sha256;

    await insertedRecord(
      client,
      {
        ...withoutHash,
        record_sha256:
          sha256(withoutHash)
      }
    );
  }

  return links.length;
}

async function linkReplacementEvent(
  client: PoolClient,
  input: AssignmentActionInput,
  assignmentId: string
): Promise<JsonRecord | null> {
  if (!input.event_id) return null;

  // This is the same beta19_event_athlete_link write that
  // linkAthleteToStandaloneEvent makes, and must never be allowed to
  // create the exact same-date double-booking that guard exists to
  // prevent, just because it arrived through assignment replacement
  // instead of the direct link route.
  const targetEvent = await latestOwnedEvent(client, input.coach_user_id, input.event_id);
  if (targetEvent) {
    try {
      await assertNoDateConflict(client, input.coach_user_id, input.athlete_user_id, targetEvent);
    }
    catch (error) {
      if (error instanceof FullUi09cEventLifecycleError && error.reason === "event_link_date_conflict") {
        throw conflict("This athlete is already linked to another event on the same date.");
      }
      throw error;
    }
  }

  const linkId =
    `event_link_${sha256({
      coach_user_id:
        input.coach_user_id,
      athlete_user_id:
        input.athlete_user_id,
      event_id:
        input.event_id
    }).slice(0, 24)}`;

  const existing = await client.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_event_athlete_link'
      AND record_id = $1
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [linkId]
  );

  const existingPayload =
    existing.rows?.[0]?.record_payload;

  const withoutHash: JsonRecord = {
    record_type:
      "beta19_event_athlete_link",
    event_athlete_link_id: linkId,
    event_id: input.event_id,
    coach_user_id: input.coach_user_id,
    athlete_user_id:
      input.athlete_user_id,
    assignment_id: assignmentId,
    template_id: input.template_id,
    activity_id: input.activity_id,
    link_state: "linked",
    created_at_iso8601:
      isRecord(existingPayload)
        ? cleanString(
            existingPayload
              .created_at_iso8601
          ) || input.requested_at_iso8601
        : input.requested_at_iso8601,
    updated_at_iso8601:
      input.requested_at_iso8601,
    engine_visible: false,
    creates_team_runtime: false,
    creates_organisation_runtime: false
  };

  return insertedRecord(
    client,
    {
      ...withoutHash,
      record_sha256:
        sha256(withoutHash)
    }
  );
}

function currentAssignmentOrThrow(
  current: JsonRecord | null,
  routeAssignmentId: string,
  input: Readonly<{
    coach_user_id: string;
    athlete_user_id: string;
    requested_at_iso8601: string;
  }>
): JsonRecord {
  if (!current) {
    throw notFound(
      "No current assignment exists for this athlete."
    );
  }

  if (
    cleanString(current.assignment_id) !==
      routeAssignmentId
  ) {
    throw conflict(
      "This assignment is no longer current. Refresh assignment history."
    );
  }

  if (
    cleanString(current.assignment_status) !==
      "assigned"
  ) {
    throw conflict(
      "The current assignment is already inactive."
    );
  }

  if (
    cleanString(current.assigned_by_coach_id) !==
      input.coach_user_id ||
    cleanString(current.assigned_athlete_id) !==
      input.athlete_user_id
  ) {
    throw forbidden(
      "The assignment does not belong to this coach-athlete relationship."
    );
  }

  const currentAt = Date.parse(
    cleanString(
      current.requested_at_iso8601
    )
  );

  const actionAt = Date.parse(
    input.requested_at_iso8601
  );

  if (
    Number.isFinite(currentAt) &&
    actionAt <= currentAt
  ) {
    throw conflict(
      "Assignment lifecycle time must be later than the current assignment."
    );
  }

  return current;
}

async function validateReplacementInput(
  input: AssignmentActionInput
): Promise<Readonly<{
  coach_context: NonNullable<
    Awaited<ReturnType<
      typeof loadBeta17StoredCoachContext
    >>
  >;
  template: JsonRecord;
  event: JsonRecord | null;
}>> {
  const [coachContext, template, event] =
    await Promise.all([
      loadBeta17StoredCoachContext(
        input.coach_user_id,
        input.athlete_user_id
      ),
      loadActiveCoachTemplateById(
        input.coach_user_id,
        input.template_id
      ),
      latestEvent(
        input.coach_user_id,
        input.event_id
      )
    ]);

  if (!coachContext) {
    throw forbidden(
      "An accepted current coach-athlete relationship is required."
    );
  }

  if (
    !template ||
    cleanString(template.activity_id) !==
      input.activity_id
  ) {
    throw conflict(
      "Select an active programme for the athlete activity."
    );
  }

  if (input.event_id) {
    if (
      !event ||
      cleanString(event.event_status) !==
        "active"
    ) {
      throw conflict(
        "Select an active coach event."
      );
    }

    if (
      cleanString(event.activity_id) !==
        input.activity_id
    ) {
      throw conflict(
        "The event activity does not match the assignment."
      );
    }

    const eventSummary =
      isRecord(event.event_compile_summary)
        ? event.event_compile_summary
        : {};

    if (
      Number(template.week_count) !==
      Number(
        eventSummary.required_week_count
      )
    ) {
      throw conflict(
        "The event and programme week counts do not match."
      );
    }
  }

  return Object.freeze({
    coach_context: coachContext,
    template,
    event
  });
}

function replacementAssignmentRecord(
  input: AssignmentActionInput,
  context: NonNullable<
    Awaited<ReturnType<
      typeof loadBeta17StoredCoachContext
    >>
  >,
  template: JsonRecord,
  previousAssignmentId: string
): JsonRecord {
  const result =
    createBeta17AssignmentRecord({
      request_id: input.request_id,
      requested_at_iso8601:
        input.requested_at_iso8601,
      coach_profile:
        context.coach_profile,
      relationship:
        context.relationship,
      athlete_user_id:
        input.athlete_user_id,
      template_id:
        input.template_id,
      activity_id:
        input.activity_id
    });

  if (
    result.status !== 201 ||
    result.body.ok !== true ||
    !isRecord(
      result.body.assignment
    )
  ) {
    const reason = isRecord(result.body)
      ? cleanString(result.body.reason)
      : "";

    throw forbidden(
      reason ||
      "The replacement assignment was rejected."
    );
  }

  const withoutHash: JsonRecord = {
    ...result.body.assignment,
    template_version:
      Number(
        template.template_version ?? 0
      ),
    template_name:
      cleanString(template.template_name),
    event_id:
      input.event_id || null,
    replaces_assignment_id:
      previousAssignmentId,
    lifecycle_action: "replace",
    preserves_prior_sessions: true,
    engine_visible: false
  };

  delete withoutHash.record_sha256;

  return {
    ...withoutHash,
    record_sha256:
      sha256(withoutHash)
  };
}

function cancellationRecord(
  input: Readonly<{
    request_id: string;
    requested_at_iso8601: string;
    coach_user_id: string;
    athlete_user_id: string;
  }>,
  current: JsonRecord,
  preservedCount: number
): JsonRecord {
  const cancellationHash = sha256({
    request_id: input.request_id,
    requested_at_iso8601:
      input.requested_at_iso8601,
    coach_user_id:
      input.coach_user_id,
    athlete_user_id:
      input.athlete_user_id,
    cancels_assignment_id:
      cleanString(
        current.assignment_id
      )
  });

  const withoutHash: JsonRecord = {
    record_type:
      "beta17_assignment_trigger",
    assignment_id:
      `beta17_assignment_${cancellationHash.slice(0, 24)}`,
    assignment_hash:
      cancellationHash,
    upstream_contract: "S-V1-28",
    request_id: input.request_id,
    requested_at_iso8601:
      input.requested_at_iso8601,
    assigned_by_coach_id:
      input.coach_user_id,
    assigned_athlete_id:
      input.athlete_user_id,
    relationship_id:
      cleanString(
        current.relationship_id
      ),
    template_id:
      cleanString(current.template_id),
    template_version:
      Number(
        current.template_version ?? 0
      ),
    template_name:
      cleanString(current.template_name),
    activity_id:
      cleanString(current.activity_id),
    assignment_status: "cancelled",
    assignment_scope:
      "coach_athlete_assigned_execution",
    compile_input_status:
      "cancelled_before_future_session_creation",
    cancels_assignment_id:
      cleanString(current.assignment_id),
    lifecycle_action: "cancel",
    preserved_session_count:
      preservedCount,
    preserves_existing_sessions: true,
    engine_visible: false,
    assignment_mutates_engine_truth: false,
    athlete_declaration_mutated: false,
    registries_mutated: false,
    engine_decision_overridden: false,
    copy_id:
      "full_ui_06.assignment_cancelled"
  };

  return {
    ...withoutHash,
    record_sha256:
      sha256(withoutHash)
  };
}

async function replaceAssignment(
  req: Request,
  res: Response
) {
  const assignmentId = cleanString(
    req.params.assignment_id
  );

  if (!assignmentId) {
    throw badRequest(
      "Assignment ID is required."
    );
  }

  const input = replaceInput(req);
  const validated =
    await validateReplacementInput(input);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current =
      currentAssignmentOrThrow(
        await latestAssignmentForUpdate(
          client,
          input.coach_user_id,
          input.athlete_user_id
        ),
        assignmentId,
        input
      );

    const oldAssignmentId =
      cleanString(current.assignment_id);

    const preservedCount =
      await preservedSessionCount(
        client,
        oldAssignmentId
      );

    const replacement =
      replacementAssignmentRecord(
        input,
        validated.coach_context,
        validated.template,
        oldAssignmentId
      );

    const storedAssignment =
      await insertedRecord(
        client,
        replacement
      );

    const unlinkedEventCount =
      await unlinkAssignmentEvents(
        client,
        input.coach_user_id,
        input.athlete_user_id,
        oldAssignmentId,
        input.requested_at_iso8601,
        "assignment_replaced"
      );

    const eventLink =
      await linkReplacementEvent(
        client,
        input,
        cleanString(
          storedAssignment.assignment_id
        )
      );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      lifecycle_action: "replace",
      previous_assignment_id:
        oldAssignmentId,
      assignment: storedAssignment,
      event_link: eventLink,
      unlinked_event_count:
        unlinkedEventCount,
      preserved_session_count:
        preservedCount,
      preserves_existing_sessions: true,
      calls_engine: false,
      engine_visible: false
    });
  }
  catch (error) {
    await client
      .query("ROLLBACK")
      .catch(() => undefined);

    throw error;
  }
  finally {
    client.release();
  }
}

async function cancelAssignment(
  req: Request,
  res: Response
) {
  const assignmentId = cleanString(
    req.params.assignment_id
  );

  if (!assignmentId) {
    throw badRequest(
      "Assignment ID is required."
    );
  }

  const input = cancelInput(req);
  const context =
    await loadBeta17StoredCoachContext(
      input.coach_user_id,
      input.athlete_user_id
    );

  if (!context) {
    throw forbidden(
      "An accepted current coach-athlete relationship is required."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current =
      currentAssignmentOrThrow(
        await latestAssignmentForUpdate(
          client,
          input.coach_user_id,
          input.athlete_user_id
        ),
        assignmentId,
        input
      );

    const oldAssignmentId =
      cleanString(current.assignment_id);

    const preservedCount =
      await preservedSessionCount(
        client,
        oldAssignmentId
      );

    const cancellation =
      cancellationRecord(
        input,
        current,
        preservedCount
      );

    const storedCancellation =
      await insertedRecord(
        client,
        cancellation
      );

    const unlinkedEventCount =
      await unlinkAssignmentEvents(
        client,
        input.coach_user_id,
        input.athlete_user_id,
        oldAssignmentId,
        input.requested_at_iso8601,
        "assignment_cancelled"
      );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      lifecycle_action: "cancel",
      previous_assignment_id:
        oldAssignmentId,
      assignment: storedCancellation,
      unlinked_event_count:
        unlinkedEventCount,
      preserved_session_count:
        preservedCount,
      preserves_existing_sessions: true,
      calls_engine: false,
      engine_visible: false
    });
  }
  catch (error) {
    await client
      .query("ROLLBACK")
      .catch(() => undefined);

    throw error;
  }
  finally {
    client.release();
  }
}

export const productAssignmentRouter =
  Router();

productAssignmentRouter.post(
  "/athlete-assignment/:assignment_id/replace",
  asyncHandler(replaceAssignment)
);

productAssignmentRouter.post(
  "/athlete-assignment/:assignment_id/cancel",
  asyncHandler(cancelAssignment)
);
