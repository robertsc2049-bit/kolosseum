
// DEV NOTE: FULL-UI-16C athlete-facing training history read model.
// This module only reads already-persisted, server-authoritative session
// state (planned_session, session_state_summary, runtime_events) and
// immutable product records (assignment/programme/event provenance). It
// never mutates anything, never infers a performance score, and filtering
// never alters the underlying record - it only narrows which already-true
// rows are returned.

import { pool } from "../db/pool.js";
import {
  deriveTrace,
  normalizeSummary
} from "@kolosseum/engine/runtime/session_summary.js";
import {
  type PlannedSession,
  ensureReturnDecisionContract,
  projectSessionStatePayload
} from "./session_state_read_model.js";
import {
  loadLatestBetaProductRecord
} from "./beta_product_record_store.js";
import {
  loadExecutableCoachTemplateById
} from "./beta18_programme_template_service.js";
import {
  BETA17_COACH_COPY_IDS,
  beta17CoachManagedContract
} from "./beta17_coach_managed_service.js";

type JsonRecord = Record<string, unknown>;

type BetaHttpResult = Readonly<{
  status: number;
  body: Readonly<JsonRecord>;
}>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isoString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  const text = cleanString(value);
  return text || null;
}

function accessDenied(reason: string): BetaHttpResult {
  return Object.freeze({
    status: 403,
    body: Object.freeze({
      ok: false,
      surface_id: beta17CoachManagedContract.surface_id,
      failure_token: "beta17_coach_managed_invalid",
      reason,
      product_permission_state_only: true,
      engine_visible: false,
      copy_id: BETA17_COACH_COPY_IDS.accessDenied
    })
  });
}

function badRequestResult(reason: string): BetaHttpResult {
  return Object.freeze({
    status: 400,
    body: Object.freeze({
      ok: false,
      reason,
      product_permission_state_only: true,
      engine_visible: false
    })
  });
}

function notFoundResult(reason: string): BetaHttpResult {
  return Object.freeze({
    status: 404,
    body: Object.freeze({
      ok: false,
      reason,
      product_permission_state_only: true,
      engine_visible: false
    })
  });
}

async function assertActiveAthlete(athleteUserId: string): Promise<BetaHttpResult | null> {
  const authRecord = await loadLatestBetaProductRecord("beta16_auth", athleteUserId, athleteUserId);
  if (!authRecord || authRecord.account_role !== "athlete" || authRecord.account_state !== "active") {
    return accessDenied("athlete_history_access_denied");
  }
  return null;
}

function projectSession(row: JsonRecord) {
  const planned = row.planned_session as PlannedSession;
  const { summary: normalized } = normalizeSummary(planned as any, row.session_state_summary);
  const upgraded = ensureReturnDecisionContract(normalized, deriveTrace);
  const trace = deriveTrace(upgraded.summary as any) as any;
  return projectSessionStatePayload(String(row.session_id), planned, upgraded.summary, trace);
}

export type AthleteHistoryProvenance = {
  assignment: Readonly<JsonRecord> | null;
  programme: Readonly<JsonRecord> | null;
  event: Readonly<JsonRecord> | null;
};

const provenanceCacheBySession = new Map<string, Promise<AthleteHistoryProvenance>>();

