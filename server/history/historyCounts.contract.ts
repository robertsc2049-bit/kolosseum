/**
 * DEV NOTE:
 * Purpose: Defines the factual history count contract used by read-model surfaces.
 * Boundary: The contract must describe recorded facts only and must not add interpretation claims.
 * Determinism: Field meaning must remain stable so stored history can be read consistently.
 * Failure: Contract drift must be handled by explicit versioned change rather than silent reinterpretation.
 */
/**
 * FUNCTION NOTE:
 * Export: HISTORY_COUNTS_SCHEMA_VERSION
 * Purpose: Documents the exported entrypoint for history count contract boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must describe recorded facts only and must not add interpretation claims.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const HISTORY_COUNTS_SCHEMA_VERSION = "kolosseum.history_counts.v0.1" as const;

/**
 * FUNCTION NOTE:
 * Export: HISTORY_VISIBILITY_DENIED
 * Purpose: Documents the exported entrypoint for history count contract boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must describe recorded facts only and must not add interpretation claims.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const HISTORY_VISIBILITY_DENIED = "HISTORY_VISIBILITY_DENIED" as const;

export type HistoryViewerType = "athlete" | "linked_coach";

export type HistoryRequesterRole = "athlete" | "coach";

export type HistorySessionStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "partially_completed"
  | "stopped";

export type HistoryCounts = {
  session_count: number;
  completed_item_count: number;
  skipped_item_count: number;
  partial_item_count: number;
  extra_work_event_count?: number;
  first_session_at: string | null;
  latest_session_at: string | null;
};

export type HistorySession = {
  session_id: string;
  status: HistorySessionStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type HistoryCountsResponse = {
  schema_version: typeof HISTORY_COUNTS_SCHEMA_VERSION;
  athlete_user_id: string;
  viewer_type: HistoryViewerType;
  counts: HistoryCounts;
  sessions: HistorySession[];
};

export type HistoryDeniedResponse = {
  error: {
    code: typeof HISTORY_VISIBILITY_DENIED;
    message_copy_id: "history.error.visibility_denied";
  };
};

export type HistoryApiResponse = HistoryCountsResponse | HistoryDeniedResponse;

export type HistoryAccessAllowed =
  | {
      allowed: true;
      viewer_type: "athlete";
      athlete_user_id: string;
    }
  | {
      allowed: true;
      viewer_type: "linked_coach";
      coach_user_id: string;
      athlete_user_id: string;
      link_id: string;
    };

export type HistoryAccessDenied = {
  allowed: false;
  reason:
    | "requester_not_athlete"
    | "coach_link_missing"
    | "coach_link_not_accepted"
    | "coach_link_revoked"
    | "coach_link_expired"
    | "coach_scope_missing"
    | "unknown_role";
};

export type HistoryAccessDecision = HistoryAccessAllowed | HistoryAccessDenied;

/**
 * FUNCTION NOTE:
 * Export: ALLOWED_HISTORY_COUNT_FIELDS
 * Purpose: Documents the exported entrypoint for history count contract boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must describe recorded facts only and must not add interpretation claims.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const ALLOWED_HISTORY_COUNT_FIELDS = [
  "session_count",
  "completed_item_count",
  "skipped_item_count",
  "partial_item_count",
  "extra_work_event_count",
  "first_session_at",
  "latest_session_at"
] as const;

/**
 * FUNCTION NOTE:
 * Export: ALLOWED_HISTORY_SESSION_FIELDS
 * Purpose: Documents the exported entrypoint for history count contract boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must describe recorded facts only and must not add interpretation claims.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export const ALLOWED_HISTORY_SESSION_FIELDS = [
  "session_id",
  "status",
  "started_at",
  "completed_at",
  "created_at"
] as const;

/**
 * FUNCTION NOTE:
 * Export: deniedHistoryResponse
 * Purpose: Documents the exported entrypoint for history count contract boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must describe recorded facts only and must not add interpretation claims.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function deniedHistoryResponse(): HistoryDeniedResponse {
  return {
    error: {
      code: HISTORY_VISIBILITY_DENIED,
      message_copy_id: "history.error.visibility_denied"
    }
  };
}

/**
 * FUNCTION NOTE:
 * Export: assertHistoryResponseClosedWorld
 * Purpose: Documents the exported entrypoint for history count contract boundary so a future developer can understand its role before changing it.
 * Inputs: Use explicit caller-provided values only; do not fill missing state by assumption.
 * Output: Preserve the existing return shape, thrown token, or status behaviour for this export.
 * Boundary: This export must describe recorded facts only and must not add interpretation claims.
 * Determinism: The same explicit inputs and stored records must produce the same result or failure path.
 * Failure: Preserve existing refusal behaviour; do not add fallback fabrication or hidden side effects.
 */
export function assertHistoryResponseClosedWorld(response: HistoryCountsResponse): void {
  const allowedCountKeys = new Set<string>(ALLOWED_HISTORY_COUNT_FIELDS);
  const allowedSessionKeys = new Set<string>(ALLOWED_HISTORY_SESSION_FIELDS);

  for (const key of Object.keys(response.counts)) {
    if (!allowedCountKeys.has(key)) {
      throw new Error(`Forbidden history count field: ${key}`);
    }
  }

  for (const session of response.sessions) {
    for (const key of Object.keys(session)) {
      if (!allowedSessionKeys.has(key)) {
        throw new Error(`Forbidden history session field: ${key}`);
      }
    }
  }
}