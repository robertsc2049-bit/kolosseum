// DEV NOTE: FULL-UI-02D entry (sign-up/sign-in/password-reset) transport -
// ported from public/app/account_ui.js. restoreAccountSession() stays in
// account_ui.js since bootstrapApplication()'s shell-vs-entry-view decision
// must stay plain JS, independent of the React bundle - see app.js's own
// DEV NOTE on that boundary.

import { type JsonRecord, request } from "./transport";

export function loadCurrentTerms(): Promise<JsonRecord> {
  return request("GET", "/account/terms");
}

export function registerAccount(input: JsonRecord): Promise<JsonRecord> {
  return request("POST", "/account/register", input);
}

export function signInAccount(input: JsonRecord): Promise<JsonRecord> {
  return request("POST", "/account/sign-in", input);
}

export function requestPasswordReset(input: JsonRecord): Promise<JsonRecord> {
  return request("POST", "/account/password/reset/request", input);
}

export function completePasswordReset(input: JsonRecord): Promise<JsonRecord> {
  return request("POST", "/account/password/reset/complete", input);
}
