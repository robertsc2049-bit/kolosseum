import {
  createControlledLaunchCheckoutSession
} from "../v1ControlledLaunchCheckout.mjs";

/**
 * DEV NOTE: S-V1-P-02 checkout API adapter.
 * Purpose: maps an HTTP-shaped request into the controlled-launch checkout contract.
 * Boundary: transport only; no live provider call, no engine state, no enterprise billing, no revenue share, no royalties.
 * Determinism: response depends on supplied body only.
 * Failure: contract failures map to 400 without fallback creation.
 */
export function handleV1ControlledLaunchCheckoutApiRequest(request) {
  const body = request?.body ?? request ?? {};
  const result = createControlledLaunchCheckoutSession(body);

  return {
    statusCode: result.ok === true ? 201 : 400,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(result)
  };
}