// Provenance is loaded per distinct assignment_id and memoised for the
// lifetime of a single request-driven call chain (list/detail/export all
// build their own fresh Map) - this is deliberately request-scoped, not a
// long-lived cache, since assignment/programme/event records are immutable
// once persisted and re-fetching per session in a long history is wasted
// work.
async function loadProvenanceForAssignment(assignmentId: string | null): Promise<AthleteHistoryProvenance> {
  if (!assignmentId) {
    return { assignment: null, programme: null, event: null };
  }

  const assignmentResult = await pool.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'beta17_assignment_trigger' AND record_id = $1
     LIMIT 1`,
    [assignmentId]
  );

  const assignmentPayload = assignmentResult.rows?.[0]?.record_payload;
  if (!isRecord(assignmentPayload)) {
    return { assignment: null, programme: null, event: null };
  }

  const templateId = cleanString(assignmentPayload.template_id);
  const coachUserId = cleanString(assignmentPayload.assigned_by_coach_id);

  let programme: Readonly<JsonRecord> | null = null;
  if (templateId && coachUserId) {
    const template = await loadExecutableCoachTemplateById(coachUserId, templateId).catch(() => null);
    if (template) {
      programme = Object.freeze({
        template_id: templateId,
        template_name: cleanString(template.template_name),
        template_version: Number(template.template_version ?? 1),
        activity_id: cleanString(template.activity_id)
      });
    }
  }

  let event: Readonly<JsonRecord> | null = null;
  const linkResult = await pool.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'beta19_event_athlete_link'
       AND record_payload ->> 'assignment_id' = $1
       AND record_payload ->> 'link_state' = 'linked'
     ORDER BY effective_at DESC, created_at DESC, record_sha256 DESC
     LIMIT 1`,
    [assignmentId]
  );

  const link = linkResult.rows?.[0]?.record_payload;
  if (isRecord(link)) {
    const eventId = cleanString(link.event_id);
    if (eventId) {
      const eventResult = await pool.query(
        `SELECT record_payload FROM beta_product_records
         WHERE record_type = 'beta19_coach_event' AND record_id = $1
         LIMIT 1`,
        [eventId]
      );

      const eventPayload = eventResult.rows?.[0]?.record_payload;
      if (isRecord(eventPayload)) {
        const eventPlan = isRecord(eventPayload.event_plan) ? eventPayload.event_plan : {};
        event = Object.freeze({
          event_id: eventId,
          event_name: cleanString((eventPlan as JsonRecord).event_name),
          event_status: cleanString(eventPayload.event_status)
        });
      }
    }
  }

  return {
    assignment: Object.freeze({
      assignment_id: assignmentId,
      assignment_status: cleanString(assignmentPayload.assignment_status),
      coach_user_id: coachUserId
    }),
    programme,
    event
  };
}

async function loadProvenanceCached(
  cache: Map<string, Promise<AthleteHistoryProvenance>>,
  assignmentId: string | null
): Promise<AthleteHistoryProvenance> {
  if (!assignmentId) return { assignment: null, programme: null, event: null };
  if (!cache.has(assignmentId)) {
    cache.set(assignmentId, loadProvenanceForAssignment(assignmentId));
  }
  return cache.get(assignmentId)!;
}

type EnrichedHistorySession = {
  session_id: string;
  block_id: string;
  status: string;
  assignment_id: string | null;
  runtime_event_count: number;
  created_at: string | null;
  updated_at: string | null;
  activity_id: string | null;
  execution_status: "ready" | "in_progress" | "completed" | "partial";
  completed_count: number;
  dropped_count: number;
  remaining_count: number;
  split_entered: boolean;
  split_return_decision: "continue" | "skip" | null;
  provenance: AthleteHistoryProvenance;
};

export type AthleteHistoryFilters = Readonly<{
  status: string | null;
  date_from: string | null;
  date_to: string | null;
  activity_id: string | null;
  template_id: string | null;
  event_id: string | null;
}>;

function parseFilters(input: JsonRecord): AthleteHistoryFilters {
  return Object.freeze({
    status: cleanString(input.status) || null,
    date_from: cleanString(input.date_from) || null,
    date_to: cleanString(input.date_to) || null,
    activity_id: cleanString(input.activity_id) || null,
    template_id: cleanString(input.template_id) || null,
    event_id: cleanString(input.event_id) || null
  });
}

function matchesFilters(session: EnrichedHistorySession, filters: AthleteHistoryFilters): boolean {
  // date_from/date_to are compared by calendar day only, so a date_to of
  // "2026-07-31" includes every session created that whole day regardless
  // of its time-of-day component.
  const createdDate = session.created_at ? session.created_at.slice(0, 10) : null;

  if (filters.status && session.execution_status !== filters.status) return false;
  if (filters.date_from && (!createdDate || createdDate < filters.date_from)) return false;
  if (filters.date_to && (!createdDate || createdDate > filters.date_to)) return false;
  if (filters.activity_id && session.activity_id !== filters.activity_id) return false;
  if (filters.template_id && session.provenance.programme?.template_id !== filters.template_id) return false;
  if (filters.event_id && session.provenance.event?.event_id !== filters.event_id) return false;
  return true;
}

