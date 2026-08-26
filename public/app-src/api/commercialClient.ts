// DEV NOTE: FULL-UI-08 commercial/billing transport (React port of
// commercial_ui.js's loadCommercialAccount()/requestCommercialCheckout()/
// requestCommercialBillingPortal()/recordCommercialPaymentReturn() calls,
// previously imported from account_ui.js). Same routes, same shapes.
import { type JsonRecord, request } from "./transport";

export function loadCommercialAccount(): Promise<JsonRecord> {
  return request("GET", "/account/commercial");
}

export function requestCommercialCheckout(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/checkout", input, csrfToken);
}

export function requestCommercialBillingPortal(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/portal", input, csrfToken);
}

export function recordCommercialPaymentReturn(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/commercial/payment-return", input, csrfToken);
}
