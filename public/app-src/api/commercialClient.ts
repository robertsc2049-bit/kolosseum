// DEV NOTE: FULL-UI-08 + LAUNCH-04 commercial/billing transport.
// All mutations remain authenticated product-layer actions; billing state is
// never accepted as deterministic engine input.
import { type JsonRecord, request } from "./transport";

export function loadCommercialAccount(): Promise<JsonRecord> {
  return request("GET", "/account/commercial");
}

export function requestCommercialTrial(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/trial", input, csrfToken);
}

export function requestCommercialCheckout(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/checkout", input, csrfToken);
}

export function requestCommercialTierChange(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/tier", input, csrfToken);
}

export function requestCommercialCancellation(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/cancel", input, csrfToken);
}

export function requestCommercialReconciliation(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/reconcile", input, csrfToken);
}

export function requestCommercialBillingPortal(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/portal", input, csrfToken);
}

export function recordCommercialPaymentReturn(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/payment-return", input, csrfToken);
}