async function loadEnrichedAthleteSessions(athleteUserId: string): Promise<EnrichedHistorySession[]> {
  const result = await pool.query(
    `
    SELECT
      s.session_id, s.block_id, s.status, s.planned_session, s.session_state_summary,
      s.beta_assignment_id, s.created_at, s.updated_at,
      b.phase1_input ->> 'activity_id' AS activity_id,
      count(re.seq)::integer AS runtime_event_count
    FROM sessions s
    JOIN blocks b ON b.block_id = s.block_id
    LEFT JOIN runtime_events re ON re.session_id = s.session_id
    WHERE s.beta_subject_user_id = $1
    GROUP BY
      s.session_id, s.block_id, s.status, s.planned_session, s.session_state_summary,
      s.beta_assignment_id, s.created_at, s.updated_at, b.phase1_input
    ORDER BY s.created_at ASC, s.session_id ASC
    `,
    [athleteUserId]
  );

  const provenanceCache = new Map<string, Promise<AthleteHistoryProvenance>>();
  const enriched: EnrichedHistorySession[] = [];

  for (const row of result.rows) {
    const projected = projectSession(row);
    const assignmentId = cleanString(row.beta_assignment_id) || null;
    const provenance = await loadProvenanceCached(provenanceCache, assignmentId);
    const summary = projected.session_execution_summary?.[0] as JsonRecord | undefined;

    enriched.push({
      session_id: String(row.session_id),
      block_id: String(row.block_id),
      status: String(row.status),
      assignment_id: assignmentId,
      runtime_event_count: Number(row.runtime_event_count),
      created_at: isoString(row.created_at),
      updated_at: isoString(row.updated_at),
      activity_id: cleanString(row.activity_id) || null,
      execution_status: projected.execution_status,
      completed_count: projected.completed_exercises.length,
      dropped_count: projected.dropped_exercises.length,
      remaining_count: projected.remaining_exercises.length,
      split_entered: Boolean(summary?.split_entered),
      split_return_decision: (summary?.split_return_decision as "continue" | "skip" | null) ?? null,
      provenance
    });
  }

  return enriched;
}

/**
 * FUNCTION NOTE:
 * Purpose: Returns the athlete's factual session history, enriched with
 * execution status, planned-vs-recorded counts, split/return flags and
 * programme/assignment/event provenance, narrowed by any supplied filters.
 * Boundary: Read-only; never mutates a session or infers a performance score.
 * Determinism: Sessions are ordered by persisted creation time and identifier;
 * filters only narrow the already-true result set.
 * Failure: Missing active athlete state returns access denial.
 */
export async function buildAthleteHistoryListResult(input: unknown): Promise<BetaHttpResult> {
  if (!isRecord(input)) return accessDenied("athlete_history_input_invalid");

  const athleteUserId = cleanString(input.athlete_user_id);
  if (!athleteUserId) return accessDenied("athlete_history_identity_required");

  const denied = await assertActiveAthlete(athleteUserId);
  if (denied) return denied;

  const filters = parseFilters(input);
  const enriched = await loadEnrichedAthleteSessions(athleteUserId);
  const filtered = enriched.filter((session) => matchesFilters(session, filters));

  return Object.freeze({
    status: 200,
    body: Object.freeze({
      ok: true,
      record_type: "beta_e2e_athlete_history",
      athlete_user_id: athleteUserId,
      session_count: filtered.length,
      total_session_count: enriched.length,
      sessions: Object.freeze(filtered),
      filters_applied: filters,
      factual_records_only: true,
      calls_engine: false,
      read_only: true
    })
  });
}

async function loadFullSessionRow(sessionId: string): Promise<JsonRecord | null> {
  const result = await pool.query(
    `SELECT session_id, block_id, status, planned_session, session_state_summary,
            beta_subject_user_id, beta_coach_user_id, beta_assignment_id, created_at, updated_at
     FROM sessions
     WHERE session_id = $1`,
    [sessionId]
  );
  return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
}

async function loadOrderedRuntimeEvents(sessionId: string): Promise<Array<{ seq: number; event: JsonRecord; created_at: string | null }>> {
  const result = await pool.query(
    `SELECT seq, event, created_at FROM runtime_events WHERE session_id = $1 ORDER BY seq ASC`,
    [sessionId]
  );

  return result.rows.map((row) => ({
    seq: Number(row.seq),
    event: isRecord(row.event) ? row.event : {},
    created_at: isoString(row.created_at)
  }));
}

/**
 * FUNCTION NOTE:
 * Purpose: Returns one session's complete factual detail - planned versus
 * recorded state per exercise, split/return record, skip reason and pain
 * annotations, substitution facts, and programme/assignment/event provenance.
 * Boundary: Read-only; rejects access to any session not owned by the caller.
 * Determinism: Facts are derived from the same engine reducer trace and the
 * immutable runtime event log used by the live session view.
 * Failure: Missing session or cross-athlete access returns not-found/denial.
 */
