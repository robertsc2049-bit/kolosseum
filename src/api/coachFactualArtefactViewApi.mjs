import { tryBuildCoachFactualArtefactView } from "../coachFactualArtefactView.mjs";

export const coachFactualArtefactViewApiSurfaceId = "coach_factual_artefact_view_api";
export const coachFactualArtefactViewApiVersion = "1.0.0";

function response(status, body) {
  return Object.freeze({ status, body: Object.freeze(body) });
}

/**
 * FUNCTION NOTE:
 * Export: handleCoachFactualArtefactViewRequest
 * Purpose: Transports the S-V1-41 read-model request across the API boundary.
 * Inputs: Accepts only explicit request method and body supplied by caller code.
 * Output: Returns a stable status/body pair for allowed and refused product-permission paths.
 * Boundary: Must not call engine code, mutate runtime state, create artefacts, or interpret recorded data.
 * Determinism: The same request body produces the same response shape.
 * Failure: Non-POST or malformed requests return product/API refusal envelopes only.
 */
export function handleCoachFactualArtefactViewRequest(request) {
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

  const result = tryBuildCoachFactualArtefactView(request.body);
  return response(result.ok ? 200 : 403, result);
}