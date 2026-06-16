import { tryBuildAssignmentVisibilityReadModel } from "../programmeAssignmentVisibility.mjs";

export const assignmentVisibilityApiSurfaceId = "programme_assignment_visibility_api";
export const assignmentVisibilityApiVersion = "1.0.0";

function response(status, body) {
  return Object.freeze({
    status,
    body: Object.freeze(body)
  });
}

export function handleProgrammeAssignmentVisibilityRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return response(400, {
      ok: false,
      error: "invalid_request",
      product_auth_failure: true,
      engine_decision: false,
      engine_visible: false
    });
  }

  if (request.method !== "POST") {
    return response(405, {
      ok: false,
      error: "method_not_allowed",
      product_auth_failure: true,
      engine_decision: false,
      engine_visible: false
    });
  }

  const result = tryBuildAssignmentVisibilityReadModel(request.body);

  if (!result.ok) {
    return response(403, result);
  }

  return response(200, result);
}
