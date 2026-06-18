/**
 * DEV NOTE: S-V1-U-02 coach assigned-shell projection.
 * Purpose: exposes copy ids and factual row data for the coach assigned-athlete shell.
 * Boundary: projects copy ids plus parameters only; it does not create inline user-facing prose, engine input, engine output, advice, comparison, or commercial surface content.
 * Determinism: pure transformation of an already-built read model.
 * Failure: malformed shell objects are represented as an empty shell projection with engine_visible=false.
 */

const TITLE_COPY_ID = "coach_dashboard_shell.title";
const ASSIGNED_COPY_ID = "coach_dashboard_shell.assigned_athletes";
const RECORDED_COPY_ID = "coach_dashboard_shell.recorded_sessions";
const LAST_EVENT_COPY_ID = "coach_dashboard_shell.last_recorded_event";
const EMPTY_COPY_ID = "coach_dashboard_shell.no_assigned_athletes";

export function projectCoachAssignedShell(shell) {
  if (!shell || typeof shell !== "object" || !Array.isArray(shell.assigned_athlete_rows)) {
    return Object.freeze({
      surface_id: "v1_coach_dashboard_shell",
      title: Object.freeze({ copy_id: TITLE_COPY_ID, params: Object.freeze({}) }),
      rows: Object.freeze([]),
      empty_state: Object.freeze({ copy_id: EMPTY_COPY_ID, params: Object.freeze({}) }),
      engine_visible: false
    });
  }

  const rows = shell.assigned_athlete_rows.map((row) => Object.freeze({
    athlete_user_id: row.athlete_user_id,
    athlete_display_id: row.athlete_display_id,
    relationship_id: row.relationship_id,
    assignment_count: row.assignment_count,
    recorded_session_count: row.recorded_session_count,
    last_recorded_event_at: row.last_recorded_event_at,
    last_recorded_session_status: row.last_recorded_session_status,
    review_surfaces: Object.freeze([...(row.review_surfaces || [])]),
    labels: Object.freeze({
      assigned: Object.freeze({ copy_id: ASSIGNED_COPY_ID, params: Object.freeze({}) }),
      recorded_sessions: Object.freeze({ copy_id: RECORDED_COPY_ID, params: Object.freeze({}) }),
      last_recorded_event: Object.freeze({ copy_id: LAST_EVENT_COPY_ID, params: Object.freeze({}) })
    }),
    engine_visible: false
  }));

  return Object.freeze({
    surface_id: "v1_coach_dashboard_shell",
    title: Object.freeze({ copy_id: TITLE_COPY_ID, params: Object.freeze({}) }),
    rows: Object.freeze(rows),
    empty_state: rows.length === 0 ? Object.freeze({ copy_id: EMPTY_COPY_ID, params: Object.freeze({}) }) : null,
    engine_visible: false
  });
}