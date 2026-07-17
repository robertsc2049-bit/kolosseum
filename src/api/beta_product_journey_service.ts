
// DEV NOTE: BETA-E2E-01 stored product-journey composition.
// This service combines immutable product records with factual persisted runtime
// records. It does not alter canonical engine input or apply engine decisions.

import { pool } from "../db/pool.js";

import {
  assertBeta16CompileAdmission
} from "./beta16_app_path_service.js";

import {
  BETA17_COACH_COPY_IDS,
  beta17CoachManagedContract,
  buildBeta17CoachArtefactView,
  createBeta17AssignmentRecord
} from "./beta17_coach_managed_service.js";

import {
  loadBeta16StoredCompileContext,
  loadBeta17StoredCoachContext,
  loadLatestBeta17StoredAssignment,
  loadLatestBetaProductRecord
} from "./beta_product_record_store.js";

type JsonRecord =
  Record<string, unknown>;

type BetaHttpResult =
  Readonly<{
    status: number;
    body: Readonly<JsonRecord>;
  }>;

export class BetaProductJourneyError
  extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(
      `beta_product_journey_${reason}`
    );

    this.name =
      "BetaProductJourneyError";

    this.reason = reason;
  }
}

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isoString(
  value: unknown
): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const text =
    cleanString(value);

  return text || null;
}

function accessDenied(
  reason: string
): BetaHttpResult {
  return Object.freeze({
    status: 403,
    body: Object.freeze({
      ok: false,
      surface_id:
        beta17CoachManagedContract
          .surface_id,
      failure_token:
        "beta17_coach_managed_invalid",
      reason,
      product_permission_state_only:
        true,
      engine_visible: false,
      copy_id:
        BETA17_COACH_COPY_IDS
          .accessDenied
    })
  });
}

function assertStoredAssignment(
  assignment: unknown,
  coachUserId: string,
  athleteUserId: string,
  activityId: string
): asserts assignment is JsonRecord {
  if (!isRecord(assignment)) {
    throw new BetaProductJourneyError(
      "stored_assignment_missing"
    );
  }

  if (
    assignment.record_type !==
      "beta17_assignment_trigger" ||
    assignment.assignment_status !==
      "assigned" ||
    assignment.assigned_by_coach_id !==
      coachUserId ||
    assignment.assigned_athlete_id !==
      athleteUserId ||
    assignment.activity_id !==
      activityId ||
    assignment.engine_visible !== false ||
    assignment.assignment_mutates_engine_truth !==
      false
  ) {
    throw new BetaProductJourneyError(
      "stored_assignment_invalid"
    );
  }

  if (
    !cleanString(
      assignment.assignment_id
    )
  ) {
    throw new BetaProductJourneyError(
      "stored_assignment_id_missing"
    );
  }
}

/**
 * FUNCTION NOTE:
 * Purpose: Loads stored BETA-16 admission and BETA-17 assignment state.
 * Boundary: Existing admission and permission guards remain authoritative.
 * Determinism: Uses immutable records selected by stored effective timestamps.
 * Failure: Missing, revoked or mismatched state fails closed.
 */
export async function loadStoredBetaCompileAdmission(
  athleteUserIdInput: string,
  coachUserIdInput: string,
  phase1Input: unknown
): Promise<
  Readonly<{
    admission: Readonly<JsonRecord>;
    subject_user_id: string;
    coach_user_id: string;
    assignment_id: string;
  }>
