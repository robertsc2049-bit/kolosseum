
// DEV NOTE: FULL-UI-16C server-generated athlete history export. This file
// only assembles already-persisted, authoritative rows and hands them to the
// existing S-V1-L-02 GDPR export boundary (src/v1GdprExportHandling.mjs,
// unmodified/sealed) for permission-scoped, hash-sealed serialization. It
// never builds a client-facing CSV from cached state and never widens the
// export boundary's own allow-lists.

import crypto from "node:crypto";
import { pool } from "../db/pool.js";
// @ts-ignore - .mjs source, no type declarations
import { createGdprExportHandling } from "../v1GdprExportHandling.mjs";
import {
  assertActiveAthlete,
  athleteHistoryAccessDenied,
  loadEnrichedAthleteSessions
} from "./athlete_history_service.js";

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

/**
 * FUNCTION NOTE:
 * Purpose: Builds a server-generated, hash-sealed export of the athlete's own
 * training history via the existing S-V1-L-02 GDPR export boundary.
 * Boundary: Read-only; delegates all permission/shape enforcement to
 * createGdprExportHandling, which this module never bypasses or widens.
 * Determinism: Session and runtime-event rows are ordered identically to the
 * history list/detail endpoints before being handed to the export boundary.
 * Failure: Missing active athlete state returns access denial; any record
 * that fails the export boundary's own ownership/shape checks fails closed.
 */
export async function buildAthleteHistoryExportResult(input: unknown): Promise<BetaHttpResult> {
  if (!isRecord(input)) return athleteHistoryAccessDenied("athlete_history_input_invalid");

  const athleteUserId = cleanString(input.athlete_user_id);
  if (!athleteUserId) return athleteHistoryAccessDenied("athlete_history_identity_required");

  const denied = await assertActiveAthlete(athleteUserId);
  if (denied) return denied;

  const sessions = await loadEnrichedAthleteSessions(athleteUserId);

  const sessionRecords = sessions.map((session) => ({
    athlete_user_id: athleteUserId,
    session_id: session.session_id,
    block_id: session.block_id,
    status: session.status,
    assignment_id: session.assignment_id,
    runtime_event_count: session.runtime_event_count,
    created_at: session.created_at,
    updated_at: session.updated_at,
    activity_id: session.activity_id,
    execution_status: session.execution_status,
    completed_count: session.completed_count,
    dropped_count: session.dropped_count,
    remaining_count: session.remaining_count,
    split_entered: session.split_entered,
    split_return_decision: session.split_return_decision
  }));

  const runtimeEventRows = await pool.query(
    `SELECT re.session_id, re.seq, re.event, re.created_at
     FROM runtime_events re
     JOIN sessions s ON s.session_id = re.session_id
     WHERE s.beta_subject_user_id = $1
     ORDER BY re.session_id ASC, re.seq ASC`,
    [athleteUserId]
  );

  const runtimeEventRecords = runtimeEventRows.rows.map((row) => ({
    athlete_user_id: athleteUserId,
    session_id: String(row.session_id),
    seq: Number(row.seq),
    event: isRecord(row.event) ? row.event : {},
    created_at: isoString(row.created_at)
  }));

  const distinctAssignmentIds = [...new Set(sessions.map((s) => s.assignment_id).filter((id): id is string => Boolean(id)))];

  const programmeAssignmentRecords = distinctAssignmentIds
    .map((assignmentId) => {
      const withProvenance = sessions.find((s) => s.assignment_id === assignmentId);
      if (!withProvenance || !withProvenance.provenance.assignment) return null;

      return {
        athlete_user_id: athleteUserId,
        assignment_id: assignmentId,
        assignment_status: withProvenance.provenance.assignment.assignment_status,
        programme: withProvenance.provenance.programme,
        event: withProvenance.provenance.event,
        provenance: {
          coach_user_id: withProvenance.provenance.assignment.coach_user_id
        }
      };
    })
    .filter((record): record is NonNullable<typeof record> => record !== null);

  const requestId = cleanString(input.request_id) || `athlete_history_export_${crypto.randomUUID()}`;

  const exportResult = createGdprExportHandling({
    request_id: requestId,
    actor_user_id: athleteUserId,
    actor_type: "athlete",
    target_user_id: athleteUserId,
    requested_export_type: "subject_data_access_json",
    requested_at: new Date().toISOString(),
    data_sources: {
      session_records: sessionRecords,
      runtime_events: runtimeEventRecords,
      programme_assignments: programmeAssignmentRecords
    }
  }) as JsonRecord;

  return Object.freeze({
    status: exportResult.ok === true ? 200 : 403,
    body: Object.freeze(exportResult)
  });
}
