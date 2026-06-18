/**
 * DEV NOTE: S-V1-U-04 template assignment projection.
 * Purpose: projects the template assignment UI model into copy-id-backed rows and controls.
 * Boundary: presentation projection only; it carries recorded ids and labels, not hidden internals or engine state.
 * Determinism: pure transformation of a bounded UI model.
 * Failure: malformed UI input returns an inert empty projection.
 */

const TITLE_COPY_ID = "template_assignment_ui.title";
const ATHLETE_COPY_ID = "template_assignment_ui.athlete";
const TEMPLATE_COPY_ID = "template_assignment_ui.template";
const VERSION_COPY_ID = "template_assignment_ui.version";
const ACTIVITY_COPY_ID = "template_assignment_ui.activity";
const SUBMIT_COPY_ID = "template_assignment_ui.submit";
const EMPTY_COPY_ID = "template_assignment_ui.empty";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * FUNCTION NOTE:
 * Export: projectTemplateAssignmentUi
 * Purpose: Builds a copy-id-backed projection from the template assignment UI model.
 * Inputs: Template assignment UI model.
 * Output: Frozen projection object for a route or renderer.
 * Boundary: does not include hidden internals, inline prose, persistence state, compile state, or engine state.
 * Determinism: same UI model returns same projection object.
 * Failure: invalid input returns an empty inert projection.
 */
export function projectTemplateAssignmentUi(ui) {
  if (!isRecord(ui) || !Array.isArray(ui.athlete_rows) || !Array.isArray(ui.template_rows)) {
    return Object.freeze({
      surface_id: "v1_template_assignment_ui",
      title: Object.freeze({ copy_id: TITLE_COPY_ID, params: Object.freeze({}) }),
      athlete_rows: Object.freeze([]),
      template_rows: Object.freeze([]),
      submit: Object.freeze({ copy_id: SUBMIT_COPY_ID, enabled: false, params: Object.freeze({}) }),
      empty_state: Object.freeze({ copy_id: EMPTY_COPY_ID, params: Object.freeze({}) }),
      engine_visible: false
    });
  }

  return Object.freeze({
    surface_id: "v1_template_assignment_ui",
    title: Object.freeze({ copy_id: TITLE_COPY_ID, params: Object.freeze({}) }),
    athlete_rows: Object.freeze(ui.athlete_rows.map((row) => Object.freeze({
      athlete_user_id: row.athlete_user_id,
      athlete_display_id: row.athlete_display_id,
      relationship_id: row.relationship_id,
      label: Object.freeze({ copy_id: ATHLETE_COPY_ID, params: Object.freeze({}) }),
      engine_visible: false
    }))),
    template_rows: Object.freeze(ui.template_rows.map((row) => Object.freeze({
      template_id: row.template_id,
      template_display_name: row.template_display_name,
      template_version: row.template_version,
      activity_id: row.activity_id,
      visible_summary: row.visible_summary,
      labels: Object.freeze({
        template: Object.freeze({ copy_id: TEMPLATE_COPY_ID, params: Object.freeze({}) }),
        version: Object.freeze({ copy_id: VERSION_COPY_ID, params: Object.freeze({}) }),
        activity: Object.freeze({ copy_id: ACTIVITY_COPY_ID, params: Object.freeze({}) })
      }),
      engine_visible: false
    }))),
    submit: Object.freeze({
      copy_id: SUBMIT_COPY_ID,
      enabled: Boolean(ui.can_submit_assignment),
      params: Object.freeze({})
    }),
    empty_state: ui.can_submit_assignment ? null : Object.freeze({ copy_id: EMPTY_COPY_ID, params: Object.freeze({}) }),
    engine_visible: false
  });
}