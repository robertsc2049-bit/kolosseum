// DEV NOTE: FULL-UI-14C athlete-facing "Today" read model.
// This module only reads already-persisted, server-authoritative product
// state (assignment, relationship, template, session, event, and any
// advisory message from the coach). It never mutates anything and never
// lets an advisory message or client-cached value change which exercise,
// load, order, or session is presented as current.

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext
} from "./beta_product_record_store.js";
import {
  Beta18ProgrammeTemplateError,
  loadExecutableCoachTemplateById,
  materialiseNextCoachTemplateProgram
} from "./beta18_programme_template_service.js";
import {
  getSessionStateQuery
} from "./session_state_query_service.js";
import {
  loadAthleteVisibleAdvisoryMessages
} from "./athlete_today_notes_service.js";

type JsonRecord = Record<string, unknown>;

export class AthleteTodayError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`athlete_today_${reason}`);
    this.name = "AthleteTodayError";
    this.reason = reason;
  }
}

const TODAY_STATES = new Set([
  "ok",
  "no_session",
  "session_already_complete",
  "programme_complete",
  "no_current_assignment",
  "missing_strength_reference",
  "relationship_ended"
]);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function baseResponse(
  state: string,
  athleteUserId: string,
  extra: JsonRecord = {}
): Readonly<JsonRecord> {
  if (!TODAY_STATES.has(state)) {
    throw new AthleteTodayError("state_invalid");
  }

  return deepFreeze({
    route_id: "athlete_today",
    athlete_user_id: athleteUserId,
    state,
    coach_user_id: null,
    assignment: null,
    session: null,
    event: null,
    notes: [],
    factual_only: true,
    server_authoritative: true,
    ...extra
  });
}

