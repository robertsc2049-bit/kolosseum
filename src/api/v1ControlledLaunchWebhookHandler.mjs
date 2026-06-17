import {
  handleControlledLaunchCheckoutWebhook
} from "../v1ControlledLaunchCheckout.mjs";

/**
 * DEV NOTE: S-V1-P-02 checkout webhook adapter.
 * Purpose: maps a provider webhook-shaped request into a billing/access record update.
 * Boundary: updates commercial access records only; no engine state, compile output, substitution, replay, proof, or factual history mutation.
 * Determinism: response depends on supplied body only.
 * Failure: unsupported events or widened scope fail without fallback access creation.
 */
export function handleV1ControlledLaunchWebhookRequest(request) {
  const body = request?.body ?? request ?? {};
  const result = handleControlledLaunchCheckoutWebhook(body);

  return {
    statusCode: result.ok === true ? 200 : 400,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(result)
  };
}