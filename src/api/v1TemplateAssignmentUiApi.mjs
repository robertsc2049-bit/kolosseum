/**
 * DEV NOTE: S-V1-U-04 template assignment UI API adapter.
 * Purpose: maps product GET/POST requests into the bounded template assignment UI model.
 * Boundary: transport adapter only; it does not persist, compile, call engine code, create templates, or expose hidden internals.
 * Determinism: delegates to pure functions and returns stable response shapes.
 * Failure: malformed input maps to product failure responses with engine_visible=false.
 */

import {
  buildTemplateAssignmentUi,
  submitTemplateAssignmentFromUi,
  TemplateAssignmentUiError
} from "../v1TemplateAssignmentUi.mjs";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * FUNCTION NOTE:
 * Export: handleTemplateAssignmentUiRequest
 * Purpose: Serves template assignment UI reads and assignment submissions for authorised coaches.
 * Inputs: explicit method and body.
 * Output: frozen API-style response with status and body.
 * Boundary: product adapter only; no engine call, no hidden internals, no persistence implementation.
 * Determinism: same request body returns same response object.
 * Failure: product validation errors return reason/details only and remain engine-inert.
 */
export function handleTemplateAssignmentUiRequest(request) {
  if (!isRecord(request) || !["GET", "POST"].includes(request.method) || !isRecord(request.body)) {
    return Object.freeze({
      status: 400,
      body: Object.freeze({
        ok: false,
        reason: "template_assignment_ui_request_invalid",
        engine_visible: false
      })
    });
  }

  try {
    if (request.method === "GET") {
      return Object.freeze({
        status: 200,
        body: Object.freeze({
          ok: true,
          ui: buildTemplateAssignmentUi(request.body),
          engine_visible: false
        })
      });
    }

    return Object.freeze({
      status: 200,
      body: Object.freeze({
        ok: true,
        assignment: submitTemplateAssignmentFromUi(request.body),
        engine_visible: false
      })
    });
  } catch (error) {
    if (error instanceof TemplateAssignmentUiError) {
      return Object.freeze({
        status: error.reason === "template_assignment_ui_actor_not_coach" ? 403 : 400,
        body: Object.freeze({
          ok: false,
          reason: error.reason,
          details: error.details,
          engine_visible: false
        })
      });
    }

    throw error;
  }
}