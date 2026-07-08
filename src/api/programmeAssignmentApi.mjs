// DEV NOTE: S-V1-28 API adapter. This is a transport wrapper around the
// programme assignment service. It maps input and service failure tokens to
// product/auth responses only. It does not create a live server route, database
// migration, UI surface, marketplace purchase flow, team/org assignment, or
// engine compile call.

import { tryCreateProgrammeAssignment } from "../programmeAssignmentContract.mjs";

const JSON_CONTENT_TYPE = "application/json";

function response(status, body) {
  return Object.freeze({
    status,
    headers: Object.freeze({
      "content-type": JSON_CONTENT_TYPE
    }),
    body: Object.freeze(body)
  });
}

export function handleProgrammeAssignmentRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return response(400, {
      ok: false,
      error_code: "v1_programme_assignment_contract_bad_request",
      message: "request object required"
    });
  }

  if (request.method !== "POST") {
    return response(405, {
      ok: false,
      error_code: "v1_programme_assignment_contract_method_not_allowed",
      message: "POST required"
    });
  }

  if (request.path !== "/v1/programme-assignments") {
    return response(404, {
      ok: false,
      error_code: "v1_programme_assignment_contract_not_found",
      message: "programme assignment route not found"
    });
  }

  const result = tryCreateProgrammeAssignment(request.body);

  if (!result.ok) {
    const status = result.error_code === "v1_programme_assignment_contract_unassigned_coach_assignment_rejected" ||
      result.error_code === "v1_programme_assignment_contract_relationship_not_accepted" ||
      result.error_code === "v1_programme_assignment_contract_relationship_scope_invalid" ||
      result.error_code === "v1_programme_assignment_contract_authorisation_not_granted"
      ? 403
      : 400;

    return response(status, {
      ok: false,
      error_code: result.error_code,
      message: result.message,
      details: result.details
    });
  }

  return response(201, {
    ok: true,
    assignment: result.assignment
  });
}
