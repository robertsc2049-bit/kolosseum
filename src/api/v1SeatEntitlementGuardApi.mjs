import {
  evaluateSeatEntitlement
} from "../v1SeatEntitlementGuard.mjs";

/**
 * DEV NOTE: S-V1-P-03 seat entitlement API adapter.
 * Purpose: maps an HTTP-shaped request into the controlled-launch seat entitlement guard.
 * Boundary: transport only; product access verdicts only; no engine state and no seat-scope expansion.
 * Determinism: response depends on supplied body only.
 * Failure: entitlement refusal maps to product access failure, not an engine decision.
 */
export function handleV1SeatEntitlementGuardApiRequest(request) {
  const body = request?.body ?? request ?? {};
  const result = evaluateSeatEntitlement(body);

  const statusCode = result.ok === true
    ? 200
    : result.reason_code === "seat_entitlement_input_required" ||
      result.reason_code === "seat_entitlement_billing_access_record_required"
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