export async function buildAthleteHistoryDetailResult(input: unknown): Promise<BetaHttpResult> {
  if (!isRecord(input)) return accessDenied("athlete_history_input_invalid");

  const athleteUserId = cleanString(input.athlete_user_id);
  const sessionId = cleanString(input.session_id);

  if (!athleteUserId) return accessDenied("athlete_history_identity_required");
  if (!sessionId) return badRequestResult("athlete_history_session_id_required");

  const denied = await assertActiveAthlete(athleteUserId);
  if (denied) return denied;

  const row = await loadFullSessionRow(sessionId);
  if (!row) return notFoundResult("athlete_history_session_not_found");

  if (cleanString(row.beta_subject_user_id) !== athleteUserId) {
    return accessDenied("athlete_history_detail_forbidden");
  }

  const projected = projectSession(row);
  const rawEvents = await loadOrderedRuntimeEvents(sessionId);

  const skipReasons = new Map<string, string>();
  const painReports = new Set<string>();
  const rpeReports = new Map<string, number>();
  const substitutions = new Map<string, { substituted_exercise_id: string; substitution_edge_id: string }>();
  const splitReturnEvents: Array<{ type: string; seq: number; created_at: string | null }> = [];

  for (const { event, seq, created_at } of rawEvents) {
    const type = typeof event.type === "string" ? event.type : "";

    if (type === "SKIP_EXERCISE" && typeof event.exercise_id === "string" && typeof event.reason_code === "string") {
      skipReasons.set(event.exercise_id, event.reason_code);
    }

    if (type === "PAIN_REPORT" && typeof event.exercise_id === "string" && event.pain_reported === true) {
      painReports.add(event.exercise_id);
    }

    if (type === "RPE_REPORT" && typeof event.exercise_id === "string" && Number.isInteger(event.rpe_value)) {
      rpeReports.set(event.exercise_id, event.rpe_value as number);
    }

    if (
      (type === "COMPLETE_EXERCISE" || type === "SKIP_EXERCISE") &&
      typeof event.exercise_id === "string" &&
      typeof event.substituted_exercise_id === "string" &&
      typeof event.substitution_edge_id === "string"
    ) {
      substitutions.set(event.exercise_id, {
        substituted_exercise_id: event.substituted_exercise_id,
        substitution_edge_id: event.substitution_edge_id
      });
    }

    if (type === "SPLIT_SESSION" || type === "RETURN_CONTINUE" || type === "RETURN_SKIP") {
      splitReturnEvents.push({ type, seq, created_at });
    }
  }

  const plannedExercises = Array.isArray((row.planned_session as JsonRecord)?.exercises)
    ? ((row.planned_session as JsonRecord).exercises as JsonRecord[])
    : [];

  const completedIds = new Set(projected.completed_exercises.map((ex: any) => ex.exercise_id));
  const droppedIds = new Set(projected.dropped_exercises.map((ex: any) => ex.exercise_id));
  const remainingIds = new Set(projected.remaining_exercises.map((ex: any) => ex.exercise_id));

  const exercises = plannedExercises.map((ex) => {
    const exerciseId = cleanString(ex.exercise_id);
    const recordedState = completedIds.has(exerciseId)
      ? "completed"
      : droppedIds.has(exerciseId)
        ? "dropped"
        : remainingIds.has(exerciseId)
          ? "remaining"
          : "unknown";

    return Object.freeze({
      exercise_id: exerciseId,
      planned: Object.freeze(ex),
      recorded_state: recordedState,
      skip_reason: skipReasons.get(exerciseId) ?? null,
      pain_reported: painReports.has(exerciseId),
      rpe_reported: rpeReports.get(exerciseId) ?? null,
      substitution: substitutions.get(exerciseId) ?? null
    });
  });

  const summary = projected.session_execution_summary?.[0] as JsonRecord | undefined;
  const provenance = await loadProvenanceForAssignment(cleanString(row.beta_assignment_id) || null);

  return Object.freeze({
    status: 200,
    body: Object.freeze({
      ok: true,
      record_type: "athlete_history_detail",
      athlete_user_id: athleteUserId,
      session_id: sessionId,
      block_id: String(row.block_id),
      status: String(row.status),
      created_at: isoString(row.created_at),
      updated_at: isoString(row.updated_at),
      execution_status: projected.execution_status,
      started: projected.started === true,
      exercises: Object.freeze(exercises),
      split_entered: Boolean(summary?.split_entered),
      split_return_decision: (summary?.split_return_decision as "continue" | "skip" | null) ?? null,
      split_return_events: Object.freeze(splitReturnEvents),
      provenance,
      factual_records_only: true,
      calls_engine: false,
      read_only: true
    })
  });
}

export {
  loadEnrichedAthleteSessions,
  loadProvenanceForAssignment,
  loadOrderedRuntimeEvents,
  loadFullSessionRow,
  assertActiveAthlete,
  accessDenied as athleteHistoryAccessDenied
};
