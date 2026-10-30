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

// False only once the signed-in account is known to be a coach/org owner/
// admin. Athlete panels stay mounted for every role, so their reads check
// this before calling athlete-only endpoints (403 for anyone else). An
// unknown or unreadable actor_type still lets the read through, so a real
// athlete is never held back right after sign-in. /account/detail reads are
// coalesced by request(), so the extra call is shared across panels.
export async function accountMayBeAthlete(): Promise<boolean> {
  try {
    const account = await loadAccountDetail();
    const actorType = String((account.account as JsonRecord | undefined)?.actor_type ?? "");
    return actorType === "" || actorType === "athlete";
  }
  catch {
    return true;
  }
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

// One login, both roles: add the other role, or act as the other one.
export function addAccountRole(role: "coach" | "athlete", csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/roles", { role }, csrfToken);
}
export function switchAccountRole(role: "coach" | "athlete", csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/roles/active", { role }, csrfToken);
}

export function requestAccountClosure(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/closure", input, csrfToken);
}
