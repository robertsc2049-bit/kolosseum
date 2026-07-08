/**
 * DEV NOTE: S-V1-U-03 coach review queue projection.
 * Purpose: projects the factual review queue into copy-id-backed UI rows.
 * Boundary: presentation projection only; it exposes recorded fields and copy identifiers without inline interpretive prose.
 * Determinism: pure transformation of an already-built review queue read model.
 * Failure: malformed queue objects are represented as an empty projection with engine_visible=false.
 */

const TITLE_COPY_ID = "coach_review_queue.title";
const EMPTY_COPY_ID = "coach_review_queue.empty";
const ATHLETE_COPY_ID = "coach_review_queue.athlete";
const SESSION_COPY_ID = "coach_review_queue.session";
const STATUS_COPY_ID = "coach_review_queue.review_status";
const EVENTS_COPY_ID = "coach_review_queue.recorded_events";
const LAST_EVENT_COPY_ID = "coach_review_queue.last_recorded_event";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * FUNCTION NOTE:
 * Export: projectCoachReviewQueue
 * Purpose: Builds a UI projection with copy ids and factual row fields only.
 * Inputs: Coach review queue read model.
 * Output: Frozen projection object for a renderer or route layer.
 * Boundary: Does not generate interpretive prose, action prompts, ordered importance, outbound messages, or engine-facing state.
 * Determinism: Same queue object produces same projection.
 * Failure: Invalid queue input returns an empty inert projection.
 */
export function projectCoachReviewQueue(queue) {
  if (!isRecord(queue) || !Array.isArray(queue.queue_rows)) {
    return Object.freeze({
      surface_id: "v1_coach_review_queue",
      title: Object.freeze({ copy_id: TITLE_COPY_ID, params: Object.freeze({}) }),
      rows: Object.freeze([]),
      empty_state: Object.freeze({ copy_id: EMPTY_COPY_ID, params: Object.freeze({}) }),
      engine_visible: false
    });
  }

  const rows = queue.queue_rows.map((row) => Object.freeze({
    athlete_user_id: row.athlete_user_id,
    athlete_display_id: row.athlete_display_id,
    relationship_id: row.relationship_id,
    session_id: row.session_id,
    assignment_id: row.assignment_id,
    recorded_session_status: row.recorded_session_status,
    started_at: row.started_at,
    completed_at: row.completed_at,
    recorded_event_count: row.recorded_event_count,
    recorded_event_type_counts: Object.freeze({ ...(row.recorded_event_type_counts || {}) }),
    last_recorded_event_at: row.last_recorded_event_at,
    review_status: row.review_status,
    review_recorded_at: row.review_recorded_at,
    review_recorded_by_coach_user_id: row.review_recorded_by_coach_user_id,
    deferred_until: row.deferred_until,
    labels: Object.freeze({
      athlete: Object.freeze({ copy_id: ATHLETE_COPY_ID, params: Object.freeze({}) }),
      session: Object.freeze({ copy_id: SESSION_COPY_ID, params: Object.freeze({}) }),
      review_status: Object.freeze({ copy_id: STATUS_COPY_ID, params: Object.freeze({}) }),
      recorded_events: Object.freeze({ copy_id: EVENTS_COPY_ID, params: Object.freeze({}) }),
      last_recorded_event: Object.freeze({ copy_id: LAST_EVENT_COPY_ID, params: Object.freeze({}) })
    }),
    engine_visible: false
  }));

  return Object.freeze({
    surface_id: "v1_coach_review_queue",
    title: Object.freeze({ copy_id: TITLE_COPY_ID, params: Object.freeze({}) }),
    rows: Object.freeze(rows),
    empty_state: rows.length === 0 ? Object.freeze({ copy_id: EMPTY_COPY_ID, params: Object.freeze({}) }) : null,
    engine_visible: false
  });
}