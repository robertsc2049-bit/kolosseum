// DEV NOTE: Shared org-owner session-authentication boundary. Every org-
// scoped HTTP handler must derive org owner identity from here (a verified
// org owner session cookie), never from a client-supplied user id. This
// never reads the athlete/coach or admin session cookies, so no other
// session can ever satisfy this guard, and vice versa.

import type { Request } from "express";

import {
  ORG_OWNER_SESSION_COOKIE,
  OrgOwnerAuthError,
  assertOrgOwnerCsrf,
  resolveOrgOwnerSession
} from "./org_owner_account_service.js";
import { forbidden, unauthorized } from "./http_errors.js";

export function orgOwnerCookieValue(request: Request, name: string): string {
  const header = String(request.headers.cookie ?? "");
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
    catch {
      return "";
    }
  }
  return "";
}

export async function authenticatedOrgOwner(
  request: Request,
  mutation: boolean
): Promise<Readonly<{ user_id: string; raw_session_token: string }>> {
  const rawToken = orgOwnerCookieValue(request, ORG_OWNER_SESSION_COOKIE);

  if (!rawToken) {
    throw unauthorized("ORG_OWNER_SESSION_REQUIRED", {
      failure_token: "org_owner_session_missing"
    });
  }

  try {
    if (mutation) {
      assertOrgOwnerCsrf(rawToken, request.get("x-kolosseum-csrf"));
    }
    const session = await resolveOrgOwnerSession(rawToken);
    return Object.freeze({ user_id: session.user_id, raw_session_token: rawToken });
  }
  catch (error) {
    if (error instanceof OrgOwnerAuthError) {
      if (error.status === 401) {
        throw unauthorized("ORG_OWNER_SESSION_REQUIRED", { failure_token: error.message });
      }
      throw forbidden("ORG_OWNER_ACTION_DENIED", { failure_token: error.message });
    }
    throw error;
  }
}
