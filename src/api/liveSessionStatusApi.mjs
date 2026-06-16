import { tryBuildLiveSessionStatus } from "../liveSessionStatus.mjs";
import { renderLiveSessionStatus } from "../liveSessionStatusUiRenderer.mjs";

export const liveSessionStatusApiRoute = Object.freeze({
  method: "POST",
  path: "/api/v1/live-session-status/read",
  surface_id: "v1_live_session_status_api",
  slice_id: "S-V1-43",
  mutation_policy: "read_only"
});

/**
 * FUNCTION NOTE:
 * Export: handleLiveSessionStatusRequest
 * Purpose: Maps an application request to the S-V1-43 read-only live session status read model and UI model.
 * Inputs: Explicit request body only; no ambient auth, realtime bus, storage write, or engine call.
 * Output: HTTP-style response containing the read model and UI model, or a product auth failure.
 * Boundary: Does not start, stop, split, return, create contact surfaces, control execution, stream media, or trigger substitution.
 * Determinism: Same body returns same response body.
 * Failure: Denied access maps to 403 with stable product-auth error payload.
 */
export function handleLiveSessionStatusRequest(httpRequest) {
  const result = tryBuildLiveSessionStatus(httpRequest?.body);

  if (result.ok !== true) {
    return Object.freeze({
      status: 403,
      body: Object.freeze({
        ok: false,
        error: result.error
      })
    });
  }

  return Object.freeze({
    status: 200,
    body: Object.freeze({
      ok: true,
      read_model: result.read_model,
      ui_model: renderLiveSessionStatus(result.read_model)
    })
  });
}