// Mirrors the exact current-assignment derivation already used for the
// coach-facing athlete detail view (beta19_coach_workspace_service.ts), just
// scoped by athlete instead of by coach, since an assignment's own
// assigned_by_coach_id carries the coach identity.
async function loadCurrentAssignment(
  athleteUserId: string
): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta17_assignment_trigger'
      AND subject_user_id = $1
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_id DESC,
      record_sha256 DESC
    `,
    [athleteUserId]
  );

  const records = result.rows
    .map((row) => (isRecord(row.record_payload) ? row.record_payload : null))
    .filter((record): record is JsonRecord => record !== null);

  if (records.length === 0) {
    return null;
  }

  // The most recent assignment record for this athlete, across every coach
  // they have ever had, is authoritative by construction: a cancellation or
  // replacement is itself a newer record, so nothing can supersede the
  // newest row except a still-newer row that would already be at index 0
  // instead. Its own declared assignment_status is therefore sufficient.
  const latest = records[0];
  const lifecycleStatus = cleanString(latest.assignment_status) || "assigned";

  return lifecycleStatus === "assigned" ? latest : null;
}

// Distinguishes "no event linked" (null) from "an event was linked but is no
// longer showable" ({status:"unavailable"}) - loadEventBindingForAssignment
// (beta19_coach_event_service.ts) collapses both cases to null, which is the
// right shape for compile-time event override but the wrong shape for a
// Today read where the two must be told apart.
async function loadTodayEventStatus(
  coachUserId: string,
  athleteUserId: string,
  assignmentId: string
): Promise<Readonly<JsonRecord> | null> {
  const linkResult = await pool.query(
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

  const link = linkResult.rows?.[0]?.record_payload;
  if (!isRecord(link)) {
    return null;
  }

  const eventId = cleanString(link.event_id);
  if (!eventId) {
    return null;
  }

  const eventResult = await pool.query(
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

  const event = eventResult.rows?.[0]?.record_payload;
  if (!isRecord(event)) {
    return deepFreeze({ status: "unavailable", event_id: eventId, reason: "event_not_found" });
  }

  if (event.event_status !== "active") {
    return deepFreeze({
      status: "unavailable",
      event_id: eventId,
      reason:
        event.event_status === "cancelled"
          ? "event_cancelled"
          : event.event_status === "archived"
            ? "event_archived"
            : "event_inaccessible"
    });
  }

  const eventPlan = isRecord(event.event_plan) ? event.event_plan : {};
  const compileSummary = isRecord(event.event_compile_summary) ? event.event_compile_summary : {};

  return deepFreeze({
    status: "active",
    event_id: eventId,
    event_name: cleanString(eventPlan.event_name),
    event_type: cleanString(eventPlan.event_type),
    event_date: cleanString(eventPlan.event_date),
    programme_start_date: cleanString(eventPlan.programme_start_date),
    location: cleanString(eventPlan.location),
    required_week_count: Number(compileSummary.required_week_count ?? 0) || null
  });
}


async function latestSessionForAssignment(
  assignmentId: string
): Promise<{ session_id: string } | null> {
  const result = await pool.query(
    `
    SELECT session_id
    FROM sessions
    WHERE beta_assignment_id = $1
    ORDER BY created_at DESC, session_id DESC
    LIMIT 1
    `,
    [assignmentId]
  );

  const sessionId = cleanString(result.rows?.[0]?.session_id);
  return sessionId ? { session_id: sessionId } : null;
}

function sessionContextFromMaterialised(
  materialised: JsonRecord,
  action: "start" | "start_next" | "continue",
  existingSessionId: string | null,
  totalSessionCount: number
): Readonly<JsonRecord> {
  const execution = isRecord(materialised.coach_template_execution)
    ? materialised.coach_template_execution
    : {};

  return deepFreeze({
    action,
    session_id: existingSessionId,
    template_session_index: Number(execution.template_session_index ?? 0),
    template_session_title: cleanString(execution.template_session_title),
    template_block_id: cleanString(execution.template_block_id),
    template_block_name: cleanString(execution.template_block_name),
    template_block_order: execution.template_block_order ?? null,
    template_week_id: cleanString(execution.template_week_id),
    template_week_order: execution.template_week_order ?? null,
    template_week_index_global: execution.template_week_index_global ?? null,
    total_session_count: totalSessionCount,
    target_exercise_id: cleanString(materialised.target_exercise_id),
    planned_items: Array.isArray(materialised.planned_items) ? materialised.planned_items : []
  });
}

export async function loadAthleteTodayView(
  athleteUserIdInput: string
): Promise<Readonly<JsonRecord>> {
  const athleteUserId = cleanString(athleteUserIdInput);

  if (!athleteUserId) {
    throw new AthleteTodayError("athlete_identity_required");
  }

  const assignment = await loadCurrentAssignment(athleteUserId);

  if (!assignment) {
    return baseResponse("no_current_assignment", athleteUserId);
  }

  const coachUserId = cleanString(assignment.assigned_by_coach_id);
  const assignmentId = cleanString(assignment.assignment_id);
  const templateId = cleanString(assignment.template_id);

  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);

  if (
    !context ||
    cleanString(context.relationship.relationship_state) !== "accepted"
  ) {
    return baseResponse("relationship_ended", athleteUserId, {
      coach_user_id: coachUserId || null
    });
  }

  const notes = await loadAthleteVisibleAdvisoryMessages(coachUserId, athleteUserId);

  const template = await loadExecutableCoachTemplateById(coachUserId, templateId);

  const assignmentSummary = template
    ? deepFreeze({
        assignment_id: assignmentId,
        template_id: templateId,
        template_name: cleanString(template.template_name),
        template_version: Number(template.template_version ?? 1),
        activity_id: cleanString(template.activity_id)
      })
    : deepFreeze({
        assignment_id: assignmentId,
        template_id: templateId,
        template_name: "",
        template_version: null,
        activity_id: cleanString(assignment.activity_id)
      });

  const totalSessionCount = template ? Number(template.session_count ?? 0) : 0;

  const event = await loadTodayEventStatus(coachUserId, athleteUserId, assignmentId);

  let materialised: JsonRecord | null = null;

  try {
    materialised = (await materialiseNextCoachTemplateProgram({
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      assignment_id: assignmentId,
      template_id: templateId,
      base_program: {}
    })) as JsonRecord;
  }
  catch (error) {
    if (error instanceof Beta18ProgrammeTemplateError) {
      if (error.reason === "assigned_template_sessions_exhausted") {
        return baseResponse("programme_complete", athleteUserId, {
          coach_user_id: coachUserId,
          assignment: assignmentSummary,
          event,
          notes
        });
      }

      if (error.reason === "athlete_one_rep_max_missing") {
        return baseResponse("missing_strength_reference", athleteUserId, {
          coach_user_id: coachUserId,
          assignment: assignmentSummary,
          event,
          notes
        });
      }
    }

    throw error;
  }

  const nextIndex = Number(
    isRecord(materialised.coach_template_execution)
      ? materialised.coach_template_execution.template_session_index ?? 0
      : 0
  );

  if (nextIndex === 0) {
    return baseResponse("no_session", athleteUserId, {
      coach_user_id: coachUserId,
      assignment: assignmentSummary,
      session: sessionContextFromMaterialised(materialised, "start", null, totalSessionCount),
      event,
      notes
    });
  }

  const existing = await latestSessionForAssignment(assignmentId);

  if (!existing) {
    // Defensive: a positive index implies a session row exists. Fall back to
    // the same lawful "start" action rather than guessing.
    return baseResponse("no_session", athleteUserId, {
      coach_user_id: coachUserId,
      assignment: assignmentSummary,
      session: sessionContextFromMaterialised(materialised, "start", null, totalSessionCount),
      event,
      notes
    });
  }

  const existingState = await getSessionStateQuery(existing.session_id);
  const executionStatus = cleanString((existingState as JsonRecord)?.execution_status);
  const terminal = executionStatus === "completed" || executionStatus === "partial";

  if (!terminal) {
    // The auto-counted `materialised` above describes the NEXT session to be
    // created (index nextIndex), not the one that already exists and is open
    // (index nextIndex - 1). Re-materialise at that exact index so the
    // displayed block/week/resolved-load facts describe the real, existing
    // session rather than a not-yet-created one.
    const currentSessionMaterialised = (await materialiseNextCoachTemplateProgram({
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      assignment_id: assignmentId,
      template_id: templateId,
      base_program: {},
      session_index_override: nextIndex - 1
    })) as JsonRecord;

    return baseResponse("ok", athleteUserId, {
      coach_user_id: coachUserId,
      assignment: assignmentSummary,
      session: sessionContextFromMaterialised(
        currentSessionMaterialised,
        "continue",
        existing.session_id,
        totalSessionCount
      ),
      event,
      notes
    });
  }

  return baseResponse("session_already_complete", athleteUserId, {
    coach_user_id: coachUserId,
    assignment: assignmentSummary,
    session: sessionContextFromMaterialised(materialised, "start_next", null, totalSessionCount),
    event,
    notes
  });
}