> {
  const athleteUserId =
    cleanString(
      athleteUserIdInput
    );

  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  if (
    !athleteUserId ||
    !coachUserId
  ) {
    throw new BetaProductJourneyError(
      "stored_identity_required"
    );
  }

  const [
    compileContext,
    coachContext,
    assignment
  ] = await Promise.all([
    loadBeta16StoredCompileContext(
      athleteUserId
    ),
    loadBeta17StoredCoachContext(
      coachUserId,
      athleteUserId
    ),
    loadLatestBeta17StoredAssignment(
      coachUserId,
      athleteUserId
    )
  ]);

  if (!compileContext) {
    throw new BetaProductJourneyError(
      "stored_compile_context_missing"
    );
  }

  if (!coachContext) {
    throw new BetaProductJourneyError(
      "stored_coach_context_missing"
    );
  }

  const accessProbe =
    buildBeta17CoachArtefactView({
      coach_profile:
        coachContext.coach_profile,
      relationship:
        coachContext.relationship,
      athlete_user_id:
        athleteUserId,
      artefacts: []
    });

  if (
    accessProbe.status !== 200 ||
    accessProbe.body.ok !== true
  ) {
    throw new BetaProductJourneyError(
      cleanString(
        accessProbe.body.reason
      ) ||
      "stored_relationship_access_denied"
    );
  }

  if (!isRecord(phase1Input)) {
    throw new BetaProductJourneyError(
      "phase1_input_invalid"
    );
  }

  const activityId =
    cleanString(
      phase1Input.activity_id
    );

  assertStoredAssignment(
    assignment,
    coachUserId,
    athleteUserId,
    activityId
  );

  const admission =
    assertBeta16CompileAdmission(
      compileContext,
      phase1Input
    );

  return Object.freeze({
    admission,
    subject_user_id:
      athleteUserId,
    coach_user_id:
      coachUserId,
    assignment_id:
      String(
        assignment.assignment_id
      )
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Creates an assignment using stored coach and relationship records.
 * Boundary: Delegates assignment validation to the existing BETA-17 contract.
 * Determinism: Only immutable stored context is injected.
 * Failure: Missing relationship state returns a stable access denial.
 */
export async function createStoredBeta17AssignmentResult(
  input: unknown
): Promise<BetaHttpResult> {
  if (!isRecord(input)) {
    return accessDenied(
      "stored_assignment_input_invalid"
    );
  }

  const coachUserId =
    cleanString(
      input.coach_user_id
    );

  const athleteUserId =
    cleanString(
      input.athlete_user_id
    );

  if (
    !coachUserId ||
    !athleteUserId
  ) {
    return accessDenied(
      "stored_assignment_identity_required"
    );
  }

  const context =
    await loadBeta17StoredCoachContext(
      coachUserId,
      athleteUserId
    );

  if (!context) {
    return accessDenied(
      "stored_relationship_access_denied"
    );
  }

  return createBeta17AssignmentRecord({
    request_id:
      input.request_id,
    requested_at_iso8601:
      input.requested_at_iso8601,
    coach_profile:
      context.coach_profile,
    relationship:
      context.relationship,
    athlete_user_id:
      athleteUserId,
    template_id:
      input.template_id,
    activity_id:
      input.activity_id
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Returns factual stored session history for an active beta athlete.
 * Boundary: Read-only product/runtime projection; does not call the engine.
 * Determinism: Sessions are ordered by persisted creation time and identifier.
 * Failure: Missing active athlete state returns access denial.
 */
export async function buildStoredBetaAthleteHistoryResult(
  input: unknown
): Promise<BetaHttpResult> {
  if (!isRecord(input)) {
    return accessDenied(
      "athlete_history_input_invalid"
    );
  }

  const athleteUserId =
    cleanString(
      input.athlete_user_id
    );

  if (!athleteUserId) {
    return accessDenied(
      "athlete_history_identity_required"
    );
  }

  const authRecord =
    await loadLatestBetaProductRecord(
      "beta16_auth",
      athleteUserId,
      athleteUserId
    );

  if (
    !authRecord ||
    authRecord.account_role !==
      "athlete" ||
    authRecord.account_state !==
      "active"
  ) {
    return accessDenied(
      "athlete_history_access_denied"
    );
  }

  const result =
    await pool.query(
      `
      SELECT
        s.session_id,
        s.block_id,
        s.status,
        s.beta_assignment_id,
        s.created_at,
        s.updated_at,
        count(re.seq)::integer
          AS runtime_event_count
      FROM sessions s
      LEFT JOIN runtime_events re
        ON re.session_id = s.session_id
      WHERE
        s.beta_subject_user_id = $1
      GROUP BY
        s.session_id,
        s.block_id,
        s.status,
        s.beta_assignment_id,
        s.created_at,
        s.updated_at
      ORDER BY
        s.created_at ASC,
        s.session_id ASC
      `,
      [
        athleteUserId
      ]
    );

  const sessions =
    result.rows.map(
      (row) =>
        Object.freeze({
          session_id:
            String(row.session_id),
          block_id:
            String(row.block_id),
          status:
            String(row.status),
          assignment_id:
            cleanString(
              row.beta_assignment_id
            ) || null,
          runtime_event_count:
            Number(
              row.runtime_event_count
            ),
          created_at:
            isoString(
              row.created_at
            ),
          updated_at:
            isoString(
              row.updated_at
            )
        })
    );

  return Object.freeze({
    status: 200,
    body: Object.freeze({
      ok: true,
      record_type:
        "beta_e2e_athlete_history",
      athlete_user_id:
        athleteUserId,
      session_count:
        sessions.length,
      sessions,
      factual_records_only:
        true,
      calls_engine: false,
      read_only: true
    })
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Builds coach artefacts from persisted sessions and runtime events.
 * Boundary: Existing BETA-17 relationship guard authorises the final view.
 * Determinism: Events and sessions are ordered by stored sequence and identifiers.
 * Failure: Missing current relationship or assignment returns access denial.
 */
export async function buildStoredBeta17CoachArtefactResult(
  input: unknown
): Promise<BetaHttpResult> {
  if (!isRecord(input)) {
    return accessDenied(
      "stored_artefact_input_invalid"
    );
  }

  const coachUserId =
    cleanString(
      input.coach_user_id
    );

  const athleteUserId =
    cleanString(
      input.athlete_user_id
    );

  if (
    !coachUserId ||
    !athleteUserId
  ) {
    return accessDenied(
      "stored_artefact_identity_required"
    );
  }

  const [
    context,
    assignment
  ] = await Promise.all([
    loadBeta17StoredCoachContext(
      coachUserId,
      athleteUserId
    ),
    loadLatestBeta17StoredAssignment(
      coachUserId,
      athleteUserId
    )
  ]);

  if (
    !context ||
    !assignment
  ) {
    return accessDenied(
      "stored_relationship_or_assignment_access_denied"
    );
  }

  const assignmentId =
    cleanString(
      assignment.assignment_id
    );

  if (
    assignment.assignment_status !==
      "assigned" ||
    assignment.assigned_by_coach_id !==
      coachUserId ||
    assignment.assigned_athlete_id !==
      athleteUserId ||
    !assignmentId
  ) {
    return accessDenied(
      "stored_assignment_access_denied"
    );
  }

  const result =
    await pool.query(
      `
      SELECT
        s.session_id,
        s.status,
        s.updated_at,
        COALESCE(
          jsonb_agg(
            re.event ||
            jsonb_build_object(
              'seq', re.seq,
              'created_at',
                re.created_at
            )
            ORDER BY re.seq
          )
          FILTER (
            WHERE re.seq IS NOT NULL
          ),
          '[]'::jsonb
        ) AS runtime_events
      FROM sessions s
      LEFT JOIN runtime_events re
        ON re.session_id = s.session_id
      WHERE
        s.beta_subject_user_id = $1
        AND s.beta_coach_user_id = $2
        AND s.beta_assignment_id = $3
      GROUP BY
        s.session_id,
        s.status,
        s.updated_at
      ORDER BY
        s.session_id ASC
      `,
      [
        athleteUserId,
        coachUserId,
        assignmentId
      ]
    );

  const artefacts =
    result.rows.map(
      (row) =>
        Object.freeze({
          artefact_id:
            `beta_e2e_artefact_${String(
              row.session_id
            )}`,
          session_id:
            String(
              row.session_id
            ),
          athlete_user_id:
            athleteUserId,
          artefact_type:
            "session_runtime_artefact",
          session_status:
            String(
              row.status
            ),
          recorded_at:
            isoString(
              row.updated_at
            ),
          runtime_events:
            Array.isArray(
              row.runtime_events
            )
              ? row.runtime_events
              : []
        })
    );

  return buildBeta17CoachArtefactView({
    coach_profile:
      context.coach_profile,
    relationship:
      context.relationship,
    athlete_user_id:
      athleteUserId,
    artefacts
  });
}
