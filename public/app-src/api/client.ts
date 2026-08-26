// DEV NOTE: FULL-UI-02 browser account transport (React port).
// This module transports account state only and cannot mutate engine law.
// Ported from public/app/account_ui.js's request() - identical CSRF/session
// semantics (credentials: "same-origin", x-kolosseum-csrf on non-GET
// requests), independent of the legacy app.js module scope by design so
// this React island never reaches into legacy private state. Generic
// transport now lives in ./transport.ts, shared with other screens' clients.

import { type JsonRecord, request } from "./transport";

export type { JsonRecord };

export function loadAccountDetail(): Promise<JsonRecord> {
  return request("GET", "/account/detail");
}

export function updateAccountProfile(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("PATCH", "/account/profile", input, csrfToken);
}

export function changeAccountPassword(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/password/change", input, csrfToken);
}

export function requestEmailVerification(csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/email-verification/request", {}, csrfToken);
}

export function completeEmailVerification(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/email-verification/complete", input, csrfToken);
}

export function signOutAccount(csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/sign-out", {}, csrfToken);
}

export function requestAccountClosure(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/closure", input, csrfToken);
}
