import {
  createBillingManagementSurface
} from "../v1BillingManagementSurface.mjs";

/**
 * DEV NOTE: S-V1-P-04 billing management API adapter.
 * Purpose: maps an HTTP-shaped request into the controlled-launch billing management surface.
 * Boundary: transport only; factual billing view and provider-portal request records only.
 * Determinism: response depends on supplied body only.
 * Failure: rejected requests remain product-layer failures and never become engine decisions.
 */
export function handleV1BillingManagementSurfaceApiRequest(request) {
  const body = request?.body ?? request ?? {};
  const result = createBillingManagementSurface(body);

  const statusCode = result.ok === true
    ? result.status === "billing_management_portal_session_requested"
      ? 201
      : 200
    : result.reason_code === "billing_management_input_required" ||
      result.reason_code === "billing_management_billing_access_record_required"
      ? 400
      : 403;

  return {
    statusCode,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(result)
  